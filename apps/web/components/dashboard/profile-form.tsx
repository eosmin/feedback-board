'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  profileSchema,
  updateProfileSchema,
  type Profile,
  type UpdateProfileInput,
} from '@feedback-board/shared';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { apiFetch } from '../../lib/api-client';
import { useRefocusAfterSubmit } from '../../lib/use-refocus-after-submit';
import { Button, Form, Input } from '../ui';

interface ProfileFormProps {
  profile: Profile;
  /** Called with the saved profile, so the parent can confirm and close. */
  onSaved: (profile: Profile) => void;
}

/**
 * Edits the one thing a person controls about themselves: the display name shown next to their
 * posts and comments. The email is shown, never editable (it is the sign-in identity).
 */
export function ProfileForm({ profile, onSaved }: ProfileFormProps): ReactElement {
  const t = useTranslations('dashboard.shell.profile');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { name: profile.name ?? '' },
  });
  const requestFocus = useRefocusAfterSubmit(setFocus, isSubmitting);

  async function onSubmit(values: UpdateProfileInput): Promise<void> {
    setSubmitError(null);

    let saved: Profile;
    try {
      saved = await apiFetch('/me', profileSchema, { method: 'PATCH', body: values });
    } catch {
      setSubmitError(t('error'));
      requestFocus('name');
      return;
    }

    // Outside the `try`: the name is saved, so a failure in the parent must not read as "could
    // not save".
    onSaved(saved);
  }

  return (
    <Form
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      pending={isSubmitting}
      onEdit={() => setSubmitError(null)}
      className="flex flex-col gap-3"
    >
      <p className="text-sm text-text-muted">
        <span className="font-medium text-text">{t('emailLabel')}</span> {profile.email}
      </p>

      <label htmlFor="profile-name" className="text-sm font-medium text-text">
        {t('nameLabel')}
      </label>
      <Input
        id="profile-name"
        type="text"
        autoComplete="name"
        aria-invalid={errors.name !== undefined}
        aria-describedby={
          errors.name !== undefined ? 'profile-name-help profile-name-error' : 'profile-name-help'
        }
        {...register('name')}
      />
      <p id="profile-name-help" className="text-sm text-text-muted">
        {t('nameHelp')}
      </p>
      {errors.name !== undefined && (
        <p id="profile-name-error" role="alert" className="text-sm text-danger">
          {t('nameInvalid')}
        </p>
      )}
      {submitError !== null && (
        <p role="alert" className="text-sm text-danger">
          {submitError}
        </p>
      )}

      <Button type="submit" pending={isSubmitting}>
        {isSubmitting ? t('saving') : t('submit')}
      </Button>
    </Form>
  );
}
