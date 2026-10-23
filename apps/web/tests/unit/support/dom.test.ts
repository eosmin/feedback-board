import { afterEach, describe, expect, it } from 'vitest';

import { chooseOption, getBySelector, getButton, typeInto } from './dom';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('getBySelector', () => {
  it('returns the match typed as the requested element', () => {
    document.body.innerHTML = '<form><input id="title" /></form>';

    expect(getBySelector(document.body, '#title', HTMLInputElement).id).toBe('title');
  });

  it('throws when nothing matches', () => {
    expect(() => getBySelector(document.body, '#missing', HTMLInputElement)).toThrow(
      'no HTMLInputElement matching "#missing"',
    );
  });

  it('throws when the match is a different element type', () => {
    document.body.innerHTML = '<div id="title"></div>';

    expect(() => getBySelector(document.body, '#title', HTMLInputElement)).toThrow(
      'no HTMLInputElement',
    );
  });
});

describe('getButton', () => {
  it('finds a button by text, by aria-label and by pattern', () => {
    document.body.innerHTML =
      '<button> Save </button><button aria-label="Vote (3)"><span>3</span></button>';

    expect(getButton(document.body, 'Save').textContent).toBe(' Save ');
    expect(getButton(document.body, 'Vote (3)').textContent).toBe('3');
    expect(getButton(document.body, /^Vote/).getAttribute('aria-label')).toBe('Vote (3)');
  });

  it('names what it did find when nothing matches', () => {
    document.body.innerHTML = '<button>Save</button>';

    expect(() => getButton(document.body, 'New board')).toThrow(
      'no button "New board"; found: Save',
    );
  });
});

describe('chooseOption', () => {
  it('selects the option and fires change', () => {
    document.body.innerHTML =
      '<select><option value="a">A</option><option value="b">B</option></select>';
    const select = getBySelector(document.body, 'select', HTMLSelectElement);
    const seen: string[] = [];
    select.addEventListener('change', () => seen.push(select.value));

    chooseOption(select, 'b');

    expect(seen).toEqual(['b']);
  });
});

describe('typeInto', () => {
  it('sets the value and fires input for inputs and textareas', () => {
    document.body.innerHTML = '<input /><textarea></textarea>';
    const seen: string[] = [];
    document.body.addEventListener('input', (event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        seen.push(event.target.value);
      }
    });

    typeInto(getBySelector(document.body, 'input', HTMLInputElement), 'one');
    typeInto(getBySelector(document.body, 'textarea', HTMLTextAreaElement), 'two');

    expect(seen).toEqual(['one', 'two']);
  });
});
