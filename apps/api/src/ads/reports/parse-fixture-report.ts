/**
 * Sample TSV / JSON fixtures for unit tests only.
 * Production import uses parse-ramp-report.ts (panda CSVs).
 */

import { detectRampReportKind } from './detect-ramp-report';
import { col, headerIndex, parseNumber, splitLine } from './tsv';
import type {
  AudienceEntity,
  Placement,
  PlacementEntity,
  TargetEntity,
} from '../../ramp/types';
import type {
  AdGroupEntity,
  CampaignWithAdGroups,
  ParsedRampReport,
  RampReportFile,
} from './report-types';

export type {
  AdGroupEntity,
  CampaignWithAdGroups,
  ParsedRampReport,
  RampReportFile,
} from './report-types';

const PLACEMENTS: Placement[] = [
  'top_of_search',
  'rest_of_search',
  'product_pages',
];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Parse sample TSV set or a single JSON body (tests / fixtures). */
export function parseFixtureReportFiles(
  files: RampReportFile[],
): ParsedRampReport {
  if (files.length === 0) {
    throw new Error('Upload at least one report file');
  }
  if (files.length === 1) {
    const text = files[0]!.text.trim();
    if (text.startsWith('{')) {
      return parseRampReportJson(text);
    }
  }
  return parseRampReportTsv(files);
}

export function parseFixtureReport(text: string): ParsedRampReport {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) return parseRampReportJson(trimmed);
  return parseRampReportTsv([{ filename: 'report.txt', text: trimmed }]);
}

