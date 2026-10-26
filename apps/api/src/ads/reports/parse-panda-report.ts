/**
 * Bilal panda-planner Amazon Ads CSV package → CampaignWithAdGroups snapshot.
 */

import {
  detectPandaReport,
  PANDA_LABELS,
  PANDA_REQUIRED,
  type PandaReportKind,
} from './detect-panda-report';
import { col, headerIndex, parseNumber, splitLine } from './tsv';
import { addDays } from '../../ramp/rules';
import type {
  AudienceEntity,
  PlacementEntity,
  TargetEntity,
} from '../../ramp/types';
import type {
  AdGroupEntity,
  CampaignWithAdGroups,
  ParsedRampReport,
  RampReportFile,
} from './report-types';

const SP = 'SPONSORED_PRODUCTS';

type AudienceBid = { audienceId: string; percentage: number };

function pctOrZero(raw: string | undefined): number {
  const n = parseNumber(raw);
  return n == null ? 0 : n;
}

function parseAudienceBids(raw: string | undefined): AudienceBid[] {
  const s = (raw ?? '').trim();
  if (!s || s === '[]') return [];
  try {
    const parsed = JSON.parse(s) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: AudienceBid[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== 'object') continue;
      const r = row as Record<string, unknown>;
      const audienceId = String(r.audienceId ?? '').trim();
      const percentage = Number(r.percentage);
      if (!audienceId || !Number.isFinite(percentage)) continue;
      out.push({ audienceId, percentage });
    }
    return out;
  } catch {
    return [];
  }
}

function targetKind(
  targetType: string,
): TargetEntity['kind'] {
  return targetType === 'KEYWORD' ? 'keyword' : 'product_target';
}

function targetLabel(row: {
  keyword?: string;
  asin?: string;
  matchType?: string;
  targetType: string;
}): string {
  const kw = row.keyword?.trim();
  if (kw) return kw;
  const asin = row.asin?.trim();
  if (asin) return asin;
  const mt = row.matchType?.trim();
  if (mt) return mt;
  return row.targetType;
}

