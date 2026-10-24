'use client';

import { aiDigestQuotaSchema, boardDigestSchema } from '@feedback-board/shared';
import { ChevronDown, Sparkles } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import Markdown from 'react-markdown';

import { apiFetch, apiFetchWithHeaders, ApiError } from '../../lib/api-client';
import { Button, Card, Skeleton } from '../ui';

/** `null` until the first response, since the quota is only known from the API's own headers
 * (TDD §3.8) — there is no client-side copy of the `@RateLimit` config to read it from upfront. */
interface Quota {
  remaining: number;
  limit: number;
}

/** `null` when a response carries no quota headers (a proxy error, say): the caller keeps what it had. */
function readQuota(headers: Headers): Quota | null {
  const remaining = headers.get('X-RateLimit-Remaining');
  const limit = headers.get('X-RateLimit-Limit');
  if (remaining === null || limit === null) {
    return null;
  }
  return { remaining: Number(remaining), limit: Number(limit) };
}

interface AiDigestPanelProps {
  orgSlug: string;
  boardSlug: string;
}

/**
 * "Generate AI Summary" (TDD §3.8, §11): only rendered by the parent for OWNER/ADMIN, matching
 * the route's own `@Roles('OWNER', 'ADMIN')` guard — hiding the button here is presentation
 * only, the server enforces it regardless. The result is never persisted or cached (§1.5):
 * regenerating simply calls the endpoint again. `429 RATE_LIMITED` (5/h per org, §3.8) gets its
 * own copy rather than the generic failure message.
 *
 * The digest prompt asks the model to group themes and highlight top-voted items, so the
 * response is Markdown (headings/bold/lists), not plain prose — `react-markdown` renders it
 * instead of the `**`/`-` characters showing up literally in a plain-text node. It is secure by
 * default (no `dangerouslySetInnerHTML`, sanitized URLs), so this model-generated string needs
 * no extra sanitization step here.
 */
export function AiDigestPanel({ orgSlug, boardSlug }: AiDigestPanelProps): ReactElement {
  const t = useTranslations('dashboard.boardDetail.aiDigest');
  const locale = useLocale();
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [quotaPending, setQuotaPending] = useState(true);
  const [expanded, setExpanded] = useState(true);

  // Shows the budget before the caller has generated anything — a dedicated GET that never
  // counts as an attempt (TDD §3.8), rather than waiting for the first digest's own headers.
  useEffect(() => {
    let cancelled = false;

    apiFetch(`/orgs/${orgSlug}/boards/${boardSlug}/ai-digest/quota`, aiDigestQuotaSchema)
      .then((data) => {
        if (!cancelled) {
          // A Generate that finished first has the fresher count: this read must not undo it.
          setQuota((current) => current ?? data);
        }
      })
      .catch(() => {
        // Best-effort preview — a failed preflight read still lets the Generate button try, and
        // that attempt's own response headers will populate the quota line instead.
      })
      .finally(() => {
        if (!cancelled) {
          setQuotaPending(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [orgSlug, boardSlug]);

  async function handleGenerate(): Promise<void> {
    setError(null);
    setIsGenerating(true);
    try {
      const { data: digest, headers } = await apiFetchWithHeaders(
        `/orgs/${orgSlug}/boards/${boardSlug}/ai-digest`,
        boardDigestSchema,
        { method: 'POST', headers: { 'Accept-Language': locale } },
      );
      setQuota((current) => readQuota(headers) ?? current);
      setSummary(digest.summary);
      setExpanded(true);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setQuota((current) => readQuota(caught.headers) ?? current);
        if (caught.body.error === 'RATE_LIMITED') {
          setError(t('rateLimited'));
          return;
        }
        if (caught.body.error === 'DIGEST_NO_POSTS') {
          setError(t('noPosts'));
          return;
        }
      }
      setError(t('error'));
    } finally {
      setIsGenerating(false);
    }
  }

  const exhausted = quota?.remaining === 0;

  return (
    <Card as="section" aria-labelledby="ai-digest-title">
      {/* The bar's height is the button's (h-10); the quota line sits beside it, or under it on a
          narrow screen, in a box reserved from the first paint: the quota arrives from its own
          request, and a line that appears late would push the list down. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2
          id="ai-digest-title"
          className="flex items-center gap-1.5 text-body font-medium text-text"
        >
          <Sparkles className="h-4 w-4 text-accent-text" aria-hidden="true" />
          {t('title')}
        </h2>
        <div className="order-last min-h-4 basis-full sm:order-none sm:basis-auto sm:flex-1">
          {quota === null && quotaPending && error === null && <Skeleton className="h-4 w-56" />}
          {quota !== null && error === null && (
            <p className="text-caption text-text-muted">
              {exhausted
                ? t('quotaExhausted')
                : t('quotaRemaining', {
                    remaining: String(quota.remaining),
                    limit: String(quota.limit),
                  })}
            </p>
          )}
        </div>
        <Button
          variant="secondary"
          onClick={() => void handleGenerate()}
          pending={isGenerating}
          disabled={exhausted}
        >
          {!isGenerating && <Sparkles className="h-4 w-4" aria-hidden="true" />}
          {isGenerating ? t('generating') : t('submit')}
        </Button>
      </div>
      {error !== null && (
        <p role="alert" className="mt-2 text-body text-danger">
          {error}
        </p>
      )}
      {summary !== null && (
        <div className="mt-3 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
            aria-controls="ai-digest-result"
            className="inline-flex cursor-pointer items-center gap-1 rounded-control text-body font-medium text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
            {expanded ? t('hideSummary') : t('showSummary')}
          </button>
          <div
            id="ai-digest-result"
            hidden={!expanded}
            className="mt-2 text-body text-text [&_h2]:mt-3 [&_h2]:font-medium [&_h3]:mt-2 [&_h3]:font-medium [&_li]:ml-4 [&_li]:list-disc [&_p]:mt-1"
          >
            <Markdown>{summary}</Markdown>
          </div>
        </div>
      )}
    </Card>
  );
}
