import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { PostClassificationBadge } from '../../../../components/boards/post-classification-badge';
import messages from '../../../../messages/en.json';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe('PostClassificationBadge', () => {
  it('renders nothing when neither category nor priority is set', () => {
    act(() => {
      root.render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <PostClassificationBadge category={null} priority={null} />
        </NextIntlClientProvider>,
      );
    });

    expect(container.textContent).toBe('');
  });

  it('renders the translated category and priority labels when both are set', () => {
    act(() => {
      root.render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <PostClassificationBadge category="BUG" priority="HIGH" />
        </NextIntlClientProvider>,
      );
    });

    expect(container.textContent).toContain(messages.publicBoard.category.BUG);
    expect(container.textContent).toContain(messages.publicBoard.priority.HIGH);
  });
});
