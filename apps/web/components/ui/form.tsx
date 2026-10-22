import type { FormEventHandler, ReactElement, ReactNode } from 'react';

export interface FormProps {
  onSubmit: FormEventHandler<HTMLFormElement>;
  /** A request is in flight: every field and button inside is disabled until it settles. */
  pending: boolean;
  /**
   * Called when any field changes. A server error shown above the button is about the values the
   * user just sent, so the form that owns it clears it here instead of leaving it up until the
   * next submit.
   */
  onEdit?: () => void;
  /** Layout classes for the fields (`flex flex-col gap-3`); they land on the inner fieldset. */
  className?: string;
  children: ReactNode;
}

/**
 * The one `<form>` for every form in the app. While `pending` the whole form is inert through a
 * `<fieldset disabled>` instead of each field being disabled by hand, so no input can be edited
 * or resubmitted mid-request and a new field is covered without anyone remembering. A disabled
 * field drops focus: pair it with `useRefocusAfterSubmit` to put focus back where the user needs
 * it. Validation is left to the schema (`noValidate`).
 */
export function Form({ onSubmit, pending, onEdit, className, children }: FormProps): ReactElement {
  return (
    <form onSubmit={onSubmit} onChange={onEdit} noValidate aria-busy={pending || undefined}>
      <fieldset
        disabled={pending}
        className={['m-0 min-w-0 border-0 p-0', className].filter(Boolean).join(' ')}
      >
        {children}
      </fieldset>
    </form>
  );
}
