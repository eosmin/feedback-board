import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY } from '../../../src/auth/public.decorator';
import { PublicBoardsController } from '../../../src/public/public-boards.controller';
import type { PublicBoardsService } from '../../../src/public/public-boards.service';

function buildService(): {
  service: PublicBoardsService;
  getBoard: jest.Mock;
  listPosts: jest.Mock;
} {
  const getBoard = jest.fn().mockResolvedValue({ id: 'board-1' });
  const listPosts = jest.fn().mockResolvedValue([]);
  return {
    service: { getBoard, listPosts } as unknown as PublicBoardsService,
    getBoard,
    listPosts,
  };
}

describe('PublicBoardsController', () => {
  it('delegates board metadata to the service with both slugs', async () => {
    const { service, getBoard } = buildService();
    const controller = new PublicBoardsController(service);

    await controller.getBoard('acme', 'roadmap');

    expect(getBoard).toHaveBeenCalledWith('acme', 'roadmap');
  });

  it('delegates the post list to the service with both slugs', async () => {
    const { service, listPosts } = buildService();
    const controller = new PublicBoardsController(service);

    await controller.listPosts('acme', 'roadmap');

    expect(listPosts).toHaveBeenCalledWith('acme', 'roadmap');
  });

  it('marks both handlers @Public() so the global JwtAuthGuard lets them through', () => {
    const reflector = new Reflector();
    const prototype = PublicBoardsController.prototype;

    expect(reflector.get<boolean>(IS_PUBLIC_KEY, prototype.getBoard)).toBe(true);
    expect(reflector.get<boolean>(IS_PUBLIC_KEY, prototype.listPosts)).toBe(true);
  });

  it('exposes no handler beyond the two read routes', () => {
    const handlers = Object.getOwnPropertyNames(PublicBoardsController.prototype).filter(
      (name) => name !== 'constructor',
    );

    expect(handlers.sort()).toEqual(['getBoard', 'listPosts']);
  });
});
