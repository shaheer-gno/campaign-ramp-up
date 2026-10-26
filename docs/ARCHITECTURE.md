# Campaign ramp-up — architecture (Phase 1)

## Nest layout (standard)

```
apps/api/src/
  app.module.ts
  main.ts
  supabase/          # Global DB client module
  ads/               # Amazon Ads data module (NO controller)
    ads.module.ts
    ads.service.ts   # Internal API used by RampService
    ads.repository.ts
    reports/         # panda parse (prod) + fixture parse (tests)
  ramp/              # Ramp-up workflow (HTTP)
    ramp.module.ts
    ramp.controller.ts
    ramp.service.ts
    rules.ts         # Pure Gate 1 / Gate 2 / math
    types.ts         # Domain entities
    paging.ts
    dto/             # class-validator wire DTOs
packages/panda-detect/   # Shared CSV kind detection (API + web)
```

## Web layout (FBA-style modules)

```
apps/web/src/
  app/               # AppShell + router (Ramp · Change log)
  modules/ramp/      # pages · components · api · types · lib
  modules/history/   # paginated change log + campaign filter
  shared/            # api client · ui · constants · notify · styles
```

- **Ramp** owns HTTP + orchestration + rules.
- **Ads** owns report import + snapshot persistence; exports `AdsService` only.
- **Production import** = panda CSVs only (`parse-ramp-report.ts`). Sample TSV/JSON = `parse-fixture-report.ts` (tests).
- **Snapshot replace / apply** run in one Postgres transaction via RPCs `replace_ads_snapshot` and `apply_ramp_batch`.
  - `replace_ads_snapshot` — called on **Import & generate**: truncate working ads tables (not `change_log`), then **bulk** `INSERT…SELECT` from the JSON payload (set-based, not per-row loops). Local `statement_timeout` raised to 5 minutes for large packages.
  - `apply_ramp_batch` — called on **Confirm**: update bids/modifiers + insert change_log rows in one transaction.
- **DTOs** live under `ramp/dto/` (not in the controller).
- **Domain types** + named defaults (`DEFAULT_CLICK_CAP`, `DEFAULT_SPEND_THRESHOLD_USD`, `DEFAULT_PERCENT`) in `ramp/types.ts`; web mirrors in `apps/web/src/shared/constants.ts`.
- **Import graph types** in `ads/reports/report-types.ts`.
- Naming: keep the internal module **`ads`** (Amazon Ads inventory). Do not rename to `campaign` — that collides with the `campaigns` table and understates ad groups / targets / placements.

## Flow

```
Select 5 required panda CSVs + spend threshold + click cap + %
        │
        ▼
Import & generate
  AdsService.parseReportFiles → replaceSnapshot → Gate 1 list
        │
        ▼
Select campaigns + groups
        │
        ▼
Preview → Confirm
  rules → AdsService.applyRampBatch (snapshot + change_log)
        │
        ▼
Change log page (/history)
  paginated list, optional campaign filter
```

Amazon writes are out of scope. Re-import overwrites the working snapshot; `change_log` is kept.

## Tables

| Table | Holds |
|---|---|
| `campaigns` | id, name, state, optional `external_id` |
| `ad_groups` | folder under a campaign |
| `campaign_daily_spend` | spend per day (Gate 1) |
| `targets` | keyword / product target + bid |
| `target_daily_clicks` | clicks per day (Gate 2) |
| `placement_modifiers` | TOS / ROS / product_pages — PK `(campaign_id, placement)` |
| `audience_modifiers` | standard + b2b — PK `(campaign_id, id)` |
| `change_log` | one row per field Confirm changed |

## Report package

Primary: `reports/panda-planner-ads-pkg/` (five required CSVs).  
`asOf` = max(`report_date`) + 1 day. Sample TSV under `reports/sample/` for unit tests only.

## API

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/ramp/generate` | Import files + paginated Gate 1 list |
| POST | `/api/ramp/report-from-db` | Paginated Gate 1 from snapshot |
| POST | `/api/ramp/gate1-ids` | All matching Gate 1 ids (select all) |
| POST | `/api/ramp/preview` | Summary + paginated change rows |
| POST | `/api/ramp/apply` | Batched confirm: snapshot + change log |
| GET | `/api/ramp/changelog` | Paginated change log (`page`, `pageSize`, `campaignId`) |
| GET | `/api/ramp/changelog/campaigns` | Distinct campaigns for the filter |

List page size **50** (max 100). Preview **100** (max 500). Apply batches **50** campaigns.

Local Supabase API port **54341**.
