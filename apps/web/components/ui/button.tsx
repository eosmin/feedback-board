import type { ButtonHTMLAttributes, ReactElement } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

const BASE_CLASSNAME =
  'inline-flex h-10 items-center justify-center gap-1.5 rounded-control px-4 py-2 text-body font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const VARIANT_CLASSNAME: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-brand-600 text-white shadow-surface hover:bg-brand-700',
  secondary: 'border border-zinc-300 bg-white text-zinc-800 hover:border-zinc-400 hover:bg-zinc-50',
};

/**
 * The one button style used across every form and action in the app (submit buttons, vote
 * toggle, webhook delete, AI digest generate, Checkout/Portal). `type="button"` is the default
 * to match the native element — callers that submit a form still pass `type="submit"` explicitly.
 */
export function Button({
  variant = 'primary',
  type = 'button',
  className,
  ...props
}: ButtonProps): ReactElement {
  const classes = [BASE_CLASSNAME, VARIANT_CLASSNAME[variant], className].filter(Boolean).join(' ');

  return <button type={type} className={classes} {...props} />;
}
