import type { ReactElement } from 'react';

interface StubProps {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  'aria-label': string;
  disabled?: boolean;
}

/**
 * A native `<select>` standing in for the Radix `Select` in jsdom, which has no pointer capture to
 * open a listbox with. Use it through `vi.mock('.../components/ui/select', ...)` in tests of the
 * code that *uses* the primitive; the primitive has its own test.
 */
export function Select({
  value,
  onValueChange,
  options,
  'aria-label': ariaLabel,
  disabled,
}: StubProps): ReactElement {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      disabled={disabled}
      onChange={(event) => onValueChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
