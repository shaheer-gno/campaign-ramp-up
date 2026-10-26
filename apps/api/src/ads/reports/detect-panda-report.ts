/**
 * Re-export shared panda detection so API and web stay in sync.
 * Source of truth: @ramp/panda-detect
 */
export {
  detectPandaReport,
  looksLikePandaPackage,
  PANDA_LABELS,
  PANDA_REQUIRED,
  type PandaDetectResult,
  type PandaReportKind,
} from '@ramp/panda-detect';
