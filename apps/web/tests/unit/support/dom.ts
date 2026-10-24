type ElementClass<T extends Element> = abstract new (...args: never[]) => T;

/** The first match, typed by an `instanceof` check instead of a cast; throws a readable error. */
export function getBySelector<T extends Element>(
  root: ParentNode,
  selector: string,
  type: ElementClass<T>,
): T {
  const found = root.querySelector(selector);
  if (!(found instanceof type)) {
    throw new Error(`no ${type.name} matching "${selector}"`);
  }
  return found;
}

function accessibleName(button: HTMLButtonElement): string {
  return (button.getAttribute('aria-label') ?? button.textContent ?? '').trim();
}

/** The button whose `aria-label` (or, failing that, text) is exactly `name`, or matches the pattern. */
export function getButton(root: ParentNode, name: string | RegExp): HTMLButtonElement {
  const buttons = Array.from(root.querySelectorAll('button'));
  const found = buttons.find((button) => {
    const label = accessibleName(button);
    return typeof name === 'string' ? label === name : name.test(label);
  });
  if (found === undefined) {
    const available = buttons.map(accessibleName).join(' | ');
    throw new Error(`no button "${String(name)}"; found: ${available || 'none'}`);
  }
  return found;
}

/** Picks `value` in a native `<select>` the way a user would, so React's `onChange` fires. */
export function chooseOption(select: HTMLSelectElement, value: string): void {
  const setValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  if (setValue === undefined) {
    throw new Error('HTMLSelectElement has no value setter');
  }
  setValue.call(select, value);
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Types `text` into an input or textarea through the prototype's own setter, so React and
 * react-hook-form see a real change. Redefining `value` on the element instead would make the
 * form's later writes to that field throw.
 */
export function typeInto(field: HTMLInputElement | HTMLTextAreaElement, text: string): void {
  const prototype =
    field instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setValue = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  if (setValue === undefined) {
    throw new Error('field has no value setter');
  }
  setValue.call(field, text);
  field.dispatchEvent(new Event('input', { bubbles: true }));
}
