import { BadRequestException, Injectable } from '@nestjs/common';
import { AdsService } from '../ads/ads.service';
import {
  APPLY_CAMPAIGN_BATCH,
  LIST_PAGE_SIZE_DEFAULT,
  LIST_PAGE_SIZE_MAX,
  PREVIEW_PAGE_SIZE_DEFAULT,
  PREVIEW_PAGE_SIZE_MAX,
  normalizePage,
  normalizePageSize,
  slicePage,
} from './paging';
import {
  applyChangesToCampaign,
  buildCampaignReport,
  campaignsUnderSpend,
  clickWindow,
  isRampPercent,
  proposedChanges,
  spendDay,
  spendOn,
} from './rules';
import {
  DEFAULT_CLICK_CAP,
  DEFAULT_PERCENT,
  DEFAULT_SPEND_THRESHOLD_USD,
  SAMPLE_AS_OF,
  type CampaignEntity,
  type ChangeLogEntry,
  type RampGroup,
  type RampPercent,
} from './types';

const GROUPS: RampGroup[] = ['bidding', 'placements', 'audience', 'b2b'];

export type CampaignRampInput = {
  id: string;
  percent: RampPercent;
};

export type PreviewChangeRow = {
  campaignId: string;
  campaignName: string;
  group: RampGroup;
  entityId: string;
  label: string;
  before: number;
  after: number;
  percent: RampPercent;
};

export type Gate1ListRow = {
  id: string;
  name: string;
  spendYesterday: number;
};

@Injectable()
export class RampService {
  constructor(private readonly ads: AdsService) {}

  /**
   * Import report text into the working snapshot, then return a paginated
   * Gate-1 campaign list (lean rows only).
   */
  async generate(input: {
    files: { filename: string; text: string }[];
    spendThresholdUsd?: number;
    clickCap?: number;
    percent?: number;
    asOf?: string;
    page?: number;
    pageSize?: number;
  }) {
    let parsed;
    try {
      parsed = this.ads.parseReportFiles(input.files ?? []);
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Invalid report',
      );
    }

    const asOf = input.asOf ?? parsed.asOf ?? SAMPLE_AS_OF;
    const spendThresholdUsd =
      input.spendThresholdUsd ?? DEFAULT_SPEND_THRESHOLD_USD;
    const clickCap = this.requireClickCap(input.clickCap);
    const percent = this.requirePercent(input.percent ?? DEFAULT_PERCENT);
    if (spendThresholdUsd < 0) {
      throw new BadRequestException('spendThresholdUsd must be >= 0');
    }

