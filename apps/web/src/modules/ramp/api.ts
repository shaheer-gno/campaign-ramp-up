import { postJson } from '../../shared/api/client';
import {
  LIST_PAGE_SIZE,
  PREVIEW_PAGE_SIZE,
  type Percent,
} from '../../shared/constants';
import type {
  ApplyResult,
  Gate1Report,
  Group,
  PreviewResult,
} from './types';

export type RampCampaignInput = { id: string; percent: Percent };

export function generateReport(input: {
  files: { filename: string; text: string }[];
  spendThresholdUsd: number;
  clickCap: number;
  percent: Percent;
  page?: number;
  pageSize?: number;
}): Promise<Gate1Report> {
  return postJson<Gate1Report>('/ramp/generate', {
    ...input,
    page: input.page ?? 1,
    pageSize: input.pageSize ?? LIST_PAGE_SIZE,
  });
}

export function reportFromDb(input: {
  spendThresholdUsd: number;
  clickCap: number;
  percent: Percent;
  asOf?: string;
  page: number;
  pageSize?: number;
}): Promise<Gate1Report> {
  return postJson<Gate1Report>('/ramp/report-from-db', {
    ...input,
    pageSize: input.pageSize ?? LIST_PAGE_SIZE,
  });
}

export function gate1Ids(input: {
  spendThresholdUsd: number;
  asOf: string;
}): Promise<{ ids: string[] }> {
  return postJson<{ ids: string[] }>('/ramp/gate1-ids', input);
}

export function preview(input: {
  asOf: string;
  clickCap: number;
  groups: Group[];
  campaigns: RampCampaignInput[];
  page: number;
  pageSize?: number;
}): Promise<PreviewResult> {
  return postJson<PreviewResult>('/ramp/preview', {
    ...input,
    pageSize: input.pageSize ?? PREVIEW_PAGE_SIZE,
  });
}

export function apply(input: {
  asOf: string;
  clickCap: number;
  groups: Group[];
  campaigns: RampCampaignInput[];
}): Promise<ApplyResult> {
  return postJson<ApplyResult>('/ramp/apply', input);
}