function parseRampReportTsv(files: RampReportFile[]): ParsedRampReport {
  const byKind = new Map<
    ReturnType<typeof detectRampReportKind>,
    RampReportFile
  >();

  for (const file of files) {
    const kind = detectRampReportKind(file.text);
    if (!kind) {
      throw new Error(
        `Unrecognized report headers in ${file.filename}. Need campaigns, spend, targets, clicks, placements, and/or audiences columns.`,
      );
    }
    if (byKind.has(kind)) {
      throw new Error(`Duplicate ${kind} report (${file.filename})`);
    }
    byKind.set(kind, file);
  }

  const required: Array<NonNullable<ReturnType<typeof detectRampReportKind>>> =
    ['campaigns', 'spend', 'targets', 'clicks'];
  for (const kind of required) {
    if (!byKind.has(kind)) {
      throw new Error(`Missing required ${kind} report`);
    }
  }

  type AgDraft = { id: string; name: string };
  type CampDraft = {
    id: string;
    name: string;
    state: 'enabled' | 'paused';
    asOf: string;
    adGroups: Map<string, AgDraft>;
  };

  const camps = new Map<string, CampDraft>();
  let asOf = '';

  {
    const file = byKind.get('campaigns')!;
    const parsed = headerIndex(file.text)!;
    for (let i = 1; i < parsed.lines.length; i++) {
      const cells = splitLine(parsed.lines[i]!);
      const id = col(cells, parsed.index, 'campaign-id')?.trim();
      const name = col(cells, parsed.index, 'campaign-name')?.trim();
      const stateRaw = col(cells, parsed.index, 'campaign-state')?.trim();
      const agId = col(cells, parsed.index, 'ad-group-id')?.trim();
      const agName = col(cells, parsed.index, 'ad-group-name')?.trim();
      const rowAsOf = col(cells, parsed.index, 'as-of')?.trim();
      if (!id || !name || !stateRaw || !agId || !agName) {
        throw new Error(`campaigns row ${i}: missing required columns`);
      }
      if (stateRaw !== 'enabled' && stateRaw !== 'paused') {
        throw new Error(`campaigns row ${i}: state must be enabled or paused`);
      }
      if (rowAsOf) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(rowAsOf)) {
          throw new Error(`campaigns row ${i}: invalid as-of`);
        }
        asOf = rowAsOf;
      }
      let camp = camps.get(id);
      if (!camp) {
        camp = {
          id,
          name,
          state: stateRaw,
          asOf: rowAsOf ?? '',
          adGroups: new Map(),
        };
        camps.set(id, camp);
      }
      camp.adGroups.set(agId, { id: agId, name: agName });
    }
  }

  if (!asOf) {
    throw new Error('campaigns report must include an as-of column (YYYY-MM-DD)');
  }

  const spendByCampaign = new Map<string, Record<string, number>>();
  {
    const file = byKind.get('spend')!;
    const parsed = headerIndex(file.text)!;
    for (let i = 1; i < parsed.lines.length; i++) {
      const cells = splitLine(parsed.lines[i]!);
      const campaignId = col(cells, parsed.index, 'campaign-id')?.trim();
      const day = col(cells, parsed.index, 'date')?.trim();
      const spend = parseNumber(col(cells, parsed.index, 'spend-usd'));
      if (!campaignId || !day || spend == null) {
        throw new Error(`spend row ${i}: invalid data`);
      }
      const bag = spendByCampaign.get(campaignId) ?? {};
      bag[day] = spend;
      spendByCampaign.set(campaignId, bag);
    }
  }

  type TargetDraft = TargetEntity & { campaignId: string };
  const targets: TargetDraft[] = [];
  {
    const file = byKind.get('targets')!;
    const parsed = headerIndex(file.text)!;
    for (let i = 1; i < parsed.lines.length; i++) {
      const cells = splitLine(parsed.lines[i]!);
      const id = col(cells, parsed.index, 'target-id')?.trim();
      const campaignId = col(cells, parsed.index, 'campaign-id')?.trim();
      const adGroupId = col(cells, parsed.index, 'ad-group-id')?.trim();
      const kind = col(cells, parsed.index, 'target-kind')?.trim();
      const label = col(cells, parsed.index, 'label')?.trim();
      const matchType =
        col(cells, parsed.index, 'match-type')?.trim() || null;
      const bid = parseNumber(col(cells, parsed.index, 'bid'));
      if (!id || !campaignId || !adGroupId || !kind || !label || bid == null) {
        throw new Error(`targets row ${i}: invalid data`);
      }
      if (kind !== 'keyword' && kind !== 'product_target') {
        throw new Error(`targets row ${i}: target-kind must be keyword or product_target`);
      }
      targets.push({
        id,
        campaignId,
        adGroupId,
        kind,
        label,
        matchType,
        bid,
        clicksByDate: {},
      });
    }
  }

  {
    const file = byKind.get('clicks')!;
    const parsed = headerIndex(file.text)!;
    const byId = new Map(targets.map((t) => [t.id, t]));
    for (let i = 1; i < parsed.lines.length; i++) {
      const cells = splitLine(parsed.lines[i]!);
      const targetId = col(cells, parsed.index, 'target-id')?.trim();
      const day = col(cells, parsed.index, 'date')?.trim();
      const clicks = parseNumber(col(cells, parsed.index, 'clicks'));
      if (!targetId || !day || clicks == null) {
        throw new Error(`clicks row ${i}: invalid data`);
      }
      const target = byId.get(targetId);
      if (!target) {
        throw new Error(`clicks row ${i}: unknown target-id ${targetId}`);
      }
      target.clicksByDate[day] = clicks;
    }
  }

  const placementsByCampaign = new Map<string, PlacementEntity[]>();
  if (byKind.has('placements')) {
    const file = byKind.get('placements')!;
    const parsed = headerIndex(file.text)!;
    for (let i = 1; i < parsed.lines.length; i++) {
      const cells = splitLine(parsed.lines[i]!);
      const campaignId = col(cells, parsed.index, 'campaign-id')?.trim();
      const placement = col(cells, parsed.index, 'placement')?.trim() as
        | Placement
        | undefined;
      const percent = parseNumber(col(cells, parsed.index, 'percent'));
      if (!campaignId || !placement || percent == null) {
        throw new Error(`placements row ${i}: invalid data`);
      }
      if (!PLACEMENTS.includes(placement)) {
        throw new Error(`placements row ${i}: unknown placement`);
      }
      const list = placementsByCampaign.get(campaignId) ?? [];
      list.push({ placement, percent });
      placementsByCampaign.set(campaignId, list);
    }
  }

  const audiencesByCampaign = new Map<string, AudienceEntity[]>();
  if (byKind.has('audiences')) {
    const file = byKind.get('audiences')!;
    const parsed = headerIndex(file.text)!;
    for (let i = 1; i < parsed.lines.length; i++) {
      const cells = splitLine(parsed.lines[i]!);
      const id = col(cells, parsed.index, 'audience-id')?.trim();
      const campaignId = col(cells, parsed.index, 'campaign-id')?.trim();
      const name = col(cells, parsed.index, 'audience-name')?.trim();
      const kind = col(cells, parsed.index, 'audience-kind')?.trim();
      const percent = parseNumber(col(cells, parsed.index, 'percent'));
      if (!id || !campaignId || !name || !kind || percent == null) {
        throw new Error(`audiences row ${i}: invalid data`);
      }
      if (kind !== 'standard' && kind !== 'b2b') {
        throw new Error(`audiences row ${i}: kind must be standard or b2b`);
      }
      const list = audiencesByCampaign.get(campaignId) ?? [];
      list.push({ id, name, kind, percent });
      audiencesByCampaign.set(campaignId, list);
    }
  }

  const campaigns: CampaignWithAdGroups[] = [...camps.values()].map((camp) => {
    const campTargets = targets.filter((t) => t.campaignId === camp.id);
    const adGroups: AdGroupEntity[] = [...camp.adGroups.values()].map((ag) => ({
      id: ag.id,
      name: ag.name,
      targets: campTargets
        .filter((t) => t.adGroupId === ag.id)
        .map(({ campaignId: _c, ...rest }) => rest),
    }));
    return {
      id: camp.id,
      name: camp.name,
      state: camp.state,
      spendByDate: spendByCampaign.get(camp.id) ?? {},
      placements: placementsByCampaign.get(camp.id) ?? [],
      audiences: audiencesByCampaign.get(camp.id) ?? [],
      adGroups,
      targets: adGroups.flatMap((ag) => ag.targets),
    };
  });

  if (campaigns.length === 0) {
    throw new Error('No campaigns found in report');
  }

  return { asOf, campaigns };
}

