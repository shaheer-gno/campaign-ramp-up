# Campaign ramp-up (Phase 1)

Import Sponsored Products CSVs (panda-planner package), list campaigns under yesterday’s spend threshold, preview every field that will change, then confirm into Postgres and the change log. Amazon is not called in Phase 1.

Docs: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/LEARNING.md](docs/LEARNING.md)

## Requirements

- Node.js 22+
- [pnpm](https://pnpm.io) 9+
- Docker (for local Supabase)

## Setup

```bash
git clone https://github.com/shaheer-gno/campaign-ramp-up.git
cd campaign-ramp-up
pnpm install
```

### Database

```bash
pnpm db:start
pnpm db:status    # copy API URL + service_role key
pnpm db:migrate   # applies RPCs used by Import (required before first import)
```

### Env

```bash
cp apps/api/.env.example apps/api/.env
```

Fill `apps/api/.env` from `pnpm db:status`:

| Variable | Source |
|----------|--------|
| `SUPABASE_URL` | API URL (e.g. `http://127.0.0.1:54341`) |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` / secret key |
| `PORT` | `3011` (default) |

## Run

```bash
pnpm dev
```

| App | URL |
|-----|-----|
| Web | http://localhost:5174 |
| API | http://localhost:3011 |

## Scripts

| Command | Purpose |
|---------|---------|
| `pnpm dev` | API + web |
| `pnpm test` | API unit tests |
| `pnpm typecheck` | TypeScript |
| `pnpm db:start` / `db:stop` | Local Supabase |
| `pnpm db:migrate` | Apply pending migrations (keeps data) |
| `pnpm db:reset` | **Destructive** full DB reset |

## Reports

Primary package: [reports/panda-planner-ads-pkg/](reports/panda-planner-ads-pkg/) — upload these **five** CSVs:

1. `campaigns-state.csv`
2. `ad-groups-state.csv`
3. `targets-state.csv`
4. `campaign-daily-30d.csv`
5. `target-daily-30d.csv`

`asOf` = max(`report_date`) + 1 day. Sample TSV under [reports/sample/](reports/sample/) is for unit tests only.

## Operator flow

1. Choose the five required CSVs; set spend threshold, click cap, and default %.
2. **Import & generate** — parse → replace DB snapshot → Gate 1 list.
3. Select campaigns and groups; override Inc % or Skip per row.
4. **Review & apply** — paginated preview of fields that will change.
5. **Confirm** — updates bids/modifiers and appends change-log rows.
6. **Change log** (`/history`) — paginated audit with campaign filter.

Re-import overwrites the working snapshot; the change log is kept.

## Phase 1 does not

Call Amazon. Apply only updates the local snapshot and `change_log`.
