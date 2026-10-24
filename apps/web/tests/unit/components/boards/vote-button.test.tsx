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

import { VoteButton } from '../../../../components/boards/vote-button';
import { apiFetch } from '../../../../lib/api-client';
import messages from '../../../../messages/en.json';
import { makeBoardPost } from '../../support/board-fixtures';
import { getButton } from '../../support/dom';
import { Providers } from '../../support/providers';

const mockApiFetch = vi.mocked(apiFetch);

let container: HTMLDivElement;
let root: Root;

function renderButton(voteCount: number, onUpdated = vi.fn()): ReturnType<typeof vi.fn> {
  act(() => {
    root.render(
      <Providers>
        <VoteButton orgSlug="acme" post={makeBoardPost({ voteCount })} onUpdated={onUpdated} />
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

describe('VoteButton', () => {
  it('shows the count in the chip and the full phrase as its accessible name', () => {
    renderButton(3);

    const button = getButton(container, 'Vote (3)');
    expect(button.textContent).toBe('3');
  });

  it('toggles the vote and reports only the new vote count, not the post it was drawn with', async () => {
    mockApiFetch.mockResolvedValue({ postId: 'p', voted: true, voteCount: 4 });
    const onUpdated = renderButton(3);

    await act(async () => {
      getButton(container, 'Vote (3)').click();
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/orgs/acme/posts/11111111-1111-4111-8111-111111111111/votes',
      expect.anything(),
      { method: 'POST' },
    );
    // A patch of `id` and `voteCount` only: the post this button was rendered with may be stale by
    // the time the response lands, and spreading it would put an old status or title back.
    expect(onUpdated).toHaveBeenCalledWith({
      id: '11111111-1111-4111-8111-111111111111',
      voteCount: 4,
    });
  });

  it('is disabled while the request is in flight', async () => {
    mockApiFetch.mockReturnValue(new Promise(() => {}));
    renderButton(3);

    await act(async () => {
      getButton(container, 'Vote (3)').click();
    });

    const button = getButton(container, 'Vote (3)');
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
  });

  it('says so in a toast when the vote fails, and leaves the count alone', async () => {
    mockApiFetch.mockRejectedValue(new Error('network down'));
    const onUpdated = renderButton(3);

    await act(async () => {
      getButton(container, 'Vote (3)').click();
    });

    expect(onUpdated).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(messages.dashboard.boardDetail.voteError);
    expect(getButton(container, 'Vote (3)').disabled).toBe(false);
  });
});
