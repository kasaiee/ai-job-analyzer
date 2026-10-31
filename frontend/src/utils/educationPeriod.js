const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const FULL_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const monthAndYear = (year, month) => `${MONTH_NAMES[Number(month) - 1]} ${year}`;

/** Standardizes resume dates with three-letter English month names. */
export const formatResumeDate = value => String(value || '')
  .replace(/\b(\d{4})[-/](0?[1-9]|1[0-2])\b/g, (_, year, month) => monthAndYear(year, month))
  .replace(/\b(0?[1-9]|1[0-2])\/(\d{4})\b/g, (_, month, year) => monthAndYear(year, month))
  .replace(new RegExp(`\\b(${FULL_MONTH_NAMES.join('|')})\\b`, 'gi'), month => {
    const index = FULL_MONTH_NAMES.findIndex(name => name.toLowerCase() === month.toLowerCase());
    return MONTH_NAMES[index];
  });

export const formatEducationPeriod = formatResumeDate;
