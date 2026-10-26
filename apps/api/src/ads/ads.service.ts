import { Injectable } from '@nestjs/common';
import type { CampaignEntity, ChangeLogEntry } from '../ramp/types';
import { AdsRepository } from './ads.repository';
import { parseRampReportFiles } from './reports/parse-ramp-report';
import type {
  CampaignWithAdGroups,
  ParsedRampReport,
  RampReportFile,
} from './reports/report-types';

/**
 * Internal Amazon Ads snapshot API for the ramp feature.
 * No HTTP controller — consumed only by RampService.
 */
@Injectable()
export class AdsService {
  constructor(private readonly repo: AdsRepository) {}

  /** Parse panda CSV package into a snapshot graph. */
  parseReportFiles(files: RampReportFile[]): ParsedRampReport {
    return parseRampReportFiles(files);
  }

  replaceSnapshot(campaigns: CampaignWithAdGroups[]): Promise<void> {
    return this.repo.replaceSnapshot(campaigns);
  }

  listCampaigns(): Promise<CampaignEntity[]> {
    return this.repo.listCampaigns();
  }

  listCampaignsByIds(ids: string[]): Promise<CampaignEntity[]> {
    return this.repo.listCampaignsByIds(ids);
  }

  /** Persist campaign updates + change_log in one DB transaction. */
  applyRampBatch(input: {
    campaigns: CampaignEntity[];
    logEntries: ChangeLogEntry[];
  }): Promise<void> {
    return this.repo.applyRampBatch(input);
  }

  listChangeLogPage(input: {
    page: number;
    pageSize: number;
    campaignId?: string;
  }) {
    return this.repo.listChangeLogPage(input);
  }

  listChangeLogCampaigns() {
    return this.repo.listChangeLogCampaigns();
  }
}
