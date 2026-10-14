import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));
vi.mock('../../../lib/api-client-server', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/api-client-server')>(
    '../../../lib/api-client-server',
  );
  return { ...actual, serverApiFetch: vi.fn() };
});

import { ServerApiError, serverApiFetch } from '../../../lib/api-client-server';
import { getOrgDetail, rethrowNoAccessAsNotFound } from '../../../lib/org-detail';

const mockFetch = vi.mocked(serverApiFetch);

afterEach(() => {
  vi.clearAllMocks();
});

describe('rethrowNoAccessAsNotFound', () => {
  it('turns a 403 into the not-found screen', () => {
    expect(() =>
      rethrowNoAccessAsNotFound(new ServerApiError(403, { error: 'FORBIDDEN' })),
    ).toThrow('NEXT_NOT_FOUND');
  });

  it('leaves every other failure alone', () => {
    const error = new ServerApiError(409, { error: 'CONFLICT' });
    expect(() => rethrowNoAccessAsNotFound(error)).toThrow(error);
  });
});

describe('getOrgDetail', () => {
  it('shows not-found for an org the caller cannot open or that does not exist', async () => {
    mockFetch.mockRejectedValue(new ServerApiError(403, { error: 'FORBIDDEN' }));

    await expect(getOrgDetail('ghost')).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