function parseRampReportJson(text: string): ParsedRampReport {
  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    throw new Error('Report must be valid JSON or tab-delimited text');
  }
  if (!isRecord(body)) throw new Error('Report root must be an object');
  const asOf = String(body.asOf ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
    throw new Error('asOf must be YYYY-MM-DD');
  }
  const campaignsRaw = body.campaigns;
  if (!Array.isArray(campaignsRaw) || campaignsRaw.length === 0) {
    throw new Error('campaigns must be a non-empty array');
  }
  return {
    asOf,
    campaigns: campaignsRaw.map((c, i) => parseCampaignJson(c, i)),
  };
}

function asString(v: unknown, field: string): string {
  if (typeof v !== 'string' || !v.trim()) {
    throw new Error(`Invalid or missing ${field}`);
  }
  return v.trim();
}

function asNumber(v: unknown, field: string): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) throw new Error(`Invalid number for ${field}`);
  return n;
}

function asDateMap(v: unknown, field: string): Record<string, number> {
  if (!isRecord(v)) throw new Error(`${field} must be an object of date → number`);
  const out: Record<string, number> = {};
  for (const [day, raw] of Object.entries(v)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      throw new Error(`Invalid date key in ${field}: ${day}`);
    }
    out[day] = asNumber(raw, `${field}.${day}`);
  }
  return out;
}

function parseCampaignJson(raw: unknown, index: number): CampaignWithAdGroups {
  const path = `campaigns[${index}]`;
  if (!isRecord(raw)) throw new Error(`${path} must be an object`);
  const state = asString(raw.state, `${path}.state`);
  if (state !== 'enabled' && state !== 'paused') {
    throw new Error(`${path}.state must be enabled or paused`);
  }
  const adGroupsRaw = raw.adGroups;
  if (!Array.isArray(adGroupsRaw) || adGroupsRaw.length === 0) {
    throw new Error(`${path}.adGroups must be a non-empty array`);
  }
  const adGroups: AdGroupEntity[] = adGroupsRaw.map((ag, i) => {
    const agPath = `${path}.adGroups[${i}]`;
    if (!isRecord(ag)) throw new Error(`${agPath} must be an object`);
    const id = asString(ag.id, `${agPath}.id`);
    const targetsRaw = ag.targets;
    if (!Array.isArray(targetsRaw)) {
      throw new Error(`${agPath}.targets must be an array`);
    }
    const targets = targetsRaw.map((t, ti) => {
      const tPath = `${agPath}.targets[${ti}]`;
      if (!isRecord(t)) throw new Error(`${tPath} must be an object`);
      const kind = asString(t.kind, `${tPath}.kind`);
      if (kind !== 'keyword' && kind !== 'product_target') {
        throw new Error(`${tPath}.kind must be keyword or product_target`);
      }
      return {
        id: asString(t.id, `${tPath}.id`),
        adGroupId: id,
        kind,
        label: asString(t.label, `${tPath}.label`),
        matchType:
          t.matchType === null || t.matchType === undefined
            ? null
            : asString(t.matchType, `${tPath}.matchType`),
        bid: asNumber(t.bid, `${tPath}.bid`),
        clicksByDate: asDateMap(t.clicksByDate ?? {}, `${tPath}.clicksByDate`),
      } satisfies TargetEntity;
    });
    return {
      id,
      name: asString(ag.name, `${agPath}.name`),
      targets,
    };
  });
  const placementsRaw = raw.placements;
  if (!Array.isArray(placementsRaw)) {
    throw new Error(`${path}.placements must be an array`);
  }
  const audiencesRaw = raw.audiences ?? [];
  if (!Array.isArray(audiencesRaw)) {
    throw new Error(`${path}.audiences must be an array`);
  }
  return {
    id: asString(raw.id, `${path}.id`),
    name: asString(raw.name, `${path}.name`),
    state,
    spendByDate: asDateMap(raw.spendByDate ?? {}, `${path}.spendByDate`),
    placements: placementsRaw.map((p, i) => {
      const pPath = `${path}.placements[${i}]`;
      if (!isRecord(p)) throw new Error(`${pPath} must be an object`);
      const placement = asString(p.placement, `${pPath}.placement`) as Placement;
      if (!PLACEMENTS.includes(placement)) {
        throw new Error(`${pPath}.placement invalid`);
      }
      return { placement, percent: asNumber(p.percent, `${pPath}.percent`) };
    }),
    audiences: audiencesRaw.map((a, i) => {
      const aPath = `${path}.audiences[${i}]`;
      if (!isRecord(a)) throw new Error(`${aPath} must be an object`);
      const kind = asString(a.kind, `${aPath}.kind`);
      if (kind !== 'standard' && kind !== 'b2b') {
        throw new Error(`${aPath}.kind must be standard or b2b`);
      }
      return {
        id: asString(a.id, `${aPath}.id`),
        name: asString(a.name, `${aPath}.name`),
        kind,
        percent: asNumber(a.percent, `${aPath}.percent`),
      };
    }),
    adGroups,
    targets: adGroups.flatMap((ag) => ag.targets),
  };
}
