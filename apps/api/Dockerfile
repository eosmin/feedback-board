# syntax=docker/dockerfile:1
# Build context is the repo root (see docker-compose.yml): the image needs packages/shared and
# packages/core, which live outside apps/api. It never copies anything out of apps/worker.

FROM node:24.21.0-bookworm-slim AS base
RUN npm install --global pnpm@12.4.1
WORKDIR /repo

# --- install: manifests + the Prisma schema only, so the layer is cached until a dependency moves
FROM base AS install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
# tsconfig.json is not optional here: the `prisma-client` generator infers CJS vs ESM output from
# the nearest tsconfig. Without it the generated client is emitted as ESM (`import.meta`) and the
# CJS build of packages/core crashes at startup with "exports is not defined in ES module scope".
COPY packages/core/package.json packages/core/tsconfig.json packages/core/prisma.config.ts packages/core/
COPY packages/core/prisma packages/core/prisma
COPY apps/api/package.json apps/api/
# The root `postinstall` runs `prisma generate` (TDD §2.6.4). The client is gitignored, so an
# image that skipped it would fail at `tsc` below, not at runtime. `prisma.config.ts` reads
# DIRECT_URL at config-load time even though `generate` never connects, so a placeholder is
# supplied for this one RUN only — it is not a credential and is not persisted in the image env.
RUN DIRECT_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder \
    pnpm install --frozen-lockfile --filter "@feedback-board/api..."

# --- build: shared -> core -> api, in dependency order (pnpm builds topologically)
FROM install AS build
COPY packages/shared packages/shared
COPY packages/core packages/core
COPY apps/api apps/api
RUN pnpm --filter "@feedback-board/api..." build \
 && pnpm --filter @feedback-board/api deploy --prod /out \
 && cp -r apps/api/dist /out/dist

# --- runtime: production dependencies + compiled output only, no sources, no devDependencies
FROM node:24.21.0-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 3001
CMD ["node", "dist/main.js"]
