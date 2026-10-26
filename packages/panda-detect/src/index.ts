/**
 * Shared panda-planner CSV kind detection (API + web).
 * Header-based only — filenames are ignored.
 */

export type PandaReportKind =
  | 'campaigns_state'
  | 'ad_groups_state'
  | 'targets_state'
  | 'campaign_daily'
  | 'target_daily';

export type PandaDetectResult =
  | { kind: PandaReportKind }
  | { kind: 'ignored'; reason: string }
  | { kind: 'unknown' };

export const PANDA_REQUIRED: PandaReportKind[] = [
  'campaigns_state',
  'ad_groups_state',
  'targets_state',
  'campaign_daily',
  'target_daily',
];

export const PANDA_LABELS: Record<PandaReportKind, string> = {
  campaigns_state: 'Campaigns state',
  ad_groups_state: 'Ad groups state',
  targets_state: 'Targets state',
  campaign_daily: 'Campaign daily (30d)',
  target_daily: 'Target daily (30d)',
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/_/g, '-');
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

function headerIndex(text: string): Map<string, number> | null {
  const first = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .find((l) => l.trim().length > 0);
  if (!first) return null;
  const headers = (
    first.includes('\t') ? first.split('\t') : splitCsvLine(first)
  ).map(normalizeHeader);
  return new Map(headers.map((h, i) => [h, i]));
}

function hasCols(index: Map<string, number>, ...names: string[]): boolean {
  return names.every((n) => index.has(normalizeHeader(n)));
}

/** Detect panda CSV type from headers (filenames ignored). */
export function detectPandaReport(text: string): PandaDetectResult {
  const index = headerIndex(text);
  if (!index) return { kind: 'unknown' };

  if (
    hasCols(index, 'campaign-id', 'ad-product', 'name', 'placement-top-pct')
  ) {
    return { kind: 'campaigns_state' };
  }
  if (hasCols(index, 'ad-group-id', 'campaign-id', 'default-bid', 'name')) {
    return { kind: 'ad_groups_state' };
  }
  if (
    hasCols(
      index,
      'target-id',
      'campaign-id',
      'ad-group-id',
      'target-type',
      'negative',
    )
  ) {
    return { kind: 'targets_state' };
  }
  if (
    hasCols(index, 'report-date', 'campaign-id', 'cost') &&
    !hasCols(index, 'keyword-id') &&
    !hasCols(index, 'placement-classification')
  ) {
    return { kind: 'campaign_daily' };
  }
  if (hasCols(index, 'report-date', 'keyword-id', 'clicks')) {
    return { kind: 'target_daily' };
  }
  if (hasCols(index, 'report-date', 'placement-classification')) {
    return {
      kind: 'ignored',
      reason: 'Placement daily (not used for ramp)',
    };
  }
  if (hasCols(index, 'audience-id', 'audience-name', 'audience-path')) {
    return {
      kind: 'ignored',
      reason: 'Audiences dictionary (not required)',
    };
  }
  return { kind: 'unknown' };
}

export function looksLikePandaPackage(files: { text: string }[]): boolean {
  return files.some((f) => {
    const d = detectPandaReport(f.text);
    return (
      d.kind === 'campaigns_state' ||
      d.kind === 'ad_groups_state' ||
      d.kind === 'targets_state' ||
      d.kind === 'campaign_daily' ||
      d.kind === 'target_daily'
    );
  });
}
