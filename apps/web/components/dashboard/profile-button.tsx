'use client';

import { profileSchema, type Profile } from '@feedback-board/shared';
import { UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

import { apiFetch } from '../../lib/api-client';
import { Dialog, useToast } from '../ui';
import { ProfileForm } from './profile-form';

type ProfileState =
  { status: 'loading' } | { status: 'failed' } | { status: 'ready'; profile: Profile };

/**
 * The account entry of the shared header: opens a dialog to set the display name.
 *
 * The profile is fetched when the button mounts, not when the dialog opens. Fetching on open put
 * a loading state inside the dialog, which resized when the form replaced it and left focus on the
 * close button (the field did not exist yet when `OverlayPanel` looked for one). The button stays
 * disabled until the request settles, so the dialog always opens at its final size with the field
 * focused.
 */
export function ProfileButton(): ReactElement {
  const t = useTranslations('dashboard.shell.profile');
  const tCommon = useTranslations('common');
  const { toast } = useToast();
  const [state, setState] = useState<ProfileState>({ status: 'loading' });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    apiFetch('/me', profileSchema)
      .then((profile) => {
        if (!cancelled) {
          setState({ status: 'ready', profile });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ status: 'failed' });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <button
        type="button"
        aria-label={t('trigger')}
        title={t('trigger')}
        disabled={state.status === 'loading'}
        onClick={() => setOpen(true)}
        className="flex h-11 w-11 items-center justify-center rounded-control text-text-muted md:h-auto md:w-auto md:p-2 transition-colors hover:bg-surface-sunken hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
      >
        <UserRound className="h-4 w-4" aria-hidden="true" />
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t('title')}
        closeLabel={tCommon('close')}
      >
        {state.status === 'ready' ? (
          <ProfileForm
            profile={state.profile}
            onSaved={(profile) => {
              setState({ status: 'ready', profile });
              setOpen(false);
              toast(t('saved'), 'success');
            }}
          />
        ) : (
          <p role="alert" className="text-sm text-danger">
            {t('loadError')}
          </p>
        )}
      </Dialog>
    </>
  );
}
