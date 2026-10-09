import { Injectable, Logger } from '@nestjs/common';
import { APICallError, generateText, NoObjectGeneratedError, Output, RetryError } from 'ai';
import { SUPPORTED_LOCALES } from '@feedback-board/shared';

import { postClassificationSchema } from '../schemas/ai';
import type { PostClassification } from '../schemas/ai';
import { resolveModel } from './resolve-model';
import type { AiTransportConfig } from './resolve-model';

export const AI_SERVICE_OPTIONS = Symbol('AI_SERVICE_OPTIONS');

/**
 * Configuration, not a client — there is no vendor SDK object to hold (TDD §2.6.8a). The two
 * model ids and the transport config arrive as constructor arguments, supplied by whichever app
 * boots this service from its own validated env (`apps/worker` for classification, `apps/api`
 * for the digest) — `packages/core` reads no `process.env` of its own (§2.2a).
 */
export interface AiServiceOptions {
  readonly classifyModel: string;
  readonly digestModel: string;
  readonly transport: AiTransportConfig;
  /** Forwarded to `resolveModel()`; only ever set by a test (§14, §17). */
  readonly fetchImpl?: typeof globalThis.fetch;
}

/** A minimal post shape for the digest prompt — never the full Prisma row (TDD §3.8). */
export interface DigestPostInput {
  readonly title: string;
  readonly body: string;
  readonly voteCount: number;
  readonly category: string | null;
  readonly priority: string | null;
}

/**
 * Two independent AI features behind one small interface (TDD §3.8): the rest of the codebase
 * depends on `AiService`, never on `generateText`/`Output` or a vendor SDK directly. Neither
 * method throws on a model failure that classification callers must survive — `classifyPost()`
 * returns `null` instead, matching the "log and leave the fields null" rule (§3.8, §17); the
 * caller decides what "leave null" means for its own storage.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly options: AiServiceOptions) {}

  /**
   * Returns `null` on any failure — rate limit, network, refusal, or a response that fails
   * `postClassificationSchema` — rather than throwing. AI classification is an enhancement,
   * never a blocking dependency (TDD §3.8): the caller (the worker's processor) leaves
   * `aiCategory`/`aiPriority` `null`, but never fails the job because of this. This method logs
   * the cause (`describeAiFailure`); the caller's own log only records that the post stays
   * unclassified.
   */
  async classifyPost(title: string, body: string): Promise<PostClassification | null> {
    try {
      const model = resolveModel(
        this.options.classifyModel,
        this.options.transport,
        this.options.fetchImpl,
      );
      const prompt = `Title: ${title}\nBody: ${body}`;

      if (!this.options.transport.customSupportsStructuredOutputs) {
        // Plain-JSON-prompt fallback for a custom endpoint that cannot do structured outputs
        // (TDD §2.6.8b) — ask for JSON explicitly and validate it exactly like any other
        // classification failure mode.
        const result = await generateText({
          model,
          prompt: `${prompt}\n\nRespond with ONLY a JSON object of the shape {"category": "BUG"|"FEATURE_REQUEST"|"UX"|"OTHER", "priority": "LOW"|"MEDIUM"|"HIGH"}. No prose, no markdown fences.`,
        });

        const parsed = postClassificationSchema.safeParse(JSON.parse(result.text) as unknown);
        if (!parsed.success) {
          // Issue paths and codes name the offending field, never its value (no tenant content).
          const issues = parsed.error.issues
            .map((issue) => `${issue.path.map(String).join('.')}:${issue.code}`)
            .join(', ');
          this.logger.warn(`classification response failed schema validation (${issues})`);
          return null;
        }
        return parsed.data;
      }

      const result = await generateText({
        model,
        output: Output.object({ schema: postClassificationSchema }),
        prompt,
      });

      return result.output;
    } catch (error) {
      this.logger.warn(`classification failed: ${describeAiFailure(error)}`);
      return null;
    }
  }

  /**
   * Plain text, never persisted or cached (TDD §1.5, §3.8) — the caller returns `result` directly
   * to the browser. Unlike `classifyPost()`, a failure here propagates: the digest is an
   * on-demand, user-triggered action with a visible response, not a background enhancement, so
   * the caller (the digest controller) is the right place to turn a thrown error into an HTTP
   * failure rather than silently returning an empty summary. `acceptLanguage` is the caller's
   * `Accept-Language` header (apps/web forwards its own resolved locale, not the raw browser
   * value) — it decides what language the digest comes back in, independent of what language the
   * posts themselves are written in.
   */
  async generateDigest(
    posts: readonly DigestPostInput[],
    acceptLanguage?: string,
  ): Promise<string> {
    const model = resolveModel(
      this.options.digestModel,
      this.options.transport,
      this.options.fetchImpl,
    );
    const system = buildDigestSystemPrompt(resolveDigestLanguage(acceptLanguage));
    const prompt = buildDigestPrompt(posts);

    const result = await generateText({ model, system, maxOutputTokens: 1024, prompt });

    return result.text;
  }
}

