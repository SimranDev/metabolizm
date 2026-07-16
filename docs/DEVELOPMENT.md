# Development runbook

Practical commands for this monorepo. Everything here is derived from the root [package.json](../package.json) scripts, [docker-compose.yml](../docker-compose.yml), and the [Dockerfile](../Dockerfile).

## 1. Fresh clone → running

Prerequisites:

- **Node 20+** (24 LTS recommended — matches the production image)
- **pnpm via corepack** (bundled with Node; version is pinned by the `packageManager` field)
- **Docker** (Desktop or any daemon) for the dev database and production image

```bash
corepack enable                           # activates pnpm 10.21.0 from package.json
pnpm install                              # all workspaces; also builds packages/shared dist (prepare hook)
docker compose up -d                      # dev postgres:18 on localhost:5432
cp apps/api/.env.example apps/api/.env    # DATABASE_URL + PORT
pnpm db:migrate                           # apply drizzle migrations
pnpm api                                  # API watch mode → http://localhost:3000/v1/health
pnpm ios                                  # or: pnpm android — dev build on simulator/device (not Expo Go)
```

## 2. Daily commands

| Command | What it does |
| --- | --- |
| `pnpm api` | Rebuild shared, run the API in watch mode on :3000 (`Ctrl+C` stops) |
| `pnpm api:build` | Compile shared + api topologically → `apps/api/dist` |
| `docker compose up -d` | Start dev postgres (data persists in a named volume) |
| `docker compose stop` | Stop postgres, keep container and data |
| `docker compose down` | Remove the container, keep the data volume |
| `pnpm start` | Metro dev server on :8081 (press `i`/`a` to open iOS/Android) |
| `pnpm ios` / `pnpm android` | Build & run a native dev build (`expo run:*`) |
| `pnpm lint` | Every package: `expo lint` (mobile) + `eslint .` (api) |
| `pnpm typecheck` | Build shared, then `tsc --noEmit` in every workspace package |
| `docker build -t metabolizm-api .` | Build the production API image |

## 3. Database workflows

1. Edit the schema: [apps/api/src/db/schema.ts](../apps/api/src/db/schema.ts)
2. `pnpm db:generate` — diff against snapshots, write a new SQL migration to `apps/api/drizzle/` (prints `No schema changes, nothing to migrate` when clean). Custom name: `pnpm --filter api exec drizzle-kit generate --name <name>`
3. `pnpm db:migrate` — apply unapplied migrations (reads `DATABASE_URL` from `apps/api/.env`)
4. `pnpm db:studio` — browse the database at https://local.drizzle.studio

Commit generated migrations (`apps/api/drizzle/`) together with the schema change.

**Full local reset** (drops all data):

```bash
docker compose down -v && docker compose up -d && pnpm db:migrate
```

## 4. Shared package (`@metabolizm/shared`)

- **Mobile/Metro reads `packages/shared/src` live** (react-native exports condition) — never needs a rebuild.
- **The API consumes the compiled `dist/`** — after editing shared, rebuild it:

```bash
pnpm --filter @metabolizm/shared build
```

Rebuilds happen automatically in `pnpm install` (prepare hook), `pnpm api`, `pnpm api:build`, and `pnpm typecheck`. Only a bare `pnpm --filter api start:dev` can run against a stale dist.

## 5. Docker (production image)

```bash
docker build -t metabolizm-api .          # repo-root context; multi-stage, pnpm deploy
docker run --rm -p 3000:3000 \
  -e DATABASE_URL=postgres://metabolizm:metabolizm@host.docker.internal:5432/metabolizm \
  metabolizm-api
curl http://localhost:3000/v1/health
```

- `host.docker.internal` reaches the compose postgres from inside the container.
- Common flags: `-d` (detach), `--name metabolizm-api`, `-e PORT=8080` (change `-p` to match).
- The build fails loudly if `dist/main.js` is missing (guards silent empty builds — see §6).

## 6. Troubleshooting

| Symptom | Fix |
| --- | --- |
| Metro serves stale or broken bundles | `cd apps/mobile && npx expo start --clear` |
| API doesn't see edits to `packages/shared` (missing exports, old types) | Stale dist — `pnpm --filter @metabolizm/shared build` |
| `nest build` "succeeds" but `apps/api/dist` is empty | Someone added `"incremental": true` to `apps/api/tsconfig.json` — remove it (TS 6 + [nest-cli#3312](https://github.com/nestjs/nest-cli/issues/3312)). Check: `test -f apps/api/dist/main.js` |
| `pnpm install` errors (`ERR_PNPM_*`, corrupt store) | `pnpm store prune`, then `rm -rf node_modules apps/*/node_modules packages/*/node_modules && pnpm install` |
| Port already in use | `lsof -nP -iTCP:3000 -sTCP:LISTEN` (3000 API, 5432 postgres, 8081 Metro); kill the PID, or set `PORT` in `apps/api/.env` / change the compose port mapping |
| Postgres container unhealthy or won't start | `docker compose logs postgres`; if hopeless: full reset (§3) |
