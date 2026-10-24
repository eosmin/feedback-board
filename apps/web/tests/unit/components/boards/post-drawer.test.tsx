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
vi.mock('../../../../components/ui/select', () => import('../../support/select-stub'));

import { PostDrawer } from '../../../../components/boards/post-drawer';
import { apiFetch } from '../../../../lib/api-client';
import messages from '../../../../messages/en.json';
import { makeBoardPost, makeComment } from '../../support/board-fixtures';
import { getBySelector, getButton, typeInto } from '../../support/dom';
import { Providers } from '../../support/providers';

const mockApiFetch = vi.mocked(apiFetch);

let container: HTMLDivElement;
let root: Root;

interface DrawerOptions {
  post?: ReturnType<typeof makeBoardPost> | null;
  canManage?: boolean;
  onClose?: () => void;
  onCommentAdded?: (postId: string) => void;
}

async function renderDrawer(options: DrawerOptions = {}): Promise<void> {
  const post = options.post === undefined ? makeBoardPost() : options.post;
  await act(async () => {
    root.render(
      <Providers>
        <PostDrawer
          orgSlug="acme"
          post={post}
          canManage={options.canManage ?? false}
          onClose={options.onClose ?? vi.fn()}
          onUpdated={vi.fn()}
          onCommentAdded={options.onCommentAdded ?? vi.fn()}
        />
      </Providers>,
    );
    await Promise.resolve();
    await Promise.resolve();
  });
}

// The drawer renders through a portal into `document.body`, outside `container`.
function dialog(): HTMLElement {
  return getBySelector(document.body, '[role="dialog"]', HTMLElement);
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mockApiFetch.mockResolvedValue([]);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.restoreAllMocks();
});

describe('PostDrawer', () => {
  it('renders nothing while no post is open', async () => {
    await renderDrawer({ post: null });

    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('shows the full post: title, whole description, author and date', async () => {
    const body = 'First line.\n' + 'A long paragraph. '.repeat(40);
    await renderDrawer({
      post: makeBoardPost({
        title: 'Add dark mode',
        body,
        authorName: 'Ada Lovelace',
        createdAt: '2026-03-04T12:00:00.000Z',
      }),
    });

    expect(dialog().querySelector('h2')?.textContent).toBe('Add dark mode');
    expect(dialog().textContent).toContain('Ada Lovelace · Mar 4, 2026');
    // Not clamped, and line breaks are kept.
    const description = getBySelector(dialog(), 'p.whitespace-pre-wrap', HTMLParagraphElement);
    expect(description.textContent).toBe(body);
    expect(description.className).not.toContain('line-clamp');
  });

  it('shows the status as a read-only badge for a plain member', async () => {
    await renderDrawer({ post: makeBoardPost({ status: 'PLANNED' }), canManage: false });

    expect(dialog().querySelector('select')).toBeNull();
    expect(dialog().textContent).toContain('Planned');
  });

  it('shows the status as an editable select for an owner or admin', async () => {
    await renderDrawer({ post: makeBoardPost({ status: 'PLANNED' }), canManage: true });

    const select = getBySelector(dialog(), 'select', HTMLSelectElement);
    expect(select.getAttribute('aria-label')).toBe(messages.dashboard.boardDetail.statusLabel);
    expect(select.value).toBe('PLANNED');
  });

  it('loads the comments of the open post', async () => {
    mockApiFetch.mockResolvedValue([makeComment({ body: 'Great idea!' })]);

    await renderDrawer({ post: makeBoardPost({ id: 'post-9' }) });

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/orgs/acme/posts/post-9/comments',
      expect.anything(),
    );
    expect(dialog().textContent).toContain('Great idea!');
  });

  it('reports the post whose comment was added', async () => {
    const onCommentAdded = vi.fn();
    mockApiFetch.mockResolvedValueOnce([]).mockResolvedValueOnce(makeComment({ body: 'Agreed.' }));
    await renderDrawer({ post: makeBoardPost({ id: 'post-9' }), onCommentAdded });

    await act(async () => {
      typeInto(getBySelector(dialog(), 'textarea', HTMLTextAreaElement), 'Agreed.');
    });
    await act(async () => {
      getBySelector(dialog(), 'form', HTMLFormElement).requestSubmit();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(onCommentAdded).toHaveBeenCalledExactlyOnceWith('post-9');
  });

  it('closes from the close button and on Escape', async () => {
    const onClose = vi.fn();
    await renderDrawer({ onClose });

    act(() => {
      getButton(document.body, messages.common.close).click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    act(() => {
      dialog().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
