const TIMEZONE_COORDINATES = {
  'America/Los_Angeles': {latitude: 34.05, longitude: -118.24},
  'America/Denver': {latitude: 39.74, longitude: -104.99},
  'America/Chicago': {latitude: 41.88, longitude: -87.63},
  'America/New_York': {latitude: 40.71, longitude: -74.01},
  'America/Toronto': {latitude: 43.65, longitude: -79.38},
  'America/Vancouver': {latitude: 49.28, longitude: -123.12},
  'Europe/London': {latitude: 51.51, longitude: -0.13},
  'Europe/Berlin': {latitude: 52.52, longitude: 13.41},
  'Europe/Paris': {latitude: 48.86, longitude: 2.35},
  'Europe/Amsterdam': {latitude: 52.37, longitude: 4.9},
  'Europe/Warsaw': {latitude: 52.23, longitude: 21.01},
  'Europe/Stockholm': {latitude: 59.33, longitude: 18.07},
  'Asia/Tehran': {latitude: 35.69, longitude: 51.39},
  'Asia/Dubai': {latitude: 25.2, longitude: 55.27},
  'Asia/Kolkata': {latitude: 19.08, longitude: 72.88},
  'Asia/Singapore': {latitude: 1.35, longitude: 103.82},
  'Asia/Tokyo': {latitude: 35.68, longitude: 139.69},
  'Australia/Sydney': {latitude: -33.87, longitude: 151.21},
};

const OFFICE_COORDINATES = {
  'philadelphia': {label: 'Philadelphia', latitude: 39.95, longitude: -75.17},
  'new york': {label: 'New York', latitude: 40.71, longitude: -74.01},
  'austin': {label: 'Austin', latitude: 30.27, longitude: -97.74},
  'sofia': {label: 'Sofia', latitude: 42.7, longitude: 23.32},
  'london': {label: 'London', latitude: 51.51, longitude: -0.13},
  'berlin': {label: 'Berlin', latitude: 52.52, longitude: 13.41},
  'paris': {label: 'Paris', latitude: 48.86, longitude: 2.35},
  'amsterdam': {label: 'Amsterdam', latitude: 52.37, longitude: 4.9},
  'warsaw': {label: 'Warsaw', latitude: 52.23, longitude: 21.01},
  'tehran': {label: 'Tehran', latitude: 35.69, longitude: 51.39},
  'dubai': {label: 'Dubai', latitude: 25.2, longitude: 55.27},
  'singapore': {label: 'Singapore', latitude: 1.35, longitude: 103.82},
  'tokyo': {label: 'Tokyo', latitude: 35.68, longitude: 139.69},
  'sydney': {label: 'Sydney', latitude: -33.87, longitude: 151.21},
};

const COUNTRY_COORDINATES = {
  'united arab emirates': {label: 'United Arab Emirates', latitude: 24.4, longitude: 54.3},
  'uae': {label: 'United Arab Emirates', latitude: 24.4, longitude: 54.3},
};

const finiteCoordinate = (value, minimum, maximum) => {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : null;
};

const officesFromLocationText = location => {
  const normalized = String(location || '').toLowerCase();
  return Object.entries(OFFICE_COORDINATES)
    .filter(([name]) => normalized.includes(name))
    .map(([, office]) => ({...office, isApproximate: true, locationBasis: 'mentioned-office'}));
};

const countryFromLocationText = location => {
  const normalized = String(location || '').toLowerCase();
  const match = Object.entries(COUNTRY_COORDINATES).find(([name]) => normalized.includes(name));
  return match ? {...match[1], isApproximate: true, locationBasis: 'country'} : null;
};

const timezoneLabel = timezone => String(timezone || '').split('/').pop().replaceAll('_', ' ');

/** Resolve explicit AI coordinates first, then legacy city names or analysis timezone. */
export const resolveWorkLocation = (meta = {}, schedule = {}) => {
  const latitude = finiteCoordinate(meta.work_location_latitude, -90, 90);
  const longitude = finiteCoordinate(meta.work_location_longitude, -180, 180);
  const fallback = TIMEZONE_COORDINATES[schedule.company_timezone];
  const explicitOffice = latitude !== null && longitude !== null
    ? [{label: String(meta.location || 'Work location'), latitude, longitude, isApproximate: false, locationBasis: 'explicit'}]
    : [];
  const namedOffices = officesFromLocationText(meta.location);
  const detectedCountry = countryFromLocationText(meta.location);
  const offices = explicitOffice.length
    ? explicitOffice
    : namedOffices.length
      ? namedOffices
      : detectedCountry
        ? [detectedCountry]
        : fallback
          ? [{label: `${timezoneLabel(schedule.company_timezone)} timezone`, ...fallback, isApproximate: true, locationBasis: 'timezone'}]
          : [];

  return {
    label: String(meta.location || 'Location unavailable'),
    offices,
  };
};

/** Project coordinates into the @svg-maps/world map viewport. */
export const projectCoordinates = ({latitude, longitude}) => ({
  x: ((longitude + 170) / 360) * 1010,
  y: 462 - (latitude * (1010 / 360)),
});

export const clampMapZoom = zoom => Math.min(4, Math.max(1, Number(zoom) || 1));

const getMapViewport = (offices, zoom, pan = {x: 0, y: 0}) => {
  const safeZoom = clampMapZoom(zoom);
  const width = 1010 / safeZoom;
  const height = 666 / safeZoom;
  const points = offices?.length ? offices.map(office => office.point) : [{x: 505, y: 333}];
  const centerX = points.reduce((total, point) => total + point.x, 0) / points.length;
  const centerY = points.reduce((total, point) => total + point.y, 0) / points.length;
  const x = Math.min(1010 - width, Math.max(0, centerX - width / 2 + (Number(pan.x) || 0)));
  const y = Math.min(666 - height, Math.max(0, centerY - height / 2 + (Number(pan.y) || 0)));
  return {x, y, width, height};
};

/** Center and constrain a zoomed viewport around the available office markers. */
export const getMapViewBox = (offices, zoom, pan = {x: 0, y: 0}) => {
  const {x, y, width, height} = getMapViewport(offices, zoom, pan);
  return `${x} ${y} ${width} ${height}`;
};

/** Smoothly zoom while keeping the map coordinate beneath the pointer stationary. */
export const zoomMapAtPoint = (offices, zoom, pan, pointer, deltaY) => {
  const current = getMapViewport(offices, zoom, pan);
  const nextZoom = clampMapZoom(zoom * Math.exp(-deltaY * .002));
  const nextWidth = 1010 / nextZoom;
  const nextHeight = 666 / nextZoom;
  const ratioX = Math.min(1, Math.max(0, Number(pointer.x) || 0));
  const ratioY = Math.min(1, Math.max(0, Number(pointer.y) || 0));
  const desiredX = current.x + ratioX * current.width - ratioX * nextWidth;
  const desiredY = current.y + ratioY * current.height - ratioY * nextHeight;
  const centered = getMapViewport(offices, nextZoom);

  return {
    zoom: nextZoom,
    pan: {x: desiredX - centered.x, y: desiredY - centered.y},
  };
};
