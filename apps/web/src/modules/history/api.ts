import { apiRequest } from '../../shared/api/client';
import { LIST_PAGE_SIZE } from '../../shared/constants';
import type { ChangeLogCampaignOption, ChangeLogPage } from './types';

export function listChangelog(
  page = 1,
  pageSize = LIST_PAGE_SIZE,
  campaignId?: string,
): Promise<ChangeLogPage> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (campaignId) params.set('campaignId', campaignId);
  return apiRequest<ChangeLogPage>(`/ramp/changelog?${params}`);
}

export function listChangelogCampaigns(): Promise<ChangeLogCampaignOption[]> {
  return apiRequest<ChangeLogCampaignOption[]>('/ramp/changelog/campaigns');
}
