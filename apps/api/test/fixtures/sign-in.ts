import { createClient } from '@supabase/supabase-js';

/**
 * Real sign-in for e2e tests (TDD decision D8, §14): there is no password flow and the
 * service-role key is banned from this repository outright, so the only legitimate way to
 * obtain a JWKS-verifiable access token is to drive the same magic-link email flow a real user
 * would, reading the sign-in link out of the local stack's mail catcher instead of a
 * privileged API.
 *
 * **Magic link, not a 6-digit OTP.** GoTrue's default local email template interpolates only
 * `{{ .ConfirmationURL }}` — verified against a real local stack with `curl`: the email body is
 * "Sign in (http://.../auth/v1/verify?token=<hash>&type=magiclink&redirect_to=...)", with no
 * `{{ .Token }}` short code anywhere in it. §14's phrasing ("read the 6-digit token") describes
 * the alternate template shape the same GoTrue supports, not the one this project's untouched
 * `supabase/config.toml` actually sends — there is no custom `auth.email.template` here, so the
 * stock template applies. `verifyOtp` still does the verification (§14, D8): it takes the
 * `token` query parameter from the link as `token_hash`, with `type: 'magiclink'` instead of
 * `'email'` — the type GoTrue's own API expects for this specific link shape.
 *
 * The mail catcher is **Mailpit**, not Inbucket: `supabase start` (CLI 2.116.0) reports it as
 * "Mailpit" in its status output, and this local instance serializes its JSON with PascalCase
 * field names (`ID`, `Text`, `To`, …) — also verified with `curl` against a running stack,
 * because the published Mailpit docs show lowercase names that do not match what this version
 * actually returns.
 *
 * `SUPABASE_INBUCKET_URL` (kept under its historical name — it is what §16 and the rest of this
 * codebase call the mail-catcher URL) and `TEST_SUPABASE_ANON_KEY` belong to no runtime env
 * schema (§16) — both are read directly from `process.env` here because this file exists only
 * inside the test suite, never inside a booted app. `TEST_SUPABASE_ANON_KEY` is deliberately not
 * named `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the name `apps/web` consumes): `apps/api`'s env schema
 * actively rejects any `NEXT_PUBLIC_` prefix present in `process.env` at boot (§16), so if this
 * fixture and `AppModule` ever share a Jest process — which `test:e2e` does, since its
 * `--testPathPatterns test/e2e` glob always includes every `*.e2e-spec.ts` file regardless of
 * the `-- auth` filter argument — exporting the browser's variable name into the shell would
 * fail every other e2e suite's boot, not just skip this one test.
 */

interface MailpitMessageSummary {
  readonly ID: string;
}

interface MailpitSearchResult {
  readonly messages: readonly MailpitMessageSummary[];
}

interface MailpitMessage {
  readonly Text: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`sign-in fixture: missing required env var ${name}`);
  }
  return value;
}

/**
 * Parses a fetch Response as JSON, but on failure throws an error that includes the response's
 * status and raw text body — a bare `SyntaxError: Unexpected token` from `response.json()`
 * alone never says which endpoint or what was actually returned, which makes a real failure
 * indistinguishable from a wrong assumption about the API shape.
 */
async function parseJsonOrThrow<T>(response: Response, context: string): Promise<T> {
  const raw = await response.text();
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(
      `sign-in fixture: ${context} returned a non-JSON body (status ${response.status}): ${raw.slice(0, 500)}`,
    );
  }
}

/**
 * Extracts the `token` query parameter GoTrue embeds in its magic-link URL — the value
 * `verifyOtp` needs as `token_hash`. The plain-text body's link line reads
 * `Sign in ( http://.../auth/v1/verify?token=<hash>&type=magiclink&redirect_to=... )`.
 */
function extractTokenHash(emailText: string): string {
  const match = /[?&]token=([^&\s)]+)/.exec(emailText);
  if (match?.[1] === undefined) {
    throw new Error(
      `sign-in fixture: could not find a token= query parameter in the email body. Raw text: ${emailText.slice(0, 500)}`,
    );
  }
  return match[1];
}

async function fetchTokenHashFromMailpit(mailpitUrl: string, email: string): Promise<string> {
  const deadline = Date.now() + 15_000;
  const searchUrl = `${mailpitUrl}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`;

  while (Date.now() < deadline) {
    const searchResponse = await fetch(searchUrl);

    if (searchResponse.ok) {
      const { messages } = await parseJsonOrThrow<MailpitSearchResult>(
        searchResponse,
        `GET ${searchUrl}`,
      );
      const newest = messages[0];

      if (newest !== undefined) {
        const messageUrl = `${mailpitUrl}/api/v1/message/${newest.ID}`;
        const messageResponse = await fetch(messageUrl);
        const message = await parseJsonOrThrow<MailpitMessage>(
          messageResponse,
          `GET ${messageUrl}`,
        );
        return extractTokenHash(message.Text);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`sign-in fixture: no sign-in email received for ${email} within the deadline`);
}

/**
 * Signs in as `email` against the local Supabase stack via magic-link email and returns a real,
 * JWKS-verifiable access token. Uses only the **anon** key — no service-role key anywhere.
 */
export async function signInAs(email: string): Promise<string> {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const anonKey = requireEnv('TEST_SUPABASE_ANON_KEY');
  const mailpitUrl = requireEnv('SUPABASE_INBUCKET_URL');

  const supabase = createClient(supabaseUrl, anonKey);

  const { error: otpError } = await supabase.auth.signInWithOtp({ email });
  if (otpError) {
    throw new Error(`sign-in fixture: signInWithOtp failed: ${otpError.message}`);
  }

  const tokenHash = await fetchTokenHashFromMailpit(mailpitUrl, email);

  const { data, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  });
  if (verifyError || data.session === null) {
    throw new Error(`sign-in fixture: verifyOtp failed: ${verifyError?.message ?? 'no session'}`);
  }

  return data.session.access_token;
}
