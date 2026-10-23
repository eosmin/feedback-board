import { NotFoundException } from '@nestjs/common';
import { Prisma, type PrismaService } from '@feedback-board/core';

import { ProfileService } from '../../../src/profile/profile.service';

const USER_ID = '44444444-4444-4444-8444-444444444444';
const ROW = { id: USER_ID, email: 'ada@example.com', name: null };

function buildAdmin(overrides: { findUnique?: jest.Mock; update?: jest.Mock } = {}): {
  admin: PrismaService;
  findUnique: jest.Mock;
  update: jest.Mock;
} {
  const findUnique = overrides.findUnique ?? jest.fn().mockResolvedValue(ROW);
  const update = overrides.update ?? jest.fn().mockResolvedValue({ ...ROW, name: 'Ada' });
  return {
    admin: { client: { user: { findUnique, update } } } as unknown as PrismaService,
    findUnique,
    update,
  };
}

describe('ProfileService', () => {
  it("reads the caller's own row by the JWT-derived id", async () => {
    const { admin, findUnique } = buildAdmin();

    const result = await new ProfileService(admin).get(USER_ID);

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: USER_ID },
      select: { id: true, email: true, name: true },
    });
    expect(result).toEqual(ROW);
  });

  it('throws 404 NOT_FOUND when the user row does not exist', async () => {
    const { admin } = buildAdmin({ findUnique: jest.fn().mockResolvedValue(null) });

    await expect(new ProfileService(admin).get(USER_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('stores the name trimmed, on the caller row only, and returns the profile', async () => {
    const { admin, update } = buildAdmin();

    const result = await new ProfileService(admin).update(USER_ID, { name: '  Ada  ' });

    expect(update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { name: 'Ada' },
      select: { id: true, email: true, name: true },
    });
    expect(result.name).toBe('Ada');
  });

  it('throws 404 NOT_FOUND when the row to update does not exist', async () => {
    const missing = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: 'test',
    });
    const { admin } = buildAdmin({ update: jest.fn().mockRejectedValue(missing) });

    await expect(new ProfileService(admin).update(USER_ID, { name: 'Ada' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lets any other database error through', async () => {
    const failure = new Error('connection lost');
    const { admin } = buildAdmin({ update: jest.fn().mockRejectedValue(failure) });

    await expect(new ProfileService(admin).update(USER_ID, { name: 'Ada' })).rejects.toBe(failure);
  });
});
