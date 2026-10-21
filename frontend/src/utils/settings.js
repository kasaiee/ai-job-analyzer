export const SETTINGS_STORAGE_KEY = 'mirza-settings';
export const SETTINGS_CHANGED_EVENT = 'mirza-settings-changed';

export const readStoredSettings = () => {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
};

export const getAIRequestHeaders = () => {
  const {apiToken = '', apiUrl = ''} = readStoredSettings();
  return {'X-AI-API-Token': apiToken, 'X-AI-API-URL': apiUrl};
};
