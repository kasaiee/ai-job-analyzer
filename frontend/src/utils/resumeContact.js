/** Shorten contact URLs for display without changing their link targets. */
export const formatContactLink = value => String(value || '')
  .trim()
  .replace(/^(?:https?:\/\/)?www\./i, '')
  .replace(/^https?:\/\//i, '');

/** Preserve blank rows while the user edits a one-link-per-line textarea. */
export const parseContactLinks = value => String(value ?? '').split('\n');

/** Remove unfinished blank rows before persisting resume data. */
export const compactContactLinks = links => (links || [])
  .map(link => String(link).trim())
  .filter(Boolean);
