import { Modal } from '../../../shared/ui/Modal';
import { Pagination } from '../../../shared/ui/Pagination';
import { formatValue } from '../lib/percent';
import { GROUP_LABEL, type PreviewResult } from '../types';

type Props = {
  preview: PreviewResult;
  previewPage: number;
  busy: boolean;
  onClose: () => void;
  onPageChange: (page: number) => void;
  onConfirm: () => void;
};

export function PreviewApplyModal({
  preview,
  previewPage,
  busy,
  onClose,
  onPageChange,
  onConfirm,
}: Props) {
  return (
    <Modal title="Confirm ramp-up changes" onClose={onClose}>
      <p className="modal-lede">
        <strong>{preview.summary.changeCount.toLocaleString()}</strong> field
        {preview.summary.changeCount === 1 ? '' : 's'} will change across{' '}
        <strong>{preview.summary.campaignCount.toLocaleString()}</strong>{' '}
        campaign
        {preview.summary.campaignCount === 1 ? '' : 's'}. Showing a page of
        details below — Confirm still applies the full selection. Amazon is not
        updated.
      </p>
      {preview.summary.changeCount === 0 ? (
        <p className="hint">No eligible changes for this selection.</p>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="left">Campaign</th>
                  <th className="left">Group</th>
                  <th className="left">Field</th>
                  <th>Inc</th>
                  <th>Before</th>
                  <th>After</th>
                </tr>
              </thead>
              <tbody>
                {preview.changes.map((row) => (
                  <tr key={`${row.campaignId}-${row.group}-${row.entityId}`}>
                    <td className="left">{row.campaignName}</td>
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
            page={previewPage}
            pageSize={preview.pageSize}
            total={preview.total}
            onPageChange={onPageChange}
          />
        </>
      )}
      <div className="btn-row">
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy || preview.summary.changeCount === 0}
          onClick={onConfirm}
        >
          {busy
            ? 'Applying…'
            : `Confirm ${preview.summary.changeCount.toLocaleString()} change(s)`}
        </button>
      </div>
    </Modal>
  );
}
