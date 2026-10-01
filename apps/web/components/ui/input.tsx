import { forwardRef } from 'react';
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

const FIELD_CLASSNAME =
  'w-full rounded-control border border-zinc-300 px-3 py-2 text-body text-zinc-900 transition-colors placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 aria-invalid:border-red-400 aria-invalid:ring-red-100';

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
