import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

import { PostsController } from '../../../src/posts/posts.controller';
import type { PostsService } from '../../../src/posts/posts.service';
import type { VotesService } from '../../../src/posts/votes.service';
import type { CommentsService } from '../../../src/posts/comments.service';
import type { AuthenticatedRequest } from '../../../src/database/tenant-prisma.service';
import type { CreatePostDto } from '../../../src/posts/dto/create-post.dto';
import type { UpdatePostStatusDto } from '../../../src/posts/dto/update-post-status.dto';
import type { CreateCommentDto } from '../../../src/posts/dto/create-comment.dto';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '44444444-4444-4444-8444-444444444444';
const BOARD_ID = '22222222-2222-4222-8222-222222222222';
const POST_ID = '33333333-3333-4333-8333-333333333333';
const COMMENT_ID = '66666666-6666-4666-8666-666666666666';

function buildPostsService(): {
  service: PostsService;
  resolveBoardId: jest.Mock;
  create: jest.Mock;
  listForBoard: jest.Mock;
  getById: jest.Mock;
  updateStatus: jest.Mock;
} {
  const resolveBoardId = jest.fn().mockResolvedValue(BOARD_ID);
  const create = jest.fn().mockResolvedValue({ id: POST_ID });
  const listForBoard = jest.fn().mockResolvedValue([]);
  const getById = jest.fn().mockResolvedValue({ id: POST_ID });
  const updateStatus = jest.fn().mockResolvedValue({ id: POST_ID, status: 'PLANNED' });
  return {
    service: {
      resolveBoardId,
      create,
      listForBoard,
      getById,
      updateStatus,
    } as unknown as PostsService,
    resolveBoardId,
    create,
    listForBoard,
    getById,
    updateStatus,
  };
}

function buildVotesService(): { service: VotesService; toggle: jest.Mock } {
  const toggle = jest.fn().mockResolvedValue({ postId: POST_ID, voted: true, voteCount: 1 });
  return { service: { toggle } as unknown as VotesService, toggle };
}

function buildCommentsService(): {
  service: CommentsService;
  create: jest.Mock;
  listForPost: jest.Mock;
} {
  const create = jest.fn().mockResolvedValue({ id: COMMENT_ID });
  const listForPost = jest.fn().mockResolvedValue([]);
  return {
    service: { create, listForPost } as unknown as CommentsService,
    create,
    listForPost,
  };
}

function buildController(): {
  controller: PostsController;
  posts: ReturnType<typeof buildPostsService>;
  votes: ReturnType<typeof buildVotesService>;
  comments: ReturnType<typeof buildCommentsService>;
} {
  const posts = buildPostsService();
  const votes = buildVotesService();
  const comments = buildCommentsService();
  const controller = new PostsController(posts.service, votes.service, comments.service);
  return { controller, posts, votes, comments };
}

describe('PostsController', () => {
  it('creates a post with the orgId/userId OrgGuard attached to the request', async () => {
    const { controller, posts } = buildController();
    const request = { orgId: ORG_ID, userId: USER_ID } as AuthenticatedRequest;
    const dto: CreatePostDto = { title: 'Add dark mode', body: 'Please add a dark theme' };

    await controller.create(request, 'acme', 'roadmap', dto);

    expect(posts.resolveBoardId).toHaveBeenCalledWith('roadmap');
    expect(posts.create).toHaveBeenCalledWith(ORG_ID, BOARD_ID, USER_ID, dto);
  });

  it('rejects create when orgId is missing from the request', async () => {
    const { controller } = buildController();
    const request = { userId: USER_ID } as AuthenticatedRequest;

    await expect(
      controller.create(request, 'acme', 'roadmap', { title: 'Add dark mode', body: 'x' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects create when userId is missing from the request', async () => {
    const { controller } = buildController();
    const request = { orgId: ORG_ID } as AuthenticatedRequest;

    await expect(
      controller.create(request, 'acme', 'roadmap', { title: 'Add dark mode', body: 'x' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('lists posts for a board via the service', async () => {
    const { controller, posts } = buildController();

    await controller.listForBoard('acme', 'roadmap');

    expect(posts.listForBoard).toHaveBeenCalledWith('roadmap');
  });

  it('returns post detail via the service', async () => {
    const { controller, posts } = buildController();

    await controller.detail('acme', POST_ID);

    expect(posts.getById).toHaveBeenCalledWith(POST_ID);
  });

  it('updates post status via the service', async () => {
    const { controller, posts } = buildController();
    const dto: UpdatePostStatusDto = { status: 'PLANNED' };

    await controller.updateStatus('acme', POST_ID, dto);

    expect(posts.updateStatus).toHaveBeenCalledWith(POST_ID, dto);
  });

  it('toggles a vote with the orgId/userId OrgGuard attached to the request', async () => {
    const { controller, votes } = buildController();
    const request = { orgId: ORG_ID, userId: USER_ID } as AuthenticatedRequest;

    const result = await controller.toggleVote(request, 'acme', POST_ID);

    expect(votes.toggle).toHaveBeenCalledWith(ORG_ID, POST_ID, USER_ID);
    expect(result).toEqual({ postId: POST_ID, voted: true, voteCount: 1 });
  });

  it('rejects toggleVote when orgId is missing from the request', async () => {
    const { controller } = buildController();
    const request = { userId: USER_ID } as AuthenticatedRequest;

    await expect(controller.toggleVote(request, 'acme', POST_ID)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects toggleVote when userId is missing from the request', async () => {
    const { controller } = buildController();
    const request = { orgId: ORG_ID } as AuthenticatedRequest;

    await expect(controller.toggleVote(request, 'acme', POST_ID)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('lists comments for a post via the service', async () => {
    const { controller, comments } = buildController();

    await controller.listComments('acme', POST_ID);

    expect(comments.listForPost).toHaveBeenCalledWith(POST_ID);
  });

  it('creates a comment with the orgId/userId OrgGuard attached to the request', async () => {
    const { controller, comments } = buildController();
    const request = { orgId: ORG_ID, userId: USER_ID } as AuthenticatedRequest;
    const dto: CreateCommentDto = { body: 'Great idea!' };

    await controller.createComment(request, 'acme', POST_ID, dto);

    expect(comments.create).toHaveBeenCalledWith(ORG_ID, POST_ID, USER_ID, dto);
  });

  it('rejects createComment when orgId is missing from the request', async () => {
    const { controller } = buildController();
    const request = { userId: USER_ID } as AuthenticatedRequest;

    await expect(
      controller.createComment(request, 'acme', POST_ID, { body: 'Great idea!' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects createComment when userId is missing from the request', async () => {
    const { controller } = buildController();
    const request = { orgId: ORG_ID } as AuthenticatedRequest;

    await expect(
      controller.createComment(request, 'acme', POST_ID, { body: 'Great idea!' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
