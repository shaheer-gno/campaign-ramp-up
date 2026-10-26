import type { Percent } from '../../shared/constants';

export type Group = 'bidding' | 'placements' | 'audience' | 'b2b';
export type CampaignInc = 'default' | Percent | 'skip';

export type StagedFile = {
  name: string;
  text: string;
  kind: import('@ramp/panda-detect').PandaReportKind;
};

export type CampaignReport = {
  id: string;
  name: string;
  spendYesterday: number;
};

export type Gate1Report = {
  asOf: string;
  spendDay: string;
  clickDays: [string, string];
  spendThresholdUsd: number;
  percent: Percent;
  clickCap: number;
  imported: {
    filename: string | null;
    fileCount: number;
    campaignCount: number;
  };
  campaigns: CampaignReport[];
  total: number;
  page: number;
  pageSize: number;
};

export type PreviewChange = {
  campaignId: string;
  campaignName: string;
  group: Group;
  entityId: string;
  label: string;
  before: number;
  after: number;
  percent: Percent;
};

export type PreviewResult = {
  summary: { campaignCount: number; changeCount: number };
  changes: PreviewChange[];
  total: number;
  page: number;
  pageSize: number;
};

export type ApplyResult = {
  applied: number;
  campaignsProcessed: number;
};

export const GROUP_LABEL: Record<Group, string> = {
  bidding: 'Bidding',
  placements: 'Placement',
  audience: 'Audience',
  b2b: 'B2B',
};

export function groupOptions(clickCap: number): { id: Group; label: string }[] {
  return [
    { id: 'bidding', label: `Bidding (targets under ${clickCap} clicks)` },
    { id: 'placements', label: 'Placements (Top + Rest of Search)' },
    { id: 'audience', label: 'Audience' },
    { id: 'b2b', label: 'B2B' },
  ];
}
