# Ramp report packages

## Primary: panda-planner (Bilal)

Folder: [`panda-planner-ads-pkg/`](./panda-planner-ads-pkg/)

Upload these **five** CSVs in the app (checklist shows Missing / Ready):

| File | Role |
|---|---|
| `campaigns-state.csv` | SP campaigns + placement % + audience bids + B2B % |
| `ad-groups-state.csv` | Ad groups + default bid |
| `targets-state.csv` | Current bids (negatives / paused skipped) |
| `campaign-daily-30d.csv` | Gate 1 spend |
| `target-daily-30d.csv` | Gate 2 clicks |

Not used: `placement-daily-30d.csv`, `audiences-dictionary.csv` (skipped if selected).

Latest `report_date` in this package is **2026-10-13** → app `asOf` = **2026-10-14**.

## Fixture: sample TSV (unit tests)

Six tab-delimited files under [`sample/`](./sample/) remain for parser unit tests only. Prefer the panda package for real runs.

## How to test

1. `pnpm dev` → http://localhost:5174  
2. Choose the five required CSVs from `panda-planner-ads-pkg/`  
3. Spend threshold `$3` → **Import & generate**
