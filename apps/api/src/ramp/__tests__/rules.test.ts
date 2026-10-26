import {
  applyChangesToCampaign,
  buildCampaignReport,
  campaignsUnderSpend,
  clickWindow,
  proposedChanges,
  raisedBid,
  raisedModifier,
  spendDay,
} from '../rules';
import { SAMPLE_AS_OF, type CampaignEntity } from '../types';

const campaign: CampaignEntity = {
  id: 'c1',
  name: 'New exact',
  state: 'enabled',
  spendByDate: { '2026-10-21': 1.2, '2026-10-20': 0.4 },
  targets: [
    {
      id: 't-low',
      adGroupId: 'ag-1',
      kind: 'keyword',
      label: 'panda planner',
      matchType: 'exact',
      bid: 1,
      clicksByDate: { '2026-10-21': 1, '2026-10-20': 1 },
    },
    {
      id: 't-high',
      adGroupId: 'ag-1',
      kind: 'keyword',
      label: 'adhd planner',
      matchType: 'exact',
      bid: 1.5,
      clicksByDate: { '2026-10-21': 4, '2026-10-20': 2 },
    },
  ],
  placements: [
    { placement: 'top_of_search', percent: 0 },
    { placement: 'rest_of_search', percent: 10 },
    { placement: 'product_pages', percent: 20 },
  ],
  audiences: [
    { id: 'a1', name: 'Viewed brand', kind: 'standard', percent: 0 },
    { id: 'b1', name: 'Amazon Business', kind: 'b2b', percent: 15 },
  ],
};

describe('windows', () => {
  it('uses yesterday for spend and a 2-day click window', () => {
    expect(spendDay(SAMPLE_AS_OF)).toBe('2026-10-21');
    expect(clickWindow(SAMPLE_AS_OF)).toEqual(['2026-10-20', '2026-10-21']);
  });
});

describe('threshold', () => {
  it('keeps enabled campaigns under the spend threshold', () => {
    const fat: CampaignEntity = {
      ...campaign,
      id: 'c2',
      spendByDate: { '2026-10-21': 9 },
    };
    const paused: CampaignEntity = { ...campaign, id: 'c3', state: 'paused' };
    const listed = campaignsUnderSpend([campaign, fat, paused], SAMPLE_AS_OF, 3);
    expect(listed.map((c) => c.id)).toEqual(['c1']);
  });
});

describe('proposals', () => {
  const report = buildCampaignReport(campaign, SAMPLE_AS_OF, 10);

  it('raises only targets under 5 clicks', () => {
    const low = report.bidding.find((r) => r.id === 't-low');
    const high = report.bidding.find((r) => r.id === 't-high');
    expect(low?.eligible).toBe(true);
    expect(low?.proposedBid).toBe(1.1);
    expect(high?.clicks).toBe(6);
    expect(high?.eligible).toBe(false);
    expect(high?.proposedBid).toBe(1.5);
  });

  it('honors a custom click cap', () => {
    const loose = buildCampaignReport(campaign, SAMPLE_AS_OF, 10, 10);
    expect(loose.bidding.find((r) => r.id === 't-high')?.eligible).toBe(true);
    const tight = buildCampaignReport(campaign, SAMPLE_AS_OF, 10, 2);
    expect(tight.bidding.find((r) => r.id === 't-low')?.eligible).toBe(false);
  });

  it('raises search placements and skips product pages', () => {
    const byId = Object.fromEntries(report.placements.map((p) => [p.id, p]));
    expect(byId.top_of_search?.proposedPercent).toBe(10);
    expect(byId.rest_of_search?.proposedPercent).toBe(20);
    expect(byId.product_pages?.included).toBe(false);
    expect(byId.product_pages?.proposedPercent).toBe(20);
  });

  it('raises every standard audience and every B2B modifier', () => {
    expect(report.audience[0]?.proposedPercent).toBe(10);
    expect(report.b2b[0]?.proposedPercent).toBe(25);
  });

  it('applies only the groups requested', () => {
    const changes = proposedChanges(report, ['bidding']);
    expect(changes.map((c) => c.entityId)).toEqual(['t-low']);
    const next = applyChangesToCampaign(campaign, changes);
    expect(next.targets.find((t) => t.id === 't-low')?.bid).toBe(1.1);
    expect(next.placements[0]?.percent).toBe(0);
  });
});

describe('math', () => {
  it('multiplies bids and adds modifier points', () => {
    expect(raisedBid(0.33, 5)).toBe(0.35);
    expect(raisedModifier(0, 5)).toBe(5);
  });
});
