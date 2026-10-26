# Amazon ads primer (for ramp-up)

Read this before changing rules. Phase 1 does not call Amazon; these are the objects the report is about.

## How a Sponsored Products campaign is built

```
Campaign          budget, bidding strategy, placement modifiers, audience modifiers
  └── Ad group    default bid
        ├── Keywords          word + match type (exact / phrase / broad) + bid
        ├── Product targets   ASIN or category + bid  (or auto targets)
        └── Ads               the SKU/ASIN shown (not changed in ramp-up)
```

**Bid** is the amount you offer per click on a keyword or target.

**Modifier** is a percent on top of that bid for a situation (placement or audience). Amazon applies it as “bid × (1 + modifier%)”. A modifier of `0` means no boost. A modifier of `50` means +50%.

## Placements

Where the ad showed. Campaign-level percentages:

| Placement | Ramp-up |
|---|---|
| Top of Search | Raise |
| Rest of Search | Raise |
| Product Pages | **Skip** |

## Audiences

Extra bid percent for a shopper segment (for example people who viewed your brand). Phase 1 treats two kinds:

| Kind | Ramp-up |
|---|---|
| Standard audience | Raise every modifier |
| B2B (Amazon Business) | Separate group; raise every B2B modifier |

## What “under-spending” means

A new campaign has almost no clicks, so weekly optimizers ignore it (they also drop the last 2 days). Ramp-up uses **those fresh days**:

| Check | Window | Rule |
|---|---|---|
| Campaign spend | **Yesterday** | List the campaign if spend &lt; threshold (default **$3**, configurable) |
| Keyword / target clicks | **Yesterday + the day before** | Raise the bid only if clicks **&lt; 5** |
| Placements, audiences, B2B | No click filter | Raise all rows in the group (except Product Pages) |

## How a percent is applied

User picks **one** of 3 / 5 / 7 / 10% for the whole pass.

| Group | Math | Why |
|---|---|---|
| Bidding | `bid × (1 + pct/100)` | A $1.00 bid at 10% becomes $1.10 |
| Placements, audience, B2B | **add percentage points** | A 0% modifier at 5% becomes 5%. Multiplying 0% by 1.05 would stay 0 and never ramp. |

## What Phase 1 “Apply” does

Writes a **change log** and updates the **local store**. It does not call Amazon. The ads repository is the swap point for a later API.

## What we are not optimizing

Budgets, match types, negatives, Product Page modifiers, targets that already have ≥ 5 clicks in the 2-day window.
