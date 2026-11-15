import { DEFAULT_PROVIDER } from './aiProviders';

export const SETTINGS_STORAGE_KEY = 'ai-settings';
export const SETTINGS_CHANGED_EVENT = 'ai-settings-changed';

export const readStoredSettings = () => {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
};

export const getAIRequestHeaders = () => {
  const { apiToken = '', apiUrl = '', provider = DEFAULT_PROVIDER } = readStoredSettings();
  return {
    'X-AI-API-Token': apiToken,
    'X-AI-API-URL': apiUrl,
    'X-AI-API-Provider': provider,
  };
};