/** Caps a provider message so an endpoint that echoes part of the request cannot flood the log. */
const MAX_PROVIDER_MESSAGE_LENGTH = 200;

/**
 * What is safe to log about a failed model call. A provider's own error message (bad model id,
 * quota, unsupported parameter) is diagnostic, so `APICallError` keeps it, truncated: a custom
 * endpoint may still quote part of the request, so this lowers the risk of post content reaching
 * the log rather than removing it. `RetryError` is what the SDK throws once its retries run out
 * (429, 5xx), so it is unwrapped to the error that caused it. `NoObjectGeneratedError` reports
 * only its finish reason, because its message and cause can quote the model output. Anything
 * else is reduced to its class name: a `JSON.parse` `SyntaxError` quotes a slice of the model
 * output, which echoes post content.
 */
function describeAiFailure(error: unknown): string {
  if (RetryError.isInstance(error)) {
    return `${error.name} (${error.reason}): ${describeAiFailure(error.lastError)}`;
  }
  if (APICallError.isInstance(error)) {
    const message =
      error.message.length > MAX_PROVIDER_MESSAGE_LENGTH
        ? `${error.message.slice(0, MAX_PROVIDER_MESSAGE_LENGTH)}...`
        : error.message;
    return `${error.name} (status ${error.statusCode ?? 'unknown'}): ${message}`;
  }
  if (NoObjectGeneratedError.isInstance(error)) {
    return `${error.name} (finish reason ${error.finishReason ?? 'unknown'})`;
  }
  return error instanceof Error ? error.name : 'unknown error';
}

/**
 * This runs as a one-shot API call with no chat turn to follow up in — without an explicit system
 * prompt the model would sometimes treat an empty-looking request conversationally (asking the
 * caller to "paste the posts") instead of just summarizing what is already in the user prompt.
 */
function buildDigestSystemPrompt(language: string): string {
  return [
    'You are a backend function that turns feedback board posts into a short digest for a product team.',
    'The caller is a server, not a chat user: it cannot read follow-up questions, so never ask for',
    'posts, clarification, or anything else — the full list of posts is always already included in',
    'the user message below. Output only the digest itself: no greeting, no preamble, no questions.',
    `Write the digest in ${language}, regardless of what language the posts themselves are written in.`,
  ].join(' ');
}

/**
 * Maps the locale this project actually ships (`SUPPORTED_LOCALES`, `@feedback-board/shared` —
 * the single list apps/web's switcher and browser-language auto-detect also read) to the language
 * name the model is told to answer in. Anything unrecognized — no header, an unsupported code, a
 * malformed value — falls back to English, matching the web app's own `DEFAULT_LOCALE`.
 */
function resolveDigestLanguage(acceptLanguage: string | undefined): string {
  const primaryTag = acceptLanguage?.split(',')[0]?.trim().split('-')[0]?.toLowerCase();
  const locale = SUPPORTED_LOCALES.find((candidate) => candidate.code === primaryTag);
  return locale?.aiLanguageName ?? 'English';
}

function buildDigestPrompt(posts: readonly DigestPostInput[]): string {
  const lines = posts.map((post, index) => {
    const tags = [post.category, post.priority].filter((value) => value !== null).join(', ');
    return `${index + 1}. "${post.title}" (votes: ${post.voteCount}${tags.length > 0 ? `, ${tags}` : ''})\n${post.body}`;
  });

  return [
    'Summarize the following open feedback board posts into a concise digest for a product team.',
    'Group related themes, call out the highest-voted items, and keep it short.',
    '',
    ...lines,
  ].join('\n');
}
