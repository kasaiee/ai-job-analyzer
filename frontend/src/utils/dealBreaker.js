/** Read AI-generated deal-breaker fields without deriving a title from the detail. */
export const getDealBreaker = item => {
  if (item && typeof item === 'object') {
    return {
      title: String(item.title || '').trim() || 'Sync analysis',
      detail: String(item.detail || item.description || '').trim(),
      employmentImpossible: item.employment_impossible === true,
    };
  }

  return {title: 'Sync analysis', detail: String(item || '').trim(), employmentImpossible: false};
};
