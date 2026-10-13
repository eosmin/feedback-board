import type { ButtonHTMLAttributes, ReactElement } from 'react';

import { Spinner } from './spinner';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  /** An async action is in flight: shows a spinner, sets `aria-busy` and blocks re-clicks. */
  pending?: boolean;
}

const BASE_CLASSNAME =
  'inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-control px-4 py-2 text-body font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50';

const VARIANT_CLASSNAME: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-accent text-accent-fg shadow-surface hover:bg-accent-hover',
  secondary: 'border border-border-strong bg-surface-raised text-text hover:bg-surface',
};

/** The button look for elements that are not a `<button>`, e.g. a `Link` styled as an action. */
export function buttonClassName(
  variant: NonNullable<ButtonProps['variant']> = 'primary',
  className?: string,
): string {
  return [BASE_CLASSNAME, VARIANT_CLASSNAME[variant], className].filter(Boolean).join(' ');
}

/**
 * The one button style used across every form and action in the app (submit buttons, vote
 * toggle, webhook delete, AI digest generate, Checkout/Portal). `type="button"` is the default
 * to match the native element — callers that submit a form still pass `type="submit"` explicitly.
 */
export function Button({
  variant = 'primary',
  type = 'button',
  className,
  pending = false,
  disabled,
  children,
  ...props
}: ButtonProps): ReactElement {
  return (
    <button
      type={type}
      {...props}
      className={buttonClassName(variant, className)}
      disabled={disabled === true || pending}
      aria-busy={pending || undefined}
    >
      {pending && <Spinner />}
      {children}
    </button>
  );
}
