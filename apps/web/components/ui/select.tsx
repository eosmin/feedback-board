'use client';

import * as RadixSelect from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import type { ReactElement } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
  /** Required: a Select has no visible `<label>` of its own, so it needs an accessible name. */
  'aria-label': string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/**
 * Only for editing: read-only data is a `Badge`, never a disabled Select. Option values must be
 * non-empty strings (Radix reserves `""` for clearing). The listbox renders in a portal, so the
 * open panel is never clipped by a card's `overflow`.
 */
export function Select({
  value,
  onValueChange,
  options,
  'aria-label': ariaLabel,
  disabled = false,
  id,
  className,
}: SelectProps): ReactElement {
  const triggerClasses = [
    'inline-flex h-10 min-w-32 items-center justify-between gap-2 rounded-control border border-border-strong bg-surface-raised px-3 text-body text-text transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <RadixSelect.Trigger id={id} aria-label={ariaLabel} className={triggerClasses}>
        <RadixSelect.Value />
        <RadixSelect.Icon>
          <ChevronDown className="h-4 w-4 text-text-muted" aria-hidden="true" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          className="z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-control border border-border bg-surface-raised shadow-popover"
        >
          <RadixSelect.Viewport className="p-1">
            {options.map((option) => (
              <RadixSelect.Item
                key={option.value}
                value={option.value}
                className="relative flex h-10 cursor-pointer select-none items-center rounded-control pl-8 pr-3 text-body text-text outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-sunken"
              >
                <RadixSelect.ItemIndicator className="absolute left-2">
                  <Check className="h-4 w-4 text-accent-text" aria-hidden="true" />
                </RadixSelect.ItemIndicator>
                <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