    await this.ads.replaceSnapshot(parsed.campaigns);
    return this.buildGate1Response({
      asOf,
      spendThresholdUsd,
      clickCap,
      percent,
      page: input.page,
      pageSize: input.pageSize,
      imported: {
        filename: input.files.map((f) => f.filename).join(', '),
        fileCount: input.files.length,
        campaignCount: parsed.campaigns.length,
      },
    });
  }

  /** Gate-1 list from the current DB snapshot (no file import). */
  async reportFromDb(input: {
    spendThresholdUsd?: number;
    clickCap?: number;
    percent?: number;
    asOf?: string;
    page?: number;
    pageSize?: number;
  }) {
    const asOf = input.asOf ?? SAMPLE_AS_OF;
    const spendThresholdUsd =
      input.spendThresholdUsd ?? DEFAULT_SPEND_THRESHOLD_USD;
    const clickCap = this.requireClickCap(input.clickCap);
    const percent = this.requirePercent(input.percent ?? DEFAULT_PERCENT);
    if (spendThresholdUsd < 0) {
      throw new BadRequestException('spendThresholdUsd must be >= 0');
    }
    return this.buildGate1Response({
      asOf,
      spendThresholdUsd,
      clickCap,
      percent,
      page: input.page,
      pageSize: input.pageSize,
      imported: { filename: null, fileCount: 0, campaignCount: 0 },
    });
  }

  /** All Gate-1 campaign ids (for “select all matching”). */
  async gate1Ids(input: {
    spendThresholdUsd?: number;
    asOf?: string;
  }): Promise<{ asOf: string; spendThresholdUsd: number; ids: string[] }> {
    const asOf = input.asOf ?? SAMPLE_AS_OF;
    const spendThresholdUsd =
      input.spendThresholdUsd ?? DEFAULT_SPEND_THRESHOLD_USD;
    if (spendThresholdUsd < 0) {
      throw new BadRequestException('spendThresholdUsd must be >= 0');
    }
    const listed = await this.listGate1(asOf, spendThresholdUsd);
    return {
      asOf,
      spendThresholdUsd,
      ids: listed.map((c) => c.id),
    };
  }

  /**
   * Preview changes for the selection. Returns a summary plus one page of
   * detail rows (not the full thousands of lines).
   */
  async preview(input: {
    asOf?: string;
    clickCap?: number;
    groups: RampGroup[];
    campaigns: CampaignRampInput[];
    page?: number;
    pageSize?: number;
  }) {
    const { asOf, groups, ramps, clickCap } = this.parseApplyInput(input);
    const page = normalizePage(input.page);
    const pageSize = normalizePageSize(
      input.pageSize,
      PREVIEW_PAGE_SIZE_DEFAULT,
      PREVIEW_PAGE_SIZE_MAX,
    );

    const allChanges = await this.collectChanges(
      asOf,
      groups,
      ramps,
      clickCap,
    );
    const sliced = slicePage(allChanges, page, pageSize);
    const campaignIds = new Set(allChanges.map((c) => c.campaignId));

    return {
      summary: {
        campaignCount: campaignIds.size,
        changeCount: allChanges.length,
      },
      changes: sliced.items,
      total: sliced.total,
      page: sliced.page,
      pageSize: sliced.pageSize,
    };
  }

  async apply(input: {
    asOf?: string;
    clickCap?: number;
    groups: RampGroup[];
    campaigns: CampaignRampInput[];
  }) {
    const { asOf, groups, ramps, clickCap } = this.parseApplyInput(input);
    const createdAt = new Date().toISOString();
    let applied = 0;
    let campaignsProcessed = 0;

    for (let i = 0; i < ramps.length; i += APPLY_CAMPAIGN_BATCH) {
      const batch = ramps.slice(i, i + APPLY_CAMPAIGN_BATCH);
      const entities = await this.ads.listCampaignsByIds(
        batch.map((r) => r.id),
      );
      const byId = new Map(entities.map((c) => [c.id, c]));
      const entries: ChangeLogEntry[] = [];
      const updated: CampaignEntity[] = [];

      for (const ramp of batch) {
        const campaign = byId.get(ramp.id);
        if (!campaign) continue;
        campaignsProcessed += 1;
        const report = buildCampaignReport(
          campaign,
          asOf,
          ramp.percent,
          clickCap,
        );
        const changes = proposedChanges(report, groups);
        for (const change of changes) {
          entries.push({
            id: crypto.randomUUID(),
            createdAt,
            campaignId: campaign.id,
            campaignName: campaign.name,
            group: change.group,
            entityId: change.entityId,
            label: change.label,
            before: change.before,
            after: change.after,
            percent: ramp.percent,
          });
        }
        updated.push(applyChangesToCampaign(campaign, changes));
      }

      await this.ads.applyRampBatch({
        campaigns: updated,
        logEntries: entries,
      });
      applied += entries.length;
    }

    return {
      applied,
      campaignsProcessed,
      campaignRequested: ramps.length,
    };
  }

  changelog(input: {
    page?: number;
    pageSize?: number;
    campaignId?: string;
  } = {}) {
    const page = normalizePage(input.page);
    const pageSize = normalizePageSize(
      input.pageSize,
      LIST_PAGE_SIZE_DEFAULT,
      LIST_PAGE_SIZE_MAX,
    );
    const campaignId = input.campaignId?.trim() || undefined;
    return this.ads.listChangeLogPage({ page, pageSize, campaignId });
  }

  changelogCampaigns() {
    return this.ads.listChangeLogCampaigns();
  }

  private async collectChanges(
    asOf: string,
    groups: RampGroup[],
    ramps: CampaignRampInput[],
    clickCap: number,
  ): Promise<PreviewChangeRow[]> {
    const changes: PreviewChangeRow[] = [];
    for (let i = 0; i < ramps.length; i += APPLY_CAMPAIGN_BATCH) {
      const batch = ramps.slice(i, i + APPLY_CAMPAIGN_BATCH);
      const entities = await this.ads.listCampaignsByIds(
        batch.map((r) => r.id),
      );
      const byId = new Map(entities.map((c) => [c.id, c]));
      for (const ramp of batch) {
        const campaign = byId.get(ramp.id);
        if (!campaign) continue;
        const report = buildCampaignReport(
          campaign,
          asOf,
          ramp.percent,
          clickCap,
        );
        for (const change of proposedChanges(report, groups)) {
          changes.push({
            campaignId: campaign.id,
            campaignName: campaign.name,
            group: change.group,
            entityId: change.entityId,
            label: change.label,
            before: change.before,
            after: change.after,
            percent: ramp.percent,
          });
        }
      }
    }
    return changes;
  }

  private parseApplyInput(input: {
    asOf?: string;
    clickCap?: number;
    groups: RampGroup[];
    campaigns: CampaignRampInput[];
  }) {
    const groups = input.groups.filter((g) => GROUPS.includes(g));
    if (groups.length === 0) {
      throw new BadRequestException('Pick at least one group');
    }
    if (!input.campaigns?.length) {
      throw new BadRequestException('Pick at least one campaign to ramp');
    }
    const ramps: CampaignRampInput[] = [];
    const seen = new Set<string>();
    for (const row of input.campaigns) {
      if (!row?.id || seen.has(row.id)) continue;
      if (!isRampPercent(row.percent)) {
        throw new BadRequestException(
          `percent for ${row.id} must be 3, 5, 7, or 10`,
        );
      }
      seen.add(row.id);
      ramps.push({ id: row.id, percent: row.percent });
    }
    if (ramps.length === 0) {
      throw new BadRequestException('Pick at least one campaign to ramp');
    }
    return {
      asOf: input.asOf ?? SAMPLE_AS_OF,
      clickCap: this.requireClickCap(input.clickCap),
      groups,
      ramps,
    };
  }

  private requirePercent(percent: number): RampPercent {
    if (!isRampPercent(percent)) {
      throw new BadRequestException('percent must be 3, 5, 7, or 10');
    }
    return percent;
  }

  private requireClickCap(clickCap?: number): number {
    const n = clickCap ?? DEFAULT_CLICK_CAP;
    if (!Number.isFinite(n) || n < 0) {
      throw new BadRequestException('clickCap must be >= 0');
    }
    return n;
  }

  private async listGate1(
    asOf: string,
    spendThresholdUsd: number,
  ): Promise<CampaignEntity[]> {
    const campaigns = await this.ads.listCampaigns();
    return campaignsUnderSpend(campaigns, asOf, spendThresholdUsd);
  }

  private async buildGate1Response(input: {
    asOf: string;
    spendThresholdUsd: number;
    clickCap: number;
    percent: RampPercent;
    page?: number;
    pageSize?: number;
    imported: {
      filename: string | null;
      fileCount: number;
      campaignCount: number;
    };
  }) {
    const page = normalizePage(input.page);
    const pageSize = normalizePageSize(
      input.pageSize,
      LIST_PAGE_SIZE_DEFAULT,
      LIST_PAGE_SIZE_MAX,
    );
    const listed = await this.listGate1(input.asOf, input.spendThresholdUsd);
    const day = spendDay(input.asOf);
    const lean: Gate1ListRow[] = listed.map((c) => ({
      id: c.id,
      name: c.name,
      spendYesterday: spendOn(c, day),
    }));
    const sliced = slicePage(lean, page, pageSize);

    return {
      asOf: input.asOf,
      spendDay: day,
      clickDays: clickWindow(input.asOf),
      spendThresholdUsd: input.spendThresholdUsd,
      percent: input.percent,
      clickCap: input.clickCap,
      imported: input.imported,
      campaigns: sliced.items,
      total: sliced.total,
      page: sliced.page,
      pageSize: sliced.pageSize,
    };
  }
}
