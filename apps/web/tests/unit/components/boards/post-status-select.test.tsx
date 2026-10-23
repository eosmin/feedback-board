import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { POST_STATUSES } from '@feedback-board/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../../../lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('../../../../lib/api-client')>(
    '../../../../lib/api-client',
  );
  return { ...actual, apiFetch: vi.fn() };
});
vi.mock('../../../../components/ui/select', () => import('../../support/select-stub'));

import { PostStatusSelect } from '../../../../components/boards/post-status-select';
import { apiFetch } from '../../../../lib/api-client';
import messages from '../../../../messages/en.json';
import { makeBoardPost } from '../../support/board-fixtures';
import { chooseOption, getBySelector } from '../../support/dom';
import { Providers } from '../../support/providers';

const mockApiFetch = vi.mocked(apiFetch);
const copy = messages.dashboard.boardDetail;

let container: HTMLDivElement;
let root: Root;

function renderSelect(onUpdated = vi.fn()): ReturnType<typeof vi.fn> {
  act(() => {
    root.render(
      <Providers>
        <PostStatusSelect orgSlug="acme" post={makeBoardPost()} onUpdated={onUpdated} />
      </Providers>,
    );
  });
  return onUpdated;
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

describe('PostStatusSelect', () => {
  it('offers every status, translated, with the current one selected', () => {
    renderSelect();

    const select = getBySelector(container, 'select', HTMLSelectElement);
    expect(select.getAttribute('aria-label')).toBe(copy.statusLabel);
    expect(Array.from(select.options).map((option) => option.value)).toEqual([...POST_STATUSES]);
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual(
      POST_STATUSES.map((status) => messages.publicBoard.status[status]),
    );
    expect(select.value).toBe('OPEN');
  });

  it('PATCHes the new status, reports only that status and confirms in a toast', async () => {
    // Its vote count differs from the post on screen: the component must not pass it on.
    const updated = makeBoardPost({ status: 'DONE', voteCount: 99 });
    mockApiFetch.mockResolvedValue(updated);
    const onUpdated = renderSelect();

    await act(async () => {
      chooseOption(getBySelector(container, 'select', HTMLSelectElement), 'DONE');
    });

    expect(mockApiFetch).toHaveBeenCalledWith(`/orgs/acme/posts/${updated.id}`, expect.anything(), {
      method: 'PATCH',
      body: { status: 'DONE' },
    });
    // Not the whole response: its vote count and the rest may be stale by the time it lands.
    expect(onUpdated).toHaveBeenCalledWith({ id: updated.id, status: 'DONE' });
    expect(document.body.textContent).toContain(copy.statusSuccess);
  });

  it('says so in a toast when the update fails, without reporting a change', async () => {
    mockApiFetch.mockRejectedValue(new Error('network down'));
    const onUpdated = renderSelect();

    await act(async () => {
      chooseOption(getBySelector(container, 'select', HTMLSelectElement), 'DONE');
    });

    expect(onUpdated).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(copy.statusError);
  });
});
