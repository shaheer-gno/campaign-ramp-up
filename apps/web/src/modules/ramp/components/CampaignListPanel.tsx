import {
  PERCENT_OPTIONS,
  type Percent,
} from '../../../shared/constants';
import { Pagination } from '../../../shared/ui/Pagination';
import type { CampaignInc, Gate1Report, Group } from '../types';
import { groupOptions } from '../types';

type Props = {
  report: Gate1Report;
  listPage: number;
  selected: string[];
  incByCampaign: Record<string, CampaignInc>;
  defaultPercent: Percent;
  clickCap: number;
  groups: Group[];
  rampCount: number;
  allMatchingSelected: boolean;
  busy: boolean;
  onToggleGroup: (id: Group) => void;
  onSelectAllMatching: () => void;
  onTogglePageSelection: (checked: boolean) => void;
  onToggleCampaign: (id: string) => void;
  onIncChange: (id: string, value: CampaignInc) => void;
  onListPage: (page: number) => void;
  onOpenPreview: () => void;
};

export function CampaignListPanel({
  report,
  listPage,
  selected,
  incByCampaign,
  defaultPercent,
  clickCap,
  groups,
  rampCount,
  allMatchingSelected,
  busy,
  onToggleGroup,
  onSelectAllMatching,
  onTogglePageSelection,
  onToggleCampaign,
  onIncChange,
  onListPage,
  onOpenPreview,
}: Props) {
  const pageIds = report.campaigns.map((c) => c.id);
  const pageAllSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.includes(id));

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>
            {report.total} campaign{report.total === 1 ? '' : 's'} under $
            {report.spendThresholdUsd}
          </h2>
          <p className="hint">
            Spend day {report.spendDay} · click window {report.clickDays[0]} +{' '}
            {report.clickDays[1]} · default {defaultPercent}% · {rampCount}{' '}
            selected to ramp · click cap {clickCap}
          </p>
        </div>
        <div className="panel-head-actions">
          <button
            type="button"
            className="btn-secondary"
            disabled={busy || report.total === 0}
            onClick={onSelectAllMatching}
          >
            {allMatchingSelected
              ? `Deselect all (${report.total})`
              : `Select all matching (${report.total})`}
          </button>
        </div>
      </div>

      <div className="groups-bar">
        <span className="field-label">Apply groups</span>
        <div className="groups-row">
          {groupOptions(clickCap).map((g) => (
            <label key={g.id} className="chip-check">
              <input
                type="checkbox"
                checked={groups.includes(g.id)}
                onChange={() => onToggleGroup(g.id)}
              />
              <span>{g.label}</span>
            </label>
          ))}
        </div>
      </div>

      {report.total === 0 ? (
        <p className="hint">
          No campaigns under ${report.spendThresholdUsd} for this report.
        </p>
      ) : (
        <>
          <div className="table-wrap list-table">
            <table>
              <thead>
                <tr>
                  <th className="col-check">
                    <input
                      type="checkbox"
                      checked={pageAllSelected}
                      aria-label="Select all on this page"
                      onChange={(e) => onTogglePageSelection(e.target.checked)}
                    />
                  </th>
                  <th className="left">Campaign</th>
                  <th>Yesterday spend</th>
                  <th>Inc Low Clicks</th>
                </tr>
              </thead>
              <tbody>
                {report.campaigns.map((c) => {
                  const override = incByCampaign[c.id] ?? 'default';
                  const skipped = override === 'skip';
                  const checked = selected.includes(c.id);
                  return (
                    <tr
                      key={c.id}
                      className={
                        !checked || skipped ? 'row-inactive' : undefined
                      }
                    >
                      <td className="col-check">
                        <input
                          type="checkbox"
                          checked={checked}
                          aria-label={`Select ${c.name}`}
                          onChange={() => onToggleCampaign(c.id)}
                        />
                      </td>
                      <td className="left campaign-name">{c.name}</td>
                      <td>${c.spendYesterday.toFixed(2)}</td>
                      <td>
                        <select
                          className="inc-select"
                          value={String(override)}
                          aria-label={`Increase for ${c.name}`}
                          onChange={(e) => {
                            const v = e.target.value;
                            const next: CampaignInc =
                              v === 'default' || v === 'skip'
                                ? v
                                : (Number(v) as Percent);
                            onIncChange(c.id, next);
                          }}
                        >
                          <option value="default">
                            Default ({defaultPercent}%)
                          </option>
                          {PERCENT_OPTIONS.map((n) => (
                            <option key={n} value={n}>
                              {n}%
                            </option>
                          ))}
                          <option value="skip">Skip</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={listPage}
            pageSize={report.pageSize}
            total={report.total}
            onPageChange={onListPage}
          />
        </>
      )}

      <div className="btn-row">
        <button
          type="button"
          disabled={busy || rampCount === 0 || groups.length === 0}
          onClick={onOpenPreview}
        >
          Review & apply ({rampCount})
        </button>
      </div>
    </section>
  );
}
