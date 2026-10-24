import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../../../lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('../../../../lib/api-client')>(
    '../../../../lib/api-client',
  );
  return { ...actual, apiFetch: vi.fn() };
});

import { PostComments } from '../../../../components/boards/post-comments';
import { apiFetch } from '../../../../lib/api-client';
import messages from '../../../../messages/en.json';
import { makeComment } from '../../support/board-fixtures';
import { getBySelector, getButton, typeInto } from '../../support/dom';
import { Providers } from '../../support/providers';

const mockApiFetch = vi.mocked(apiFetch);
const copy = messages.dashboard.boardDetail.comments;

let container: HTMLDivElement;
let root: Root;

async function renderComments(onAdded = vi.fn()): Promise<ReturnType<typeof vi.fn>> {
  await act(async () => {
    root.render(
      <Providers>
        <PostComments orgSlug="acme" postId="post-1" onAdded={onAdded} />
      </Providers>,
    );
    await Promise.resolve();
    await Promise.resolve();
  });
  return onAdded;
}

function composer(): HTMLTextAreaElement {
  return getBySelector(container, 'textarea', HTMLTextAreaElement);
}

async function type(text: string): Promise<void> {
  await act(async () => {
    typeInto(composer(), text);
  });
}

async function send(): Promise<void> {
  await act(async () => {
    getBySelector(container, 'form', HTMLFormElement).requestSubmit();
    // react-hook-form validates through an async resolver; a macrotask outlasts its microtasks.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

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
  vi.restoreAllMocks();
});

describe('PostComments', () => {
  it('fetches the thread once and shows the empty message when there are no comments', async () => {
    mockApiFetch.mockResolvedValue([]);

    await renderComments();

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/orgs/acme/posts/post-1/comments',
      expect.anything(),
    );
    expect(container.textContent).toContain(copy.empty);
  });

  it('shows each comment with its author and date', async () => {
    mockApiFetch.mockResolvedValue([
      makeComment({ authorName: 'Grace Hopper', body: 'Great idea!' }),
    ]);

    await renderComments();

    expect(container.textContent).toContain('Grace Hopper');
    expect(container.textContent).toContain('Jan 2, 2026');
    expect(container.textContent).toContain('Great idea!');
  });

  it('shows an error with a retry when the thread cannot be loaded, not an empty thread', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('network down'));

    await renderComments();

    expect(container.textContent).toContain(copy.loadError);
    expect(container.textContent).not.toContain(copy.empty);
    // A comment sent now would be hidden behind the error, so the composer waits for a list.
    expect(getBySelector(container, 'textarea', HTMLTextAreaElement).disabled).toBe(true);
    expect(getButton(container, copy.submit).disabled).toBe(true);

    mockApiFetch.mockResolvedValueOnce([makeComment({ body: 'Back again' })]);
    await act(async () => {
      getButton(container, copy.retry).click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Back again');
    expect(container.textContent).not.toContain(copy.loadError);
    expect(getBySelector(container, 'textarea', HTMLTextAreaElement).disabled).toBe(false);
  });

  it('keeps the send button disabled until there is text', async () => {
    mockApiFetch.mockResolvedValue([]);
    await renderComments();

    expect(getButton(container, copy.submit).disabled).toBe(true);

    await type('   ');
    expect(getButton(container, copy.submit).disabled).toBe(true);

    await type('Agreed.');
    expect(getButton(container, copy.submit).disabled).toBe(false);
  });

  it('shows a sent comment at once as sending, then replaces it with the server copy', async () => {
    let resolvePost: (comment: unknown) => void = () => {};
    mockApiFetch.mockResolvedValueOnce([makeComment({ body: 'Great idea!' })]).mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePost = resolve;
      }),
    );
    const onAdded = await renderComments();

    await type('Agreed.');
    await send();

    const pending = Array.from(container.querySelectorAll('li')).find((item) =>
      item.textContent?.includes('Agreed.'),
    );
    expect(pending?.getAttribute('aria-busy')).toBe('true');
    expect(pending?.textContent).toContain(copy.sending);
    expect(pending?.textContent).toContain(copy.you);
    expect(composer().value).toBe('');
    expect(onAdded).not.toHaveBeenCalled();

    await act(async () => {
      resolvePost(makeComment({ id: 'c2', body: 'Agreed.', authorName: 'Ada Lovelace' }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const settled = Array.from(container.querySelectorAll('li')).filter((item) =>
      item.textContent?.includes('Agreed.'),
    );
    expect(settled).toHaveLength(1);
    expect(settled[0]?.getAttribute('aria-busy')).toBeNull();
    expect(settled[0]?.textContent).toContain('Ada Lovelace');
    expect(container.textContent).toContain('Great idea!');
    expect(onAdded).toHaveBeenCalledTimes(1);
  });

  it('takes a failed comment back out, restores the text and says what happened', async () => {
    mockApiFetch.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('network down'));
    const onAdded = await renderComments();

    await type('Agreed.');
    await send();

    expect(container.querySelectorAll('li')).toHaveLength(0);
    expect(composer().value).toBe('Agreed.');
    expect(container.textContent).toContain(copy.submitError);
    expect(onAdded).not.toHaveBeenCalled();
    expect(getButton(container, copy.submit).disabled).toBe(false);
  });

  it('clears the error as soon as the text is edited', async () => {
    mockApiFetch.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('network down'));
    await renderComments();
    await type('Agreed.');
    await send();
    expect(container.textContent).toContain(copy.submitError);

    await type('Agreed, thanks.');

    expect(container.textContent).not.toContain(copy.submitError);
  });

  it('sends with Cmd+Enter and returns focus to the composer once the form is live again', async () => {
    let resolvePost: (comment: unknown) => void = () => {};
    mockApiFetch.mockResolvedValueOnce([]).mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePost = resolve;
      }),
    );
    await renderComments();
    await type('Agreed.');

    await act(async () => {
      composer().dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          metaKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockApiFetch).toHaveBeenLastCalledWith(
      '/orgs/acme/posts/post-1/comments',
      expect.anything(),
      {
        method: 'POST',
        body: { body: 'Agreed.' },
      },
    );
    // While the request is out the form is inert: a disabled field cannot hold focus.
    expect(getBySelector(container, 'fieldset', HTMLFieldSetElement).disabled).toBe(true);

    await act(async () => {
      resolvePost(makeComment({ body: 'Agreed.' }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getBySelector(container, 'fieldset', HTMLFieldSetElement).disabled).toBe(false);
    expect(document.activeElement).toBe(composer());
  });

  it('returns focus to the composer after a failed send too', async () => {
    let rejectPost: (error: Error) => void = () => {};
    mockApiFetch.mockResolvedValueOnce([]).mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        rejectPost = reject;
      }),
    );
    await renderComments();
    await type('Agreed.');
    await send();

    await act(async () => {
      rejectPost(new Error('network down'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.activeElement).toBe(composer());
  });
});