export function parsePandaReportFiles(files: RampReportFile[]): ParsedRampReport {
  if (files.length === 0) {
    throw new Error('Upload the five required panda report CSVs');
  }

  const byKind = new Map<PandaReportKind, RampReportFile>();

  for (const file of files) {
    const detected = detectPandaReport(file.text);
    if (detected.kind === 'ignored') {
      continue;
    }
    if (detected.kind === 'unknown') {
      throw new Error(
        `Unrecognized report headers in ${file.filename}. Need the five panda package CSVs (campaigns-state, ad-groups-state, targets-state, campaign-daily, target-daily).`,
      );
    }
    if (byKind.has(detected.kind)) {
      throw new Error(
        `Duplicate ${PANDA_LABELS[detected.kind]} (${file.filename})`,
      );
    }
    byKind.set(detected.kind, file);
  }

  for (const kind of PANDA_REQUIRED) {
    if (!byKind.has(kind)) {
      throw new Error(`Missing required report: ${PANDA_LABELS[kind]}`);
    }
  }

  // --- campaigns state (SP only) ---
  type CampDraft = {
    id: string;
    name: string;
    state: 'enabled' | 'paused';
    placements: PlacementEntity[];
    audiences: AudienceEntity[];
  };
  const camps = new Map<string, CampDraft>();

  {
    const file = byKind.get('campaigns_state')!;
    const parsed = headerIndex(file.text)!;
    for (let i = 1; i < parsed.lines.length; i++) {
      const cells = splitLine(parsed.lines[i]!);
      const adProduct = col(cells, parsed.index, 'ad-product')?.trim();
      if (adProduct !== SP) continue;
      const id = col(cells, parsed.index, 'campaign-id')?.trim();
      const name = col(cells, parsed.index, 'name')?.trim();
      const stateRaw = col(cells, parsed.index, 'state')?.trim()?.toUpperCase();
      if (!id || !name || !stateRaw) {
        throw new Error(`campaigns-state row ${i}: missing campaign fields`);
      }
      if (stateRaw !== 'ENABLED' && stateRaw !== 'PAUSED') {
        throw new Error(`campaigns-state row ${i}: invalid state`);
      }
      const placements: PlacementEntity[] = [
        {
          placement: 'top_of_search',
          percent: pctOrZero(col(cells, parsed.index, 'placement-top-pct')),
        },
        {
          placement: 'rest_of_search',
          percent: pctOrZero(
            col(cells, parsed.index, 'placement-rest-of-search-pct'),
          ),
        },
        {
          placement: 'product_pages',
          percent: pctOrZero(
            col(cells, parsed.index, 'placement-product-page-pct'),
          ),
        },
      ];
      const audiences: AudienceEntity[] = parseAudienceBids(
        col(cells, parsed.index, 'audience-bids'),
      ).map((a) => ({
        id: a.audienceId,
        name: a.audienceId,
        kind: 'standard' as const,
        percent: a.percentage,
      }));
      audiences.push({
        id: 'amazon_business',
        name: 'Amazon Business',
        kind: 'b2b',
        percent: pctOrZero(
          col(cells, parsed.index, 'placement-amazon-business-pct'),
        ),
      });
      camps.set(id, {
        id,
        name,
        state: stateRaw === 'ENABLED' ? 'enabled' : 'paused',
        placements,
        audiences,
      });
    }
  }

  if (camps.size === 0) {
    throw new Error('No Sponsored Products campaigns in campaigns-state');
  }

  // --- ad groups ---
  type AgDraft = { id: string; name: string; defaultBid: number | null };
  const adGroupsByCampaign = new Map<string, Map<string, AgDraft>>();
  const defaultBidByAg = new Map<string, number | null>();

  {
    const file = byKind.get('ad_groups_state')!;
    const parsed = headerIndex(file.text)!;
    for (let i = 1; i < parsed.lines.length; i++) {
      const cells = splitLine(parsed.lines[i]!);
      const adProduct = col(cells, parsed.index, 'ad-product')?.trim();
      if (adProduct !== SP) continue;
      const campaignId = col(cells, parsed.index, 'campaign-id')?.trim();
      const id = col(cells, parsed.index, 'ad-group-id')?.trim();
      const name = col(cells, parsed.index, 'name')?.trim();
      if (!campaignId || !id || !name) {
        throw new Error(`ad-groups-state row ${i}: missing fields`);
      }
      if (!camps.has(campaignId)) continue;
      const defaultBid = parseNumber(col(cells, parsed.index, 'default-bid'));
      defaultBidByAg.set(id, defaultBid);
      const bag = adGroupsByCampaign.get(campaignId) ?? new Map();
      bag.set(id, { id, name, defaultBid });
      adGroupsByCampaign.set(campaignId, bag);
    }
  }

  // --- targets ---
  type TargetDraft = TargetEntity & { campaignId: string };
  const targets: TargetDraft[] = [];

  {
    const file = byKind.get('targets_state')!;
    const parsed = headerIndex(file.text)!;
    for (let i = 1; i < parsed.lines.length; i++) {
      const cells = splitLine(parsed.lines[i]!);
      const adProduct = col(cells, parsed.index, 'ad-product')?.trim();
      if (adProduct !== SP) continue;
      const negative = col(cells, parsed.index, 'negative')?.trim()?.toLowerCase();
      if (negative === 'true') continue;
      const stateRaw = col(cells, parsed.index, 'state')?.trim()?.toUpperCase();
      if (stateRaw !== 'ENABLED') continue;
      const id = col(cells, parsed.index, 'target-id')?.trim();
      const campaignId = col(cells, parsed.index, 'campaign-id')?.trim();
      const adGroupId = col(cells, parsed.index, 'ad-group-id')?.trim();
      const targetType = col(cells, parsed.index, 'target-type')?.trim();
      if (!id || !campaignId || !adGroupId || !targetType) continue;
      if (!camps.has(campaignId)) continue;
      const bidRaw = parseNumber(col(cells, parsed.index, 'bid'));
      const bid = bidRaw ?? defaultBidByAg.get(adGroupId) ?? null;
      if (bid == null) continue;
      const keyword = col(cells, parsed.index, 'keyword')?.trim();
      const asin = col(cells, parsed.index, 'asin')?.trim();
      const matchType =
        col(cells, parsed.index, 'match-type')?.trim() || null;
      targets.push({
        id,
        campaignId,
        adGroupId,
        kind: targetKind(targetType),
        label: targetLabel({
          keyword,
          asin,
          matchType: matchType ?? undefined,
          targetType,
        }),
        matchType,
        bid,
        clicksByDate: {},
      });
      // Ensure ad group exists even if missing from ad-groups-state
      if (!adGroupsByCampaign.get(campaignId)?.has(adGroupId)) {
        const bag = adGroupsByCampaign.get(campaignId) ?? new Map();
        bag.set(adGroupId, {
          id: adGroupId,
          name: adGroupId,
          defaultBid: null,
        });
        adGroupsByCampaign.set(campaignId, bag);
      }
    }
  }

  // --- campaign daily spend ---
  const spendByCampaign = new Map<string, Record<string, number>>();
  let maxReportDate = '';

  {
    const file = byKind.get('campaign_daily')!;
    const parsed = headerIndex(file.text)!;
    for (let i = 1; i < parsed.lines.length; i++) {
      const cells = splitLine(parsed.lines[i]!);
      const campaignId = col(cells, parsed.index, 'campaign-id')?.trim();
      const day = col(cells, parsed.index, 'report-date')?.trim();
      const cost =
        parseNumber(col(cells, parsed.index, 'cost')) ??
        parseNumber(col(cells, parsed.index, 'spend'));
      if (!campaignId || !day || cost == null) {
        throw new Error(`campaign-daily row ${i}: invalid data`);
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
        throw new Error(`campaign-daily row ${i}: invalid report_date`);
      }
      if (day > maxReportDate) maxReportDate = day;
      if (!camps.has(campaignId)) continue;
      const bag = spendByCampaign.get(campaignId) ?? {};
      bag[day] = (bag[day] ?? 0) + cost;
      spendByCampaign.set(campaignId, bag);
    }
  }

  if (!maxReportDate) {
    throw new Error('campaign-daily has no report_date rows');
  }
  const asOf = addDays(maxReportDate, 1);

  // --- target daily clicks (keyword_id → target_id; orphans ignored) ---
  {
    const file = byKind.get('target_daily')!;
    const parsed = headerIndex(file.text)!;
    const byId = new Map(targets.map((t) => [t.id, t]));
    for (let i = 1; i < parsed.lines.length; i++) {
      const cells = splitLine(parsed.lines[i]!);
      const targetId = col(cells, parsed.index, 'keyword-id')?.trim();
      const day = col(cells, parsed.index, 'report-date')?.trim();
      const clicks = parseNumber(col(cells, parsed.index, 'clicks'));
      if (!targetId || !day || clicks == null) continue;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
      const target = byId.get(targetId);
      if (!target) continue;
      target.clicksByDate[day] = (target.clicksByDate[day] ?? 0) + clicks;
    }
  }

  const campaigns: CampaignWithAdGroups[] = [...camps.values()].map((camp) => {
    const campTargets = targets.filter((t) => t.campaignId === camp.id);
    const agMap = adGroupsByCampaign.get(camp.id) ?? new Map();
    // Include every ad group that has targets or was listed in state
    const agIds = new Set([
      ...agMap.keys(),
      ...campTargets.map((t) => t.adGroupId),
    ]);
    const adGroups: AdGroupEntity[] = [...agIds].map((agId) => {
      const ag = agMap.get(agId);
      return {
        id: agId,
        name: ag?.name ?? agId,
        targets: campTargets
          .filter((t) => t.adGroupId === agId)
          .map(({ campaignId: _c, ...rest }) => rest),
      };
    });
    return {
      id: camp.id,
      name: camp.name,
      state: camp.state,
      spendByDate: spendByCampaign.get(camp.id) ?? {},
      placements: camp.placements,
      audiences: camp.audiences,
      adGroups,
      targets: adGroups.flatMap((ag) => ag.targets),
    };
  });

  return { asOf, campaigns };
}
