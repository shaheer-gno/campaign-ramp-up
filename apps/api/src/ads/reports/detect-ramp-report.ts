import { hasCols, headerIndex } from './tsv';

export type RampReportKind =
  | 'campaigns'
  | 'spend'
  | 'targets'
  | 'clicks'
  | 'placements'
  | 'audiences';

/** Detect report type from header columns (filenames are ignored). */
export function detectRampReportKind(text: string): RampReportKind | null {
  const parsed = headerIndex(text);
  if (!parsed) return null;
  const { index } = parsed;

  if (
    hasCols(index, 'campaign-id', 'campaign-name', 'ad-group-id', 'ad-group-name')
  ) {
    return 'campaigns';
  }
  if (hasCols(index, 'campaign-id', 'date', 'spend-usd')) {
    return 'spend';
  }
  if (
    hasCols(
      index,
      'target-id',
      'campaign-id',
      'ad-group-id',
      'target-kind',
      'bid',
    )
  ) {
    return 'targets';
  }
  if (hasCols(index, 'target-id', 'date', 'clicks')) {
    return 'clicks';
  }
  if (hasCols(index, 'campaign-id', 'placement', 'percent')) {
    return 'placements';
  }
  if (
    hasCols(
      index,
      'audience-id',
      'campaign-id',
      'audience-name',
      'audience-kind',
      'percent',
    )
  ) {
    return 'audiences';
  }
  return null;
}
