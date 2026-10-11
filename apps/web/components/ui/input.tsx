'use client';

import { forwardRef, useCallback, useLayoutEffect, useRef } from 'react';
import type { InputHTMLAttributes, KeyboardEvent, Ref, TextareaHTMLAttributes } from 'react';

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

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Starts at one row and grows with the content (capped), instead of a fixed tall box. */
  autoGrow?: boolean;
  /** `Cmd/Ctrl+Enter` submits the enclosing form; plain Enter still inserts a newline. */
  submitOnShortcut?: boolean;
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (typeof ref === 'function') {
    ref(value);
  } else if (ref) {
    (ref as { current: T | null }).current = value;
  }
}

/**
 * Same `forwardRef` contract as `Input` (react-hook-form's `register` ref must reach the DOM
 * node), merged with an internal ref the auto-grow measurement needs.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, autoGrow = false, submitOnShortcut = false, onKeyDown, onInput, value, ...props },
  ref,
) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);

  const setRef = useCallback(
    (node: HTMLTextAreaElement | null) => {
      innerRef.current = node;
      assignRef(ref, node);
    },
    [ref],
  );

  const grow = useCallback(() => {
    const node = innerRef.current;
    if (!autoGrow || node === null) {
      return;
    }
    node.style.height = 'auto';
    // scrollHeight excludes the border; box-sizing is border-box, so add it back.
    const border = node.offsetHeight - node.clientHeight;
    node.style.height = `${node.scrollHeight + border}px`;
  }, [autoGrow]);

  // Every render, not only on `value`: uncontrolled use (react-hook-form `reset`/`setValue`) changes
  // the text without an `input` event, and the re-render it triggers is the only signal.
  useLayoutEffect(grow);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    onKeyDown?.(event);
    if (
      submitOnShortcut &&
      !event.defaultPrevented &&
      event.key === 'Enter' &&
      (event.metaKey || event.ctrlKey)
    ) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  const sizing = autoGrow ? 'max-h-64 resize-none overflow-y-auto' : 'min-h-24 resize-y';
  const classes = [FIELD_CLASSNAME, sizing, className].filter(Boolean).join(' ');

  return (
    <textarea
      {...props}
      ref={setRef}
      className={classes}
      rows={autoGrow ? 1 : props.rows}
      value={value}
      onKeyDown={handleKeyDown}
      onInput={(event) => {
        grow();
        onInput?.(event);
      }}
    />
  );
});
