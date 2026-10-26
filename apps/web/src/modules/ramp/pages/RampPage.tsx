import { PANDA_REQUIRED } from '@ramp/panda-detect';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  DEFAULT_CLICK_CAP,
  DEFAULT_PERCENT,
  DEFAULT_SPEND_THRESHOLD_USD,
  type Percent,
} from '../../../shared/constants';
import { notifyError, notifySuccess } from '../../../shared/lib/notify';
import { historyKeys } from '../../history/queries';
import * as rampApi from '../api';
import { CampaignListPanel } from '../components/CampaignListPanel';
import { ImportReportsPanel } from '../components/ImportReportsPanel';
import { PreviewApplyModal } from '../components/PreviewApplyModal';
import { effectivePercent } from '../lib/percent';
import type {
  CampaignInc,
  Gate1Report,
  Group,
  PreviewResult,
  StagedFile,
} from '../types';

export function RampPage() {
  const queryClient = useQueryClient();
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(DEFAULT_SPEND_THRESHOLD_USD);
  const [clickCap, setClickCap] = useState(DEFAULT_CLICK_CAP);
  const [defaultPercent, setDefaultPercent] =
    useState<Percent>(DEFAULT_PERCENT);
  const [allMatchingSelected, setAllMatchingSelected] = useState(false);
  const [groups, setGroups] = useState<Group[]>([
    'bidding',
    'placements',
    'audience',
    'b2b',
  ]);
  const [report, setReport] = useState<Gate1Report | null>(null);
  const [listPage, setListPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [incByCampaign, setIncByCampaign] = useState<
    Record<string, CampaignInc>
  >({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewPage, setPreviewPage] = useState(1);

  const rampCampaigns = useMemo(() => {
    const out: { id: string; percent: Percent }[] = [];
    for (const id of selected) {
      const pct = effectivePercent(incByCampaign[id], defaultPercent);
      if (pct === null) continue;
      out.push({ id, percent: pct });
    }
    return out;
  }, [selected, incByCampaign, defaultPercent]);

  const canImport = useMemo(() => {
    const kinds = new Set(staged.map((f) => f.kind));
    return PANDA_REQUIRED.every((k) => kinds.has(k));
  }, [staged]);

  async function generate() {
    if (!canImport) {
      setError('Upload all five required panda report CSVs before importing.');
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const data = await rampApi.generateReport({
        files: staged.map((f) => ({ filename: f.name, text: f.text })),
        spendThresholdUsd: threshold,
        clickCap,
        percent: defaultPercent,
      });
      setReport(data);
      setListPage(1);
      setSelected(data.campaigns.map((c) => c.id));
      setAllMatchingSelected(false);
      setIncByCampaign({});
      setMessage(
        `Imported ${data.imported.campaignCount} campaign(s) from ${data.imported.fileCount} file(s). ${data.total} under $${data.spendThresholdUsd} (page ${data.page}).`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generate failed');
    } finally {
      setBusy(false);
    }
  }

  async function changeListPage(page: number) {
    if (!report) return;
    setBusy(true);
    setError(null);
    try {
      const data = await rampApi.reportFromDb({
        spendThresholdUsd: threshold,
        clickCap,
        percent: defaultPercent,
        asOf: report.asOf,
        page,
      });
      setReport({ ...data, imported: report.imported });
      setListPage(data.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load page');
    } finally {
      setBusy(false);
    }
  }

  async function selectAllMatching() {
    if (!report) return;
    if (allMatchingSelected) {
      setSelected([]);
      setAllMatchingSelected(false);
      setMessage('Cleared campaign selection.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await rampApi.gate1Ids({
        spendThresholdUsd: threshold,
        asOf: report.asOf,
      });
      setSelected(data.ids);
      setAllMatchingSelected(true);
      setMessage(`Selected all ${data.ids.length} matching campaigns.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Select all failed');
    } finally {
      setBusy(false);
    }
  }

  async function fetchPreview(page: number) {
    if (!report || rampCampaigns.length === 0 || groups.length === 0) return;
    const data = await rampApi.preview({
      asOf: report.asOf,
      clickCap,
      groups,
      campaigns: rampCampaigns,
      page,
    });
    setPreview(data);
    setPreviewPage(data.page);
  }

  async function openPreview() {
    if (!report || rampCampaigns.length === 0 || groups.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await fetchPreview(1);
      setPreviewOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setBusy(false);
    }
  }

  async function changePreviewPage(page: number) {
    setBusy(true);
    setError(null);
    try {
      await fetchPreview(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview page failed');
    } finally {
      setBusy(false);
    }
  }

  async function confirmApply() {
    if (!report || rampCampaigns.length === 0 || !preview) return;
    setBusy(true);
    setError(null);
    try {
      const res = await rampApi.apply({
        asOf: report.asOf,
        clickCap,
        groups,
        campaigns: rampCampaigns,
      });
      setPreviewOpen(false);
      setPreview(null);
      const summary = `Applied ${res.applied} change(s) across ${res.campaignsProcessed} campaign(s). Local snapshot updated — Amazon was not called.`;
      setMessage(summary);
      const data = await rampApi.reportFromDb({
        spendThresholdUsd: threshold,
        clickCap,
        percent: defaultPercent,
        asOf: report.asOf,
        page: 1,
      });
      setReport({ ...data, imported: report.imported });
      setListPage(1);
      setSelected(data.campaigns.map((c) => c.id));
      setAllMatchingSelected(false);
      setIncByCampaign({});
      void queryClient.invalidateQueries({ queryKey: historyKeys.all });
      await notifySuccess('Changes applied', summary);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Apply failed';
      setError(msg);
      await notifyError('Apply failed', msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Ramp under-spending campaigns</h1>
      <p className="lede">
        Import a ramp report, select campaigns under yesterday’s spend threshold,
        set a default or per-row increase, then preview only the fields that will
        change before you confirm. Lists and previews are paginated for scale.
      </p>

      <ImportReportsPanel
        staged={staged}
        onStagedChange={setStaged}
        uploadNote={uploadNote}
        onUploadNote={setUploadNote}
        threshold={threshold}
        onThreshold={setThreshold}
        clickCap={clickCap}
        onClickCap={setClickCap}
        defaultPercent={defaultPercent}
        onDefaultPercent={setDefaultPercent}
        busy={busy}
        onImport={() => void generate()}
        onError={setError}
      />

      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="ok">{message}</p> : null}

      {report ? (
        <CampaignListPanel
          report={report}
          listPage={listPage}
          selected={selected}
          incByCampaign={incByCampaign}
          defaultPercent={defaultPercent}
          clickCap={clickCap}
          groups={groups}
          rampCount={rampCampaigns.length}
          allMatchingSelected={allMatchingSelected}
          busy={busy}
          onToggleGroup={(id) =>
            setGroups((prev) =>
              prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
            )
          }
          onSelectAllMatching={() => void selectAllMatching()}
          onTogglePageSelection={(checked) => {
            setAllMatchingSelected(false);
            const pageIds = report.campaigns.map((c) => c.id);
            if (checked) {
              setSelected((prev) => [...new Set([...prev, ...pageIds])]);
            } else {
              const drop = new Set(pageIds);
              setSelected((prev) => prev.filter((id) => !drop.has(id)));
            }
          }}
          onToggleCampaign={(id) => {
            setAllMatchingSelected(false);
            setSelected((prev) =>
              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
            );
          }}
          onIncChange={(id, value) =>
            setIncByCampaign((prev) => ({ ...prev, [id]: value }))
          }
          onListPage={(p) => void changeListPage(p)}
          onOpenPreview={() => void openPreview()}
        />
      ) : null}

      {previewOpen && preview ? (
        <PreviewApplyModal
          preview={preview}
          previewPage={previewPage}
          busy={busy}
          onClose={() => setPreviewOpen(false)}
          onPageChange={(p) => void changePreviewPage(p)}
          onConfirm={() => void confirmApply()}
        />
      ) : null}
    </>
  );
}
