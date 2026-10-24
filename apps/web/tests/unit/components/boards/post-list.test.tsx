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

import { PostList } from '../../../../components/boards/post-list';
import { apiFetch } from '../../../../lib/api-client';
import { makeBoardPost } from '../../support/board-fixtures';
import { getBySelector, getButton } from '../../support/dom';
import { Providers } from '../../support/providers';

const mockApiFetch = vi.mocked(apiFetch);

let container: HTMLDivElement;
let root: Root;

function renderList(
  posts = [makeBoardPost()],
  handlers: { onOpen?: (id: string) => void; onUpdated?: () => void } = {},
): void {
  act(() => {
    root.render(
      <Providers>
        <PostList
          orgSlug="acme"
          posts={posts}
          onOpen={handlers.onOpen ?? vi.fn()}
          onUpdated={handlers.onUpdated ?? vi.fn()}
        />
      </Providers>,
    );
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

describe('PostList', () => {
  it('renders one row per post, each with a heading for its title', () => {
    renderList([
      makeBoardPost({ id: 'a', title: 'Add dark mode' }),
      makeBoardPost({ id: 'b', title: 'Export to CSV' }),
    ]);

    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(Array.from(container.querySelectorAll('h2')).map((h) => h.textContent)).toEqual([
      'Add dark mode',
      'Export to CSV',
    ]);
  });

  it('shows description, status, author, date and comment count in the row', () => {
    renderList([
      makeBoardPost({
        body: 'Please add a dark theme.',
        status: 'PLANNED',
        authorName: 'Ada Lovelace',
        commentCount: 5,
        createdAt: '2026-03-04T12:00:00.000Z',
      }),
    ]);

    const text = container.textContent ?? '';
    expect(text).toContain('Please add a dark theme.');
    expect(text).toContain('Planned');
    expect(text).toContain('Ada Lovelace · Mar 4, 2026');
    expect(getBySelector(container, '[aria-label="Comments: 5"]', HTMLElement).textContent).toBe(
      '5',
    );
  });

  it('clamps the description to two lines', () => {
    renderList();

    expect(getBySelector(container, 'p', HTMLParagraphElement).className).toContain('line-clamp-2');
  });

  it('shows the AI category and priority badges only when the post is classified', () => {
    renderList([
      makeBoardPost({ id: 'a', aiCategory: 'BUG', aiPriority: 'HIGH' }),
      makeBoardPost({ id: 'b', aiCategory: null, aiPriority: null }),
    ]);

    const [classified, unclassified] = Array.from(container.querySelectorAll('li'));
    expect(classified?.textContent).toContain('Bug');
    expect(classified?.textContent).toContain('High priority');
    expect(unclassified?.textContent).not.toContain('priority');
  });

  it('never renders a status control: the row is read-only', () => {
    renderList();

    expect(container.querySelector('select, [role="combobox"]')).toBeNull();
  });

  it('opens the post when its title is clicked', () => {
    const onOpen = vi.fn();
    renderList([makeBoardPost({ id: 'abc', title: 'Add dark mode' })], { onOpen });

    act(() => {
      getButton(container, 'Add dark mode').click();
    });

    expect(onOpen).toHaveBeenCalledExactlyOnceWith('abc');
  });

  it('votes from the chip without opening the post', async () => {
    mockApiFetch.mockResolvedValue({ postId: 'abc', voted: true, voteCount: 4 });
    const onOpen = vi.fn();
    const onUpdated = vi.fn();
    renderList([makeBoardPost({ id: 'abc', voteCount: 3 })], { onOpen, onUpdated });

    await act(async () => {
      getButton(container, 'Vote (3)').click();
    });

    expect(onUpdated).toHaveBeenCalledWith({ id: 'abc', voteCount: 4 });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('keeps the vote chip outside the control that opens the post', () => {
    // jsdom draws no `::after` overlay, so a click cannot show this; the structure is what keeps
    // a click on the chip from bubbling into the open handler.
    renderList([makeBoardPost({ id: 'abc', title: 'Add dark mode', voteCount: 3 })]);

    const open = getButton(container, 'Add dark mode');
    const vote = getButton(container, 'Vote (3)');

    expect(open.contains(vote)).toBe(false);
    expect(vote.contains(open)).toBe(false);
  });
});
