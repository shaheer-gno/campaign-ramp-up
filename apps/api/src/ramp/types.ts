/** Default Gate 2 two-day click sum cap (UI + API when omitted). */
export const DEFAULT_CLICK_CAP = 5;
/** Default Gate 1 spend threshold (USD). Overridable via API/UI. */
export const DEFAULT_SPEND_THRESHOLD_USD = 3;
/** Default ramp increase (%). Must be in PERCENT_OPTIONS. */
export const DEFAULT_PERCENT = 5;
export const PERCENT_OPTIONS = [3, 5, 7, 10] as const;
export type RampPercent = (typeof PERCENT_OPTIONS)[number];

/** Fallback asOf when reports omit dates (sample TSV era). Prefer parsed asOf. */
export const SAMPLE_AS_OF = '2026-10-22';

export type Placement = 'top_of_search' | 'rest_of_search' | 'product_pages';
export type RampGroup = 'bidding' | 'placements' | 'audience' | 'b2b';

export type TargetEntity = {
  id: string;
  adGroupId: string;
  kind: 'keyword' | 'product_target';
  label: string;
  matchType: string | null;
  bid: number;
  /** Clicks keyed by YYYY-MM-DD */
  clicksByDate: Record<string, number>;
};

export type PlacementEntity = {
  placement: Placement;
  /** Current modifier in percentage points (50 = +50%). */
  percent: number;
};

export type AudienceEntity = {
  id: string;
  name: string;
  kind: 'standard' | 'b2b';
  percent: number;
};

export type CampaignEntity = {
  id: string;
  name: string;
  state: 'enabled' | 'paused';
  /** Spend keyed by YYYY-MM-DD */
  spendByDate: Record<string, number>;
  targets: TargetEntity[];
  placements: PlacementEntity[];
  audiences: AudienceEntity[];
};

export type ChangeLogEntry = {
  id: string;
  createdAt: string;
  campaignId: string;
  campaignName: string;
  group: RampGroup;
  entityId: string;
  label: string;
  before: number;
  after: number;
  percent: RampPercent;
};
