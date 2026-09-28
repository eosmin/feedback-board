'use client';

import { boardDigestSchema } from '@feedback-board/shared';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { useState } from 'react';
import Markdown from 'react-markdown';

import { apiFetch, ApiError } from '../../lib/api-client';

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
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleGenerate(): Promise<void> {
    setError(null);
    setIsGenerating(true);
    try {
      const digest = await apiFetch(
        `/orgs/${orgSlug}/boards/${boardSlug}/ai-digest`,
        boardDigestSchema,
        { method: 'POST' },
      );
      setSummary(digest.summary);
    } catch (caught) {
      if (caught instanceof ApiError && caught.body.error === 'RATE_LIMITED') {
        setError(t('rateLimited'));
        return;
      }
      setError(t('error'));
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <section className="rounded-lg border border-brand-100 p-4">
      <h2 className="font-medium">{t('title')}</h2>
      <button type="button" onClick={() => void handleGenerate()} disabled={isGenerating}>
        {isGenerating ? t('generating') : t('submit')}
      </button>
      {error !== null && <p role="alert">{error}</p>}
      {summary !== null && (
        <div className="mt-2 text-sm">
          <Markdown>{summary}</Markdown>
        </div>
      )}
    </section>
  );
}
