/**
 * Pure ramp-up rules. No I/O.
 *
 * Spend is measured on the day before `asOf` ("yesterday").
 * Clicks use that day plus the day before it.
 * Bids are multiplied. Modifiers gain percentage points (so 0% can move).
 */

import {
  DEFAULT_CLICK_CAP,
  PERCENT_OPTIONS,
  type AudienceEntity,
  type CampaignEntity,
  type Placement,
  type PlacementEntity,
  type RampGroup,
  type RampPercent,
  type TargetEntity,
} from './types';

const PLACEMENTS_TO_RAISE: Placement[] = ['top_of_search', 'rest_of_search'];

export function addDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) throw new Error(`Invalid date: ${iso}`);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

export function spendDay(asOf: string): string {
  return addDays(asOf, -1);
}

export function clickWindow(asOf: string): [string, string] {
  const yesterday = spendDay(asOf);
  return [addDays(yesterday, -1), yesterday];
}

export function isRampPercent(n: number): n is RampPercent {
  return (PERCENT_OPTIONS as readonly number[]).includes(n);
}

export function spendOn(campaign: CampaignEntity, day: string): number {
  return campaign.spendByDate[day] ?? 0;
}

export function clicksInWindow(target: TargetEntity, days: readonly string[]): number {
  return days.reduce((sum, day) => sum + (target.clicksByDate[day] ?? 0), 0);
}

export function raisedBid(bid: number, percent: RampPercent): number {
  return Math.round(bid * (1 + percent / 100) * 100) / 100;
}

/** Add percentage points. 0 + 5% → 5. */
export function raisedModifier(percentPoints: number, percent: RampPercent): number {
  return Math.round((percentPoints + percent) * 100) / 100;
}

export type BiddingRow = {
  id: string;
  kind: TargetEntity['kind'];
  label: string;
  matchType: string | null;
  clicks: number;
  bid: number;
  proposedBid: number;
  eligible: boolean;
};

export type ModifierRow = {
  id: string;
  label: string;
  percent: number;
  proposedPercent: number;
  included: boolean;
};

export type CampaignReport = {
  id: string;
  name: string;
  spendYesterday: number;
  bidding: BiddingRow[];
  placements: ModifierRow[];
  audience: ModifierRow[];
  b2b: ModifierRow[];
};

export function campaignsUnderSpend(
  campaigns: CampaignEntity[],
  asOf: string,
  thresholdUsd: number,
): CampaignEntity[] {
  const day = spendDay(asOf);
  return campaigns.filter(
    (c) => c.state === 'enabled' && spendOn(c, day) < thresholdUsd,
  );
}

function biddingRows(
  targets: TargetEntity[],
  days: readonly string[],
  percent: RampPercent,
  clickCap: number,
): BiddingRow[] {
  return targets.map((t) => {
    const clicks = clicksInWindow(t, days);
    const eligible = clicks < clickCap;
    return {
      id: t.id,
      kind: t.kind,
      label: t.label,
      matchType: t.matchType,
      clicks,
      bid: t.bid,
      proposedBid: eligible ? raisedBid(t.bid, percent) : t.bid,
      eligible,
    };
  });
}

function placementRows(
  placements: PlacementEntity[],
  percent: RampPercent,
): ModifierRow[] {
  return placements.map((p) => {
    const included = PLACEMENTS_TO_RAISE.includes(p.placement);
    return {
      id: p.placement,
      label: p.placement,
      percent: p.percent,
      proposedPercent: included ? raisedModifier(p.percent, percent) : p.percent,
      included,
    };
  });
}

function audienceRows(
  audiences: AudienceEntity[],
  kind: AudienceEntity['kind'],
  percent: RampPercent,
): ModifierRow[] {
  return audiences
    .filter((a) => a.kind === kind)
    .map((a) => ({
      id: a.id,
      label: a.name,
      percent: a.percent,
      proposedPercent: raisedModifier(a.percent, percent),
      included: true,
    }));
}

export function buildCampaignReport(
  campaign: CampaignEntity,
  asOf: string,
  percent: RampPercent,
  clickCap: number = DEFAULT_CLICK_CAP,
): CampaignReport {
  const days = clickWindow(asOf);
  const cap = Number.isFinite(clickCap) ? clickCap : DEFAULT_CLICK_CAP;
  return {
    id: campaign.id,
    name: campaign.name,
    spendYesterday: spendOn(campaign, spendDay(asOf)),
    bidding: biddingRows(campaign.targets, days, percent, cap),
    placements: placementRows(campaign.placements, percent),
    audience: audienceRows(campaign.audiences, 'standard', percent),
    b2b: audienceRows(campaign.audiences, 'b2b', percent),
  };
}

export type ProposedChange = {
  group: RampGroup;
  entityId: string;
  label: string;
  before: number;
  after: number;
};

export function proposedChanges(
  report: CampaignReport,
  groups: readonly RampGroup[],
): ProposedChange[] {
  const out: ProposedChange[] = [];
  if (groups.includes('bidding')) {
    for (const row of report.bidding) {
      if (!row.eligible || row.proposedBid === row.bid) continue;
      out.push({
        group: 'bidding',
        entityId: row.id,
        label: row.label,
        before: row.bid,
        after: row.proposedBid,
      });
    }
  }
  const modifierGroups: Array<{
    group: RampGroup;
    rows: ModifierRow[];
  }> = [
    { group: 'placements', rows: report.placements },
    { group: 'audience', rows: report.audience },
    { group: 'b2b', rows: report.b2b },
  ];
  for (const block of modifierGroups) {
    if (!groups.includes(block.group)) continue;
    for (const row of block.rows) {
      if (!row.included || row.proposedPercent === row.percent) continue;
      out.push({
        group: block.group,
        entityId: row.id,
        label: row.label,
        before: row.percent,
        after: row.proposedPercent,
      });
    }
  }
  return out;
}

export function applyChangesToCampaign(
  campaign: CampaignEntity,
  changes: ProposedChange[],
): CampaignEntity {
  const next: CampaignEntity = {
    ...campaign,
    targets: campaign.targets.map((t) => ({ ...t })),
    placements: campaign.placements.map((p) => ({ ...p })),
    audiences: campaign.audiences.map((a) => ({ ...a })),
  };
  for (const change of changes) {
    if (change.group === 'bidding') {
      const target = next.targets.find((t) => t.id === change.entityId);
      if (target) target.bid = change.after;
    } else if (change.group === 'placements') {
      const placement = next.placements.find((p) => p.placement === change.entityId);
      if (placement) placement.percent = change.after;
    } else {
      const audience = next.audiences.find((a) => a.id === change.entityId);
      if (audience) audience.percent = change.after;
    }
  }
  return next;
}
