/**
 * Production report import: panda-planner CSV package only.
 * Sample TSV / JSON fixtures live in parse-fixture-report.ts (tests).
 */

import { looksLikePandaPackage } from './detect-panda-report';
import { parsePandaReportFiles } from './parse-panda-report';
import type { ParsedRampReport, RampReportFile } from './report-types';

export type {
  AdGroupEntity,
  CampaignWithAdGroups,
  ParsedRampReport,
  RampReportFile,
} from './report-types';

/**
 * Parse the five required panda CSVs into a snapshot graph.
 * Rejects legacy TSV/JSON — use parseFixtureReportFiles in tests.
 */
export function parseRampReportFiles(files: RampReportFile[]): ParsedRampReport {
  if (files.length === 0) {
    throw new Error('Upload the five required panda report CSVs');
  }
  if (!looksLikePandaPackage(files)) {
    throw new Error(
      'Unrecognized files. Upload the five required panda-planner CSVs (campaigns state, ad groups state, targets state, campaign daily, target daily).',
    );
  }
  return parsePandaReportFiles(files);
}
