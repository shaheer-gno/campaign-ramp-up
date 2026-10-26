/** Defaults must stay aligned with apps/api/src/ramp/types.ts */

export const DEFAULT_SPEND_THRESHOLD_USD = 3;
export const DEFAULT_CLICK_CAP = 5;
export const DEFAULT_PERCENT = 5 as const;
export const PERCENT_OPTIONS = [3, 5, 7, 10] as const;
export type Percent = (typeof PERCENT_OPTIONS)[number];

export const LIST_PAGE_SIZE = 50;
export const PREVIEW_PAGE_SIZE = 100;
