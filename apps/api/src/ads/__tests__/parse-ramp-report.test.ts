import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { detectRampReportKind } from '../reports/detect-ramp-report';
import { parseFixtureReportFiles } from '../reports/parse-fixture-report';

const reportsDir = join(__dirname, '../../../../../reports/sample');

function load(name: string) {
  return {
    filename: name,
    text: readFileSync(join(reportsDir, name), 'utf8'),
  };
}

describe('detectRampReportKind', () => {
  it('detects each sample by headers', () => {
    expect(detectRampReportKind(load('sample-ramp-campaigns.txt').text)).toBe(
      'campaigns',
    );
    expect(detectRampReportKind(load('sample-ramp-spend.txt').text)).toBe(
      'spend',
    );
    expect(detectRampReportKind(load('sample-ramp-targets.txt').text)).toBe(
      'targets',
    );
    expect(detectRampReportKind(load('sample-ramp-clicks.txt').text)).toBe(
      'clicks',
    );
    expect(detectRampReportKind(load('sample-ramp-placements.txt').text)).toBe(
      'placements',
    );
    expect(detectRampReportKind(load('sample-ramp-audiences.txt').text)).toBe(
      'audiences',
    );
  });
});

describe('parseFixtureReportFiles', () => {
  it('parses the six sample TSV reports', () => {
    const parsed = parseFixtureReportFiles([
      load('sample-ramp-campaigns.txt'),
      load('sample-ramp-spend.txt'),
      load('sample-ramp-targets.txt'),
      load('sample-ramp-clicks.txt'),
      load('sample-ramp-placements.txt'),
      load('sample-ramp-audiences.txt'),
    ]);
    expect(parsed.asOf).toBe('2026-10-22');
    expect(parsed.campaigns).toHaveLength(3);
    const exact = parsed.campaigns.find((c) => c.id === 'camp-exact');
    expect(exact?.adGroups).toHaveLength(1);
    expect(exact?.targets).toHaveLength(2);
    expect(exact?.spendByDate['2026-10-21']).toBe(1.4);
    expect(exact?.targets[0]?.adGroupId).toBe('ag-exact-core');
  });

  it('requires the core report set', () => {
    expect(() =>
      parseFixtureReportFiles([load('sample-ramp-campaigns.txt')]),
    ).toThrow(/Missing required/i);
  });
});
