import { forwardRef } from 'react';
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

const FIELD_CLASSNAME =
  'w-full rounded-control border border-border-strong bg-surface-raised px-3 py-2 text-body text-text transition-colors placeholder:text-text-subtle focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus aria-invalid:border-danger aria-invalid:focus:border-danger aria-invalid:focus:ring-danger';

/**
 * `forwardRef` is required here, not cosmetic: every caller spreads `react-hook-form`'s
 * `register(...)` onto this element, and `register` returns a `ref` the form needs to read the
 * DOM value directly — a plain function component would silently drop it.
 */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    const classes = [FIELD_CLASSNAME, className].filter(Boolean).join(' ');
    return <input ref={ref} className={classes} {...props} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    const classes = [FIELD_CLASSNAME, 'min-h-24 resize-y', className].filter(Boolean).join(' ');
    return <textarea ref={ref} className={classes} {...props} />;
  },
);
