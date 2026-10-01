'use client';

import { aiDigestQuotaSchema, boardDigestSchema } from '@feedback-board/shared';
import { Sparkles } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import Markdown from 'react-markdown';

import { apiFetch, apiFetchWithHeaders, ApiError } from '../../lib/api-client';
import { Button, Card } from '../ui';

/** `null` until the first response, since the quota is only known from the API's own headers
 * (TDD §3.8) — there is no client-side copy of the `@RateLimit` config to read it from upfront. */
interface Quota {
  remaining: number;
  limit: number;
}

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

  // Shows the budget before the caller has generated anything — a dedicated GET that never
  // counts as an attempt (TDD §3.8), rather than waiting for the first digest's own headers.
  useEffect(() => {
    let cancelled = false;

    apiFetch(`/orgs/${orgSlug}/boards/${boardSlug}/ai-digest/quota`, aiDigestQuotaSchema)
      .then((data) => {
        if (!cancelled) {
          setQuota(data);
        }
      })
      .catch(() => {
        // Best-effort preview — a failed preflight read still lets the Generate button try, and
        // that attempt's own response headers will populate the quota line instead.
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
      setQuota(readQuota(headers));
      setSummary(digest.summary);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setQuota(readQuota(caught.headers));
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
    <Card as="section">
      <h2 className="flex items-center gap-1.5 font-medium text-zinc-900">
        <Sparkles className="h-4 w-4 text-brand-600" aria-hidden="true" />
        {t('title')}
      </h2>
      <Button
        variant="secondary"
        className="mt-2"
        onClick={() => void handleGenerate()}
        disabled={isGenerating || exhausted}
      >
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        {isGenerating ? t('generating') : t('submit')}
      </Button>
      {quota !== null && error === null && (
        <p className="mt-1.5 text-caption text-zinc-500">
          {exhausted
            ? t('quotaExhausted')
            : t('quotaRemaining', {
                remaining: String(quota.remaining),
                limit: String(quota.limit),
              })}
        </p>
      )}
      {error !== null && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
      {summary !== null && (
        <div className="mt-2 text-sm text-zinc-700 [&_h2]:mt-3 [&_h2]:font-medium [&_h3]:mt-2 [&_h3]:font-medium [&_li]:ml-4 [&_li]:list-disc [&_p]:mt-1">
          <Markdown>{summary}</Markdown>
        </div>
      )}
    </Card>
  );
}
