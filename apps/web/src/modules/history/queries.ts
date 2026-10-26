import { useQuery } from '@tanstack/react-query';
import * as historyApi from './api';

export const historyKeys = {
  all: ['changelog'] as const,
  list: (page: number, pageSize: number, campaignId?: string) =>
    [...historyKeys.all, 'list', page, pageSize, campaignId ?? null] as const,
  campaigns: () => [...historyKeys.all, 'campaigns'] as const,
};

export function useChangelogList(
  page: number,
  pageSize: number,
  campaignId?: string,
) {
  return useQuery({
    queryKey: historyKeys.list(page, pageSize, campaignId),
    queryFn: () => historyApi.listChangelog(page, pageSize, campaignId),
  });
}

export function useChangelogCampaignOptions() {
  return useQuery({
    queryKey: historyKeys.campaigns(),
    queryFn: () => historyApi.listChangelogCampaigns(),
  });
}
