# syntax=docker/dockerfile:1
# Build context is the repo root (see docker-compose.yml): apps/web imports @feedback-board/shared.

FROM node:24.21.0-bookworm-slim AS base
RUN npm install --global pnpm@12.4.1
WORKDIR /repo

# --- install: manifests only, so the layer is cached until a dependency moves
FROM base AS install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
# `--ignore-scripts`: the root `postinstall` is `prisma generate` on packages/core, which this
# image neither contains nor needs — apps/web only depends on packages/shared (pure Zod).
RUN pnpm install --frozen-lockfile --ignore-scripts --filter "@feedback-board/web..."

# --- build
FROM install AS build
# NEXT_PUBLIC_* are inlined into the bundle at build time, so they are build args, not runtime
# env. They are public by design (the Supabase publishable key ships to every browser).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_OUTPUT=standalone
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter "@feedback-board/web..." build

# --- runtime: the standalone server only. `outputFileTracingRoot` (next.config.ts) is the repo
# root, so server.js lands at apps/web/server.js inside the standalone folder.
FROM node:24.21.0-bookworm-slim AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
