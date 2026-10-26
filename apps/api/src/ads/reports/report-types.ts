import type {
  AudienceEntity,
  CampaignEntity,
  PlacementEntity,
  TargetEntity,
} from '../../ramp/types';

export type AdGroupEntity = {
  id: string;
  name: string;
  targets: TargetEntity[];
};

export type CampaignWithAdGroups = CampaignEntity & {
  adGroups: AdGroupEntity[];
};

export type ParsedRampReport = {
  asOf: string;
  campaigns: CampaignWithAdGroups[];
};

export type RampReportFile = {
  filename: string;
  text: string;
};

export type { AudienceEntity, PlacementEntity, TargetEntity };
