import type { Percent } from '../../../shared/constants';
import type { CampaignInc } from '../types';

export function effectivePercent(
  override: CampaignInc | undefined,
  defaultPercent: Percent,
): Percent | null {
  if (override === 'skip') return null;
  if (override === undefined || override === 'default') return defaultPercent;
  return override;
}

export function formatValue(
  group: 'bidding' | 'placements' | 'audience' | 'b2b',
  value: number,
): string {
  return group === 'bidding' ? `$${value.toFixed(2)}` : `${value}%`;
}
