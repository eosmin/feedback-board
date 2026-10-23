import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/api-client-server', () => ({ serverApiFetch: vi.fn() }));

import BoardDetailPage, {
  generateMetadata,
} from '../../../app/dashboard/[orgSlug]/boards/[boardSlug]/page';
import { serverApiFetch } from '../../../lib/api-client-server';

const mockServerApiFetch = vi.mocked(serverApiFetch);
const params = Promise.resolve({ orgSlug: 'acme', boardSlug: 'feature-requests' });

beforeEach(() => {
  vi.resetAllMocks();
});

describe('board detail page', () => {
  it('titles the tab with the board name', async () => {
    mockServerApiFetch.mockResolvedValue({ name: 'Feature Requests' });

    await expect(generateMetadata({ params })).resolves.toEqual({ title: 'Feature Requests' });
    expect(mockServerApiFetch).toHaveBeenCalledWith(
      '/orgs/acme/boards/feature-requests',
      expect.anything(),
    );
  });

  it('leaves the org title from the layout when the board cannot be read', async () => {
    mockServerApiFetch.mockRejectedValue(new Error('403'));

    await expect(generateMetadata({ params })).resolves.toEqual({});
  });

  it('renders the view with the route params', async () => {
    const element = await BoardDetailPage({ params });

    expect(element.props).toEqual({ orgSlug: 'acme', boardSlug: 'feature-requests' });
  });
});
