/**
 * Reads a magic-link sign-in email out of the local Supabase stack's mail catcher (Mailpit).
 * Mirrors `apps/api/test/fixtures/sign-in.ts`'s discovery (TDD §14, D8), but returns the full
 * verify URL rather than just its `token` query param: a real user clicks that link in a real
 * browser, and Playwright's `page.goto()` on it lets GoTrue's own redirect to
 * `/auth/callback?code=...` run exactly as it would for a human, instead of the API suite's
 * `verifyOtp` shortcut.
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

async function parseJsonOrThrow<T>(response: Response, context: string): Promise<T> {
  const raw = await response.text();
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(
      `mailpit fixture: ${context} returned a non-JSON body (status ${response.status}): ${raw.slice(0, 500)}`,
    );
  }
}

/**
 * Extracts the `Sign in (...)` link from the plain-text email body (same stock GoTrue template
 * the API suite's fixture documents — no `{{ .Token }}` short code, only a `ConfirmationURL`).
 */
function extractSignInUrl(emailText: string): string {
  const match = /Sign in \(\s*([^\s)]+)\s*\)/.exec(emailText);
  if (match?.[1] === undefined) {
    throw new Error(
      `mailpit fixture: could not find a "Sign in (...)" link in the email body. Raw text: ${emailText.slice(0, 500)}`,
    );
  }
  return match[1];
}

export async function getLatestMagicLinkUrl(mailpitUrl: string, email: string): Promise<string> {
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
        return extractSignInUrl(message.Text);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`mailpit fixture: no sign-in email received for ${email} within the deadline`);
}
