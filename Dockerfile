# syntax=docker/dockerfile:1
# Builds the apps/api service. Build from the repo root:
#   docker build -t metabolizm-api .

FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

FROM base AS build
WORKDIR /usr/src/app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --offline --frozen-lockfile
# Topological: @metabolizm/shared (tsc) -> api (nest build); mobile has no build script.
RUN pnpm run -r build
# pnpm 10 deploy requires --legacy unless inject-workspace-packages=true,
# which we must not set globally (it would break Metro's live view of shared).
RUN pnpm --filter=api deploy --prod --legacy /prod/api
# Guard: nest build with TS 6 + incremental can silently emit nothing (nest-cli#3312).
RUN test -f /prod/api/dist/main.js
# Guard: migrations ship inside @metabolizm/db (files: dist + drizzle);
# run them in prod with `node node_modules/@metabolizm/db/dist/migrate.js`.
RUN test -d /prod/api/node_modules/@metabolizm/db/drizzle

FROM node:24-slim AS api
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /prod/api /app
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
