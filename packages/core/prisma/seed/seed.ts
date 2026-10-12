import { createHash } from 'node:crypto';

import { ORGS, USER_NAMES } from './data';
import type { OrgSeed, UserKey } from './data';
import type { Role } from '../../src/generated/prisma/client';
import type { PrismaService } from '../../src/database/prisma.service';
import type { TenantRunner } from '../../src/database/tenant-runner.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export interface SeedSummary {
  orgs: number;
  boards: number;
  posts: number;
  votes: number;
  comments: number;
  /** Whether `SEED_OWNER_EMAIL` matched a user who has already signed in. */
  ownerFound: boolean;
  /** The role that account holds in each demo org after the run (org slug -> role). */
  ownerRoles: Record<string, Role>;
}

/**
 * Deterministic uuid from a key, so every re-run upserts the same row instead of inserting a
 * duplicate. SHA-1 truncated to 128 bits with the v5 version and RFC 4122 variant bits set.
 */
export function seedId(key: string): string {
  const hex = createHash('sha1').update(`feedback-board-seed:${key}`).digest('hex').slice(0, 32);
  const variant = ((parseInt(hex.charAt(16), 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const userId = (key: UserKey): string => seedId(`user:${key}`);
const userEmail = (key: UserKey): string => `demo.${key}@example.com`;

/** Every author and voter must belong to the org: the product refuses non-members. */
function assertMembersOnly(org: OrgSeed): void {
  const members = new Set(org.members.map((m) => m.user));
  for (const post of org.boards.flatMap((b) => b.posts)) {
    const actors = [post.author, ...post.votes, ...post.comments.map((c) => c.by)];
    const outsider = actors.find((a) => !members.has(a));
    if (outsider) {
      throw new Error(`seed: ${outsider} acts on "${post.key}" but is not a member of ${org.slug}`);
    }
  }
}

/**
 * Creates the demo data. The admin client only touches `users`, `orgs` and `memberships`,
 * which exist before any tenant does (TDD §3.2); boards, posts, votes, comments and the
 * subscription are written through `TenantRunner.runAs`, under RLS, like any tenant write.
 * `aiCategory` and `aiPriority` are set directly: no model call, no network.
 */
export async function runSeed(params: {
  admin: PrismaService;
  runner: TenantRunner;
  ownerEmail?: string | undefined;
  now?: Date;
}): Promise<SeedSummary> {
  const { admin, runner, ownerEmail } = params;
  const now = (params.now ?? new Date()).getTime();
  const db = admin.client;
  const summary: SeedSummary = {
    orgs: 0,
    boards: 0,
    posts: 0,
    votes: 0,
    comments: 0,
    ownerFound: false,
    ownerRoles: {},
  };

  for (const org of ORGS) {
    assertMembersOnly(org);
  }

  for (const key of Object.keys(USER_NAMES) as UserKey[]) {
    await db.user.upsert({
      where: { id: userId(key) },
      create: { id: userId(key), email: userEmail(key), name: USER_NAMES[key] },
      update: { email: userEmail(key), name: USER_NAMES[key] },
    });
  }

  // Auth stores emails lowercased, so a differently-cased SEED_OWNER_EMAIL would never match.
  const owner = ownerEmail
    ? await db.user.findUnique({ where: { email: ownerEmail.trim().toLowerCase() } })
    : null;
  summary.ownerFound = owner !== null;

  for (const org of ORGS) {
    const orgId = seedId(`org:${org.slug}`);
    const isPro = org.plan === 'PRO';
    const stripeCustomerId = isPro ? `cus_demo_${org.slug}` : null;
    await db.org.upsert({
      where: { id: orgId },
      create: { id: orgId, slug: org.slug, name: org.name, plan: org.plan, stripeCustomerId },
      update: { name: org.name, plan: org.plan, stripeCustomerId },
    });
    summary.orgs += 1;

    for (const member of org.members) {
      await db.membership.upsert({
        where: { userId_orgId: { userId: userId(member.user), orgId } },
        create: { userId: userId(member.user), orgId, role: member.role },
        update: { role: member.role },
      });
    }
    if (owner) {
      // Create-only: never change a role the account already has.
      const membership = await db.membership.upsert({
        where: { userId_orgId: { userId: owner.id, orgId } },
        create: { userId: owner.id, orgId, role: 'OWNER' },
        update: {},
      });
      summary.ownerRoles[org.slug] = membership.role;
    }

    if (isPro) {
      const currentPeriodEnd = new Date(now + 30 * DAY_MS);
      await runner.runAs(orgId, (tx) =>
        tx.subscription.upsert({
          where: { orgId },
          create: {
            orgId,
            stripeSubscriptionId: `sub_demo_${org.slug}`,
            stripePriceId: 'price_demo_pro',
            status: 'ACTIVE',
            currentPeriodEnd,
          },
          update: { status: 'ACTIVE', currentPeriodEnd },
        }),
      );
    }

    // One transaction per board: a single org-wide one can pass Prisma's 5s interactive
    // timeout against a slow database and leave the seed half applied.
    for (const board of org.boards) {
      // Counted after the commit, so a rolled-back board never reaches the summary.
      const written = await runner.runAs(orgId, async (tx) => {
        let posts = 0;
        let votes = 0;
        let comments = 0;
        const boardId = seedId(`board:${org.slug}:${board.slug}`);
        await tx.board.upsert({
          where: { id: boardId },
          create: { id: boardId, orgId, slug: board.slug, name: board.name, isPublic: true },
          update: { name: board.name, isPublic: true },
        });

        for (const post of board.posts) {
          const postId = seedId(`post:${org.slug}:${board.slug}:${post.key}`);
          const createdAt = new Date(now - post.daysAgo * DAY_MS);
          const fields = {
            title: post.title,
            body: post.body,
            status: post.status,
            aiCategory: post.aiCategory,
            aiPriority: post.aiPriority,
          };
          await tx.post.upsert({
            where: { id: postId },
            create: {
              id: postId,
              boardId,
              orgId,
              authorId: userId(post.author),
              createdAt,
              ...fields,
            },
            update: fields,
          });
          posts += 1;

          for (const voter of post.votes) {
            await tx.vote.upsert({
              where: { postId_userId: { postId, userId: userId(voter) } },
              create: {
                id: seedId(`vote:${postId}:${voter}`),
                postId,
                orgId,
                userId: userId(voter),
                createdAt,
              },
              update: {},
            });
            votes += 1;
          }

          // Counted from the rows, not from the fixture: votes cast by real users on a seeded
          // post would otherwise be lost from the counter on a re-run.
          await tx.post.update({
            where: { id: postId },
            data: { voteCount: await tx.vote.count({ where: { postId } }) },
          });

          for (const [index, comment] of post.comments.entries()) {
            const commentId = seedId(`comment:${postId}:${index}`);
            await tx.comment.upsert({
              where: { id: commentId },
              create: {
                id: commentId,
                postId,
                orgId,
                authorId: userId(comment.by),
                body: comment.body,
                createdAt: new Date(createdAt.getTime() + (index + 1) * 3 * HOUR_MS),
              },
              update: { body: comment.body },
            });
            comments += 1;
          }
        }
        return { posts, votes, comments };
      });
      summary.boards += 1;
      summary.posts += written.posts;
      summary.votes += written.votes;
      summary.comments += written.comments;
    }
  }

  return summary;
}
