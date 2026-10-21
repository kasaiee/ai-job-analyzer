const DEFAULT_TIMEZONE = 'Asia/Tehran';

const getCalendar = (calendar, language) => {
  if (calendar === 'jalali') return 'persian';
  if (calendar === 'gregorian') return 'gregory';
  return language === 'fa' ? 'persian' : 'gregory';
};

const getLocale = (language, calendar) => {
  const languageLocale = language === 'fa' ? 'fa-IR' : 'en-US';
  return `${languageLocale}-u-ca-${getCalendar(calendar, language)}`;
};

const getDateOptions = dateTimeFormat => {
  if (dateTimeFormat === 'locale') {
    return {year: 'numeric', month: 'short', day: 'numeric'};
  }
  return {year: 'numeric', month: '2-digit', day: '2-digit'};
};

const orderDateParts = (parts, dateTimeFormat) => {
  if (dateTimeFormat === 'locale') return null;

  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const separator = dateTimeFormat === 'yyyy-mm-dd' ? '-' : '/';
  const order = dateTimeFormat === 'yyyy-mm-dd'
    ? ['year', 'month', 'day']
    : dateTimeFormat === 'dd-mm-yyyy'
      ? ['day', 'month', 'year']
      : ['month', 'day', 'year'];

  return order.map(part => values[part]).join(separator);
};

export const formatDate = (value, preferences = {}) => {
  if (!value) return '';

  const {
    language = 'en',
    calendar = 'auto',
    dateTimeFormat = 'locale',
    timezone = DEFAULT_TIMEZONE,
  } = preferences;
  const formatter = new Intl.DateTimeFormat(
    getLocale(language, calendar),
    {...getDateOptions(dateTimeFormat), timeZone: timezone || DEFAULT_TIMEZONE},
  );
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return orderDateParts(formatter.formatToParts(date), dateTimeFormat) || formatter.format(date);
};

export const formatDateTime = (value, preferences = {}) => {
  if (!value) return '';
  const {
    language = 'en',
    calendar = 'auto',
    dateTimeFormat = 'locale',
    timezone = DEFAULT_TIMEZONE,
  } = preferences;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const options = {
    ...getDateOptions(dateTimeFormat),
    hour: '2-digit',
    minute: '2-digit',
    hour12: dateTimeFormat === 'mm-dd-yyyy',
    timeZone: timezone || DEFAULT_TIMEZONE,
  };
  return new Intl.DateTimeFormat(getLocale(language, calendar), options).format(date);
};

export const getDateTimePreferences = (settings = {}) => ({
  calendar: settings.calendar || 'auto',
  dateTimeFormat: settings.dateTimeFormat || 'locale',
  timezone: settings.timezone || DEFAULT_TIMEZONE,
});
