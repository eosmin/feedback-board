import { Injectable } from '@nestjs/common';
import { generateText, Output } from 'ai';

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
  constructor(private readonly options: AiServiceOptions) {}

  /**
   * Returns `null` on any failure — rate limit, network, refusal, or a response that fails
   * `postClassificationSchema` — rather than throwing. AI classification is an enhancement,
   * never a blocking dependency (TDD §3.8): the caller (the worker's processor) leaves
   * `aiCategory`/`aiPriority` `null` and logs, but never fails the job because of this.
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
        return parsed.success ? parsed.data : null;
      }

      const result = await generateText({
        model,
        output: Output.object({ schema: postClassificationSchema }),
        prompt,
      });

      return result.output;
    } catch {
      return null;
    }
  }

  /**
   * Plain text, never persisted or cached (TDD §1.5, §3.8) — the caller returns `result` directly
   * to the browser. Unlike `classifyPost()`, a failure here propagates: the digest is an
   * on-demand, user-triggered action with a visible response, not a background enhancement, so
   * the caller (the digest controller) is the right place to turn a thrown error into an HTTP
   * failure rather than silently returning an empty summary.
   */
  async generateDigest(posts: readonly DigestPostInput[]): Promise<string> {
    const model = resolveModel(
      this.options.digestModel,
      this.options.transport,
      this.options.fetchImpl,
    );
    const prompt = buildDigestPrompt(posts);

    const result = await generateText({ model, maxOutputTokens: 1024, prompt });

    return result.text;
  }
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
