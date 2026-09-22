import { NotFoundException } from '@nestjs/common';

import { assertPostExists } from '../../../src/posts/assert-post-exists';

const POST_ID = '33333333-3333-4333-8333-333333333333';

describe('assertPostExists', () => {
  it('resolves without throwing when the post exists within the tenant', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: POST_ID });
    const tx = { post: { findFirst } };

    await expect(assertPostExists(tx, POST_ID)).resolves.toBeUndefined();
    expect(findFirst).toHaveBeenCalledWith({ where: { id: POST_ID }, select: { id: true } });
  });

  it('throws 404 NOT_FOUND when the post does not resolve within the tenant', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const tx = { post: { findFirst } };

    await expect(assertPostExists(tx, POST_ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});
