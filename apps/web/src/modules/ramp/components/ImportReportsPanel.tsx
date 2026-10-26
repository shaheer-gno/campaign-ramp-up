import { useMemo, useRef } from 'react';
import {
  detectPandaReport,
  PANDA_LABELS,
  PANDA_REQUIRED,
} from '@ramp/panda-detect';
import { PERCENT_OPTIONS, type Percent } from '../../../shared/constants';
import type { StagedFile } from '../types';

type Props = {
  staged: StagedFile[];
  onStagedChange: (next: StagedFile[]) => void;
  uploadNote: string | null;
  onUploadNote: (note: string | null) => void;
  threshold: number;
  onThreshold: (n: number) => void;
  clickCap: number;
  onClickCap: (n: number) => void;
  defaultPercent: Percent;
  onDefaultPercent: (p: Percent) => void;
  busy: boolean;
  onImport: () => void;
  onError: (msg: string | null) => void;
};

export function ImportReportsPanel({
  staged,
  onStagedChange,
  uploadNote,
  onUploadNote,
  threshold,
  onThreshold,
  clickCap,
  onClickCap,
  defaultPercent,
  onDefaultPercent,
  busy,
  onImport,
  onError,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const byKind = useMemo(() => {
    const map = new Map<StagedFile['kind'], StagedFile>();
    for (const f of staged) map.set(f.kind, f);
    return map;
  }, [staged]);

  const canImport = PANDA_REQUIRED.every((k) => byKind.has(k));

  async function addFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    onUploadNote(null);
    onError(null);
    const next = [...staged];
    const skipped: string[] = [];

    for (const file of Array.from(fileList)) {
      const text = await file.text();
      const detected = detectPandaReport(text);
      if (detected.kind === 'ignored') {
        skipped.push(`${file.name} — ${detected.reason}`);
        continue;
      }
      if (detected.kind === 'unknown') {
        skipped.push(`${file.name} — unrecognized headers`);
        continue;
      }
      const entry: StagedFile = {
        name: file.name,
        text,
        kind: detected.kind,
      };
      const idx = next.findIndex((f) => f.kind === detected.kind);
      if (idx >= 0) next[idx] = entry;
      else next.push(entry);
    }

    onStagedChange(next);
    if (skipped.length > 0) {
      onUploadNote(`Skipped: ${skipped.join('; ')}`);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <section className="panel setup-panel">
      <div className="setup-head">
        <h2>Import reports</h2>
        <p className="hint">
          Upload the five required panda-planner CSVs (campaigns state, ad groups
          state, targets state, campaign daily, target daily). Placement daily and
          audiences dictionary are not used.
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.txt,.tsv,text/csv,text/plain,text/tab-separated-values"
        multiple
        hidden
        onChange={(e) => void addFiles(e.target.files)}
      />

      <div className="upload-row">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => fileInputRef.current?.click()}
        >
          Choose report files…
        </button>
        {canImport ? (
          <span className="upload-count">All 5 required files ready</span>
        ) : (
          <span className="hint">
            {staged.length} of 5 required files staged
          </span>
        )}
      </div>

      <ul className="import-checklist">
        {PANDA_REQUIRED.map((kind) => {
          const file = byKind.get(kind);
          return (
            <li key={kind} className={file ? 'ok' : 'missing'}>
              <span>{PANDA_LABELS[kind]}</span>
              <strong>{file ? file.name : 'Missing'}</strong>
            </li>
          );
        })}
      </ul>

      {staged.length > 0 ? (
        <ul className="file-chips">
          {staged.map((f) => (
            <li key={f.kind} className="file-chip">
              <span className="file-chip-name" title={f.name}>
                {f.name}
              </span>
              <button
                type="button"
                className="file-chip-remove"
                aria-label={`Remove ${f.name}`}
                onClick={() =>
                  onStagedChange(staged.filter((x) => x.kind !== f.kind))
                }
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {uploadNote ? <p className="hint">{uploadNote}</p> : null}

      <div className="setup-toolbar">
        <label className="field">
          <span className="field-label">Spend threshold (USD)</span>
          <div className="field-input-wrap">
            <span className="field-prefix">$</span>
            <input
              type="number"
              min={0}
              step="0.5"
              value={threshold}
              onChange={(e) => onThreshold(Number(e.target.value))}
            />
          </div>
        </label>

        <label className="field">
          <span className="field-label">Click cap (2-day)</span>
          <div className="field-input-wrap">
            <input
              type="number"
              min={0}
              step={1}
              value={clickCap}
              onChange={(e) => onClickCap(Number(e.target.value))}
            />
          </div>
        </label>

        <div className="field">
          <span className="field-label">Default increase</span>
          <div
            className="segment"
            role="radiogroup"
            aria-label="Default increase"
          >
            {PERCENT_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={defaultPercent === n}
                className={
                  defaultPercent === n ? 'segment-btn active' : 'segment-btn'
                }
                onClick={() => onDefaultPercent(n)}
              >
                {n}%
              </button>
            ))}
          </div>
        </div>

        <div className="setup-actions">
          <button
            type="button"
            className="btn-primary"
            disabled={busy || !canImport}
            onClick={onImport}
          >
            {busy ? 'Working…' : 'Import & generate'}
          </button>
        </div>
      </div>
    </section>
  );
}
