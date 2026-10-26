import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type {
  AudienceEntity,
  CampaignEntity,
  ChangeLogEntry,
  Placement,
  TargetEntity,
} from '../ramp/types';
import type { CampaignWithAdGroups } from './reports/report-types';

type CampaignRow = { id: string; name: string; state: CampaignEntity['state'] };
type SpendRow = { campaign_id: string; day: string; spend_usd: number };
type TargetRow = {
  id: string;
  campaign_id: string;
  ad_group_id: string;
  kind: TargetEntity['kind'];
  label: string;
  match_type: string | null;
  bid: number;
};
type ClickRow = { target_id: string; day: string; clicks: number };
type PlacementRow = {
  campaign_id: string;
  placement: Placement;
  percent: number;
};
type AudienceRow = {
  id: string;
  campaign_id: string;
  name: string;
  kind: AudienceEntity['kind'];
  percent: number;
};
type LogRow = {
  id: string;
  created_at: string;
  campaign_id: string;
  campaign_name: string;
  change_group: ChangeLogEntry['group'];
  entity_id: string;
  label: string;
  before_value: number;
  after_value: number;
  percent: ChangeLogEntry['percent'];
};

@Injectable()
export class AdsRepository {
  private readonly logger = new Logger(AdsRepository.name);

  constructor(private readonly supabase: SupabaseService) {}

  async listCampaigns(): Promise<CampaignEntity[]> {
    return this.hydrateCampaigns(await this.select<CampaignRow>('campaigns'));
  }

  /** Load full entities for a subset of campaign ids (apply/preview batches). */
  async listCampaignsByIds(ids: string[]): Promise<CampaignEntity[]> {
    if (ids.length === 0) return [];
    const unique = [...new Set(ids)];
    const { data, error } = await this.supabase.client
      .from('campaigns')
      .select('*')
      .in('id', unique);
    if (error) this.fail('select campaigns by id', error.message);
    return this.hydrateCampaigns((data ?? []) as CampaignRow[]);
  }

