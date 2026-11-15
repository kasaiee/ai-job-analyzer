/** Returns the metadata displayed in the job analysis hero. */
export const getAnalysisMetaItems = meta => [
  {label: 'Confidence', value: `${Math.round(meta.analysis_confidence * 100)}%`},
];
