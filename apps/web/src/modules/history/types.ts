import type { Group } from '../ramp/types';
import type { Percent } from '../../shared/constants';

export type ChangeLogEntry = {
  id: string;
  createdAt: string;
  campaignId: string;
  campaignName: string;
  group: Group;
  entityId: string;
  label: string;
  before: number;
  after: number;
  percent: Percent;
};

export type ChangeLogPage = {
  items: ChangeLogEntry[];
  total: number;
  page: number;
  pageSize: number;
};

export type ChangeLogCampaignOption = {
  id: string;
  name: string;
};