  private async hydrateCampaigns(
    campaigns: CampaignRow[],
  ): Promise<CampaignEntity[]> {
    if (campaigns.length === 0) return [];
    const ids = campaigns.map((c) => c.id);
    const [spend, targets, clicks, placements, audiences] = await Promise.all([
      this.selectIn<SpendRow>('campaign_daily_spend', 'campaign_id', ids),
      this.selectIn<TargetRow>('targets', 'campaign_id', ids),
      this.selectTargetClicksForCampaignIds(ids),
      this.selectIn<PlacementRow>('placement_modifiers', 'campaign_id', ids),
      this.selectIn<AudienceRow>('audience_modifiers', 'campaign_id', ids),
    ]);

    const clicksByTarget = new Map<string, Record<string, number>>();
    for (const row of clicks) {
      const bag = clicksByTarget.get(row.target_id) ?? {};
      bag[String(row.day).slice(0, 10)] = Number(row.clicks);
      clicksByTarget.set(row.target_id, bag);
    }

    return campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      state: campaign.state,
      spendByDate: Object.fromEntries(
        spend
          .filter((s) => s.campaign_id === campaign.id)
          .map((s) => [String(s.day).slice(0, 10), Number(s.spend_usd)]),
      ),
      targets: targets
        .filter((t) => t.campaign_id === campaign.id)
        .map((t) => ({
          id: t.id,
          adGroupId: t.ad_group_id,
          kind: t.kind,
          label: t.label,
          matchType: t.match_type,
          bid: Number(t.bid),
          clicksByDate: clicksByTarget.get(t.id) ?? {},
        })),
      placements: placements
        .filter((p) => p.campaign_id === campaign.id)
        .map((p) => ({ placement: p.placement, percent: Number(p.percent) })),
      audiences: audiences
        .filter((a) => a.campaign_id === campaign.id)
        .map((a) => ({
          id: a.id,
          name: a.name,
          kind: a.kind,
          percent: Number(a.percent),
        })),
    }));
  }

  private async selectTargetClicksForCampaignIds(
    campaignIds: string[],
  ): Promise<ClickRow[]> {
    const targets = await this.selectIn<TargetRow>(
      'targets',
      'campaign_id',
      campaignIds,
    );
    const targetIds = targets.map((t) => t.id);
    if (targetIds.length === 0) return [];
    return this.selectIn<ClickRow>('target_daily_clicks', 'target_id', targetIds);
  }

  private async selectIn<T>(
    table: string,
    column: string,
    ids: string[],
  ): Promise<T[]> {
    if (ids.length === 0) return [];
    // PostgREST .in() is fine for moderate batches; chunk if very large.
    const chunkSize = 200;
    const out: T[] = [];
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const { data, error } = await this.supabase.client
        .from(table)
        .select('*')
        .in(column, chunk);
      if (error) this.fail(`select ${table} in`, error.message);
      out.push(...((data ?? []) as T[]));
    }
    return out;
  }

  /**
   * Replace working snapshot from an imported report. Keeps change_log.
   * Single DB transaction via replace_ads_snapshot RPC.
   */
  async replaceSnapshot(campaigns: CampaignWithAdGroups[]): Promise<void> {
    const payload = campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      state: c.state,
      spendByDate: c.spendByDate,
      adGroups: c.adGroups.map((ag) => ({ id: ag.id, name: ag.name })),
      targets: c.targets.map((t) => ({
        id: t.id,
        adGroupId: t.adGroupId,
        kind: t.kind,
        label: t.label,
        matchType: t.matchType,
        bid: t.bid,
        clicksByDate: t.clicksByDate,
      })),
      placements: c.placements,
      audiences: c.audiences,
    }));

    const { error } = await this.supabase.client.rpc('replace_ads_snapshot', {
      payload,
    });
    if (error) this.fail('replace_ads_snapshot', error.message);
  }

  /**
   * Apply bid/modifier updates + change_log rows in one transaction.
   */
  async applyRampBatch(input: {
    campaigns: CampaignEntity[];
    logEntries: ChangeLogEntry[];
  }): Promise<void> {
    const targetBids = input.campaigns.flatMap((c) =>
      c.targets.map((t) => ({ id: t.id, bid: t.bid })),
    );
    const placements = input.campaigns.flatMap((c) =>
      c.placements.map((p) => ({
        campaignId: c.id,
        placement: p.placement,
        percent: p.percent,
      })),
    );
    const audiences = input.campaigns.flatMap((c) =>
      c.audiences.map((a) => ({
        campaignId: c.id,
        id: a.id,
        percent: a.percent,
      })),
    );

    const { error } = await this.supabase.client.rpc('apply_ramp_batch', {
      p_target_bids: targetBids,
      p_placements: placements,
      p_audiences: audiences,
      p_log: input.logEntries.map((e) => ({
        id: e.id,
        createdAt: e.createdAt,
        campaignId: e.campaignId,
        campaignName: e.campaignName,
        group: e.group,
        entityId: e.entityId,
        label: e.label,
        before: e.before,
        after: e.after,
        percent: e.percent,
      })),
    });
    if (error) this.fail('apply_ramp_batch', error.message);
  }

  async listChangeLogPage(input: {
    page: number;
    pageSize: number;
    campaignId?: string;
  }): Promise<{
    items: ChangeLogEntry[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const from = (input.page - 1) * input.pageSize;
    const to = from + input.pageSize - 1;

    let query = this.supabase.client
      .from('change_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (input.campaignId) {
      query = query.eq('campaign_id', input.campaignId);
    }

    const { data, error, count } = await query;
    if (error) this.fail('list change_log', error.message);

    return {
      items: ((data ?? []) as LogRow[]).map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        campaignId: row.campaign_id,
        campaignName: row.campaign_name,
        group: row.change_group,
        entityId: row.entity_id,
        label: row.label,
        before: Number(row.before_value),
        after: Number(row.after_value),
        percent: row.percent,
      })),
      total: count ?? 0,
      page: input.page,
      pageSize: input.pageSize,
    };
  }

  /** Distinct campaigns that appear in the change log (survives re-import). */
  async listChangeLogCampaigns(): Promise<
    Array<{ id: string; name: string }>
  > {
    const { data, error } = await this.supabase.client
      .from('change_log')
      .select('campaign_id, campaign_name, created_at')
      .order('created_at', { ascending: false });
    if (error) this.fail('list change_log campaigns', error.message);

    const byId = new Map<string, string>();
    for (const row of (data ?? []) as Array<{
      campaign_id: string;
      campaign_name: string;
    }>) {
      if (!byId.has(row.campaign_id)) {
        byId.set(row.campaign_id, row.campaign_name);
      }
    }
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  private async select<T>(table: string): Promise<T[]> {
    const { data, error } = await this.supabase.client.from(table).select('*');
    if (error) this.fail(`select ${table}`, error.message);
    return (data ?? []) as T[];
  }

  private fail(action: string, message: string): never {
    this.logger.error(`${action}: ${message}`);
    throw new ServiceUnavailableException(`${action}: ${message}`);
  }
}
