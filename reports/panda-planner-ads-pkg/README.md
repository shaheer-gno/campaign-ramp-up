# Panda Planner — Amazon Ads Sample Data (Campaign Ramp-Up)

Seller: Panda Planner LLC · Marketplace: Amazon.com (US) · Exported: 2026-10-23

All files are CSV with a header row. Money is USD.

## Important: data window

Daily performance files cover **2026-09-23 to 2026-10-13**. When implementing
"spent less than $3 yesterday", treat the latest `report_date` in the data
(2026-10-13) as "yesterday". Production data is continuous; this sample just
ends there.

## Required for Campaign Ramp-Up (upload these five)

| File | Grain | Contents |
|---|---|---|
| `campaigns-state.csv` | 1 row per campaign | Name, state, ad product (SP/SB/SD), placement bid adjustments (`placement_top_pct`, `placement_rest_of_search_pct`, `placement_product_page_pct`, `placement_amazon_business_pct`), and `audience_bids` JSON. |
| `ad-groups-state.csv` | 1 row per ad group | Name, state, `default_bid` (used when a target has no explicit bid). |
| `targets-state.csv` | 1 row per target/keyword | Current `bid`, keyword/ASIN, match type, state, `negative` flag (negatives are never ramped). |
| `campaign-daily-30d.csv` | campaign × day | Spend (`cost`). Drives Gate 1 (“spent &lt; threshold yesterday”). |
| `target-daily-30d.csv` | target/keyword × day | Clicks via `keyword_id`. Drives Gate 2 (“&lt; 5 clicks over yesterday + day before”). |

## Not used by the ramp importer

| File | Why skipped |
|---|---|
| `audiences-dictionary.csv` | Names only; UI labels use audience id. |
| `placement-daily-30d.csv` | Placement traffic only; modifiers come from `campaigns-state`. |

## Notes

- The Campaign Ramp-Up scope is Sponsored Products; filter on
  `ad_product = 'SPONSORED_PRODUCTS'`. SB/SD rows are included for context only.
- `cost` and `spend` are the same for Sponsored Products; prefer `cost`.
- Join keys: `campaign_id`, `ad_group_id`, `target_id`/`keyword_id`.
- Placement/audience adjustments are percentages on top of the base bid
  (e.g. `placement_top_pct = 50` means +50% at Top of Search).
