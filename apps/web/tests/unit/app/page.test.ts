import { redirect } from 'next/navigation';
import { describe, expect, it, vi } from 'vitest';

import RootPage from '../../../app/page';

vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

describe('RootPage', () => {
  it('redirects / to /dashboard', () => {
    RootPage();

    expect(redirect).toHaveBeenCalledWith('/dashboard');
  });
});
