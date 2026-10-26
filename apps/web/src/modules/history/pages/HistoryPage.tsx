import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { LIST_PAGE_SIZE } from '../../../shared/constants';
import { Pagination } from '../../../shared/ui/Pagination';
import { formatValue } from '../../ramp/lib/percent';
import { GROUP_LABEL } from '../../ramp/types';
import {
  useChangelogCampaignOptions,
  useChangelogList,
} from '../queries';

const PAGE_SIZE = LIST_PAGE_SIZE;
const historyRouteApi = getRouteApi('/history');

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${date} ${time}`;
}

export function HistoryPage() {
  const navigate = useNavigate();
  const { campaignId } = historyRouteApi.useSearch();
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [campaignId]);

  const campaignsQuery = useChangelogCampaignOptions();
  const query = useChangelogList(page, PAGE_SIZE, campaignId);

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const campaigns = campaignsQuery.data ?? [];
  const selected = campaigns.find((c) => c.id === campaignId);

  function setCampaignFilter(nextId: string) {
    void navigate({
      to: '/history',
      search: nextId ? { campaignId: nextId } : {},
    });
  }

  return (
    <main>
      <div className="page-head">
        <div>
          <h1>Change log</h1>
          <p className="lede">
            Every Confirm writes one row per field. Re-importing reports keeps
            this history; filter by campaign to audit a single ramp.
          </p>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>Listing</h2>
          <div className="panel-filters">
            <label className="inline">
              Campaign
              <select
                value={campaignId ?? ''}
                onChange={(e) => setCampaignFilter(e.target.value)}
              >
                <option value="">All campaigns</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {campaignId ? (
          <p className="hint">
            Campaign <strong>{selected?.name ?? campaignId}</strong>
          </p>
        ) : null}

        {query.isLoading ? (
          <p className="hint">Loading…</p>
        ) : query.isError ? (
          <p className="error">
            {query.error instanceof Error
              ? query.error.message
              : 'Failed to load change log'}
          </p>
        ) : items.length === 0 ? (
          <p className="hint">
            No changes logged yet. Confirm a ramp preview to populate this list.
          </p>
        ) : (
          <>
            <div className="table-wrap list-table">
              <table>
                <thead>
                  <tr>
                    <th className="left">When</th>
                    <th className="left">Campaign</th>
                    <th className="left">Group</th>
                    <th className="left">Field</th>
                    <th>Inc</th>
                    <th>Before</th>
                    <th>After</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id}>
                      <td className="left">{formatWhen(row.createdAt)}</td>
                      <td className="left campaign-name">{row.campaignName}</td>
                      <td className="left">
                        <span className="badge">{GROUP_LABEL[row.group]}</span>
                      </td>
                      <td className="left">
                        {row.group === 'placements'
                          ? row.label.replaceAll('_', ' ')
                          : row.label}
                      </td>
                      <td>{row.percent}%</td>
                      <td>{formatValue(row.group, row.before)}</td>
                      <td>{formatValue(row.group, row.after)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              pageSize={query.data?.pageSize ?? PAGE_SIZE}
              total={total}
              onPageChange={setPage}
            />
          </>
        )}
      </section>
    </main>
  );
}
