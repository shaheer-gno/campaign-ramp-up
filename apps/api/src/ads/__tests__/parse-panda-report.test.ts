import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { campaignsUnderSpend } from '../../ramp/rules';
import { detectPandaReport } from '../reports/detect-panda-report';
import { parsePandaReportFiles } from '../reports/parse-panda-report';
import { parseRampReportFiles } from '../reports/parse-ramp-report';

const PKG = join(
  __dirname,
  '../../../../../reports/panda-planner-ads-pkg',
);

function load(name: string) {
  return {
    filename: name,
    text: readFileSync(join(PKG, name), 'utf8'),
  };
}

const REQUIRED = [
  'campaigns-state.csv',
  'ad-groups-state.csv',
  'targets-state.csv',
  'campaign-daily-30d.csv',
  'target-daily-30d.csv',
] as const;

describe('detectPandaReport', () => {
  it('detects each required file and ignores extras', () => {
    expect(detectPandaReport(load('campaigns-state.csv').text).kind).toBe(
      'campaigns_state',
    );
    expect(detectPandaReport(load('ad-groups-state.csv').text).kind).toBe(
      'ad_groups_state',
    );
    expect(detectPandaReport(load('targets-state.csv').text).kind).toBe(
      'targets_state',
    );
    expect(detectPandaReport(load('campaign-daily-30d.csv').text).kind).toBe(
      'campaign_daily',
    );
    expect(detectPandaReport(load('target-daily-30d.csv').text).kind).toBe(
      'target_daily',
    );
    expect(detectPandaReport(load('placement-daily-30d.csv').text).kind).toBe(
      'ignored',
    );
    expect(detectPandaReport(load('audiences-dictionary.csv').text).kind).toBe(
      'ignored',
    );
  });
});

describe('parsePandaReportFiles', () => {
  it('imports SP snapshot with asOf = max(report_date)+1', () => {
    const parsed = parsePandaReportFiles(REQUIRED.map(load));
    expect(parsed.asOf).toBe('2026-10-14');
    expect(parsed.campaigns.length).toBeGreaterThan(50);
    expect(
      parsed.campaigns.every((c) =>
        c.placements.some((p) => p.placement === 'top_of_search'),
      ),
    ).toBe(true);
    expect(
      parsed.campaigns.every((c) =>
        c.audiences.some((a) => a.id === 'amazon_business' && a.kind === 'b2b'),
      ),
    ).toBe(true);

    const withTargets = parsed.campaigns.filter((c) => c.targets.length > 0);
    expect(withTargets.length).toBeGreaterThan(0);
    expect(withTargets.some((c) => c.targets.some((t) => t.bid > 0))).toBe(
      true,
    );

    const gate1 = campaignsUnderSpend(parsed.campaigns, parsed.asOf, 3);
    expect(gate1.length).toBeGreaterThan(10);
  });

  it('skips ignored files when mixed in', () => {
    const parsed = parsePandaReportFiles([
      ...REQUIRED.map(load),
      load('placement-daily-30d.csv'),
      load('audiences-dictionary.csv'),
    ]);
    expect(parsed.asOf).toBe('2026-10-14');
  });

  it('rejects when a required file is missing', () => {
    expect(() =>
      parsePandaReportFiles(REQUIRED.slice(0, 3).map(load)),
    ).toThrow(/Missing required/i);
  });

  it('routes through parseRampReportFiles', () => {
    const parsed = parseRampReportFiles(REQUIRED.map(load));
    expect(parsed.asOf).toBe('2026-10-14');
  });
});
