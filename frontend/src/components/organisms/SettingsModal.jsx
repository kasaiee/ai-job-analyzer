import React, { useEffect, useState } from 'react';
import { Bot, Globe2, MoonStar, RefreshCw, X } from 'lucide-react';
import Button from '../atoms/Button';
import PopupBackdrop from '../molecules/PopupBackdrop';
import { useLanguage } from '../../templates/LanguageProvider';
import { AI_PROVIDERS, DEFAULT_PROVIDER, getProvider } from '../../utils/aiProviders';
import {
  readStoredSettings,
  SETTINGS_CHANGED_EVENT,
  SETTINGS_STORAGE_KEY,
} from '../../utils/settings';

const defaultSettings = {
  provider: DEFAULT_PROVIDER,
  model: '',
  apiToken: '',
  apiUrl: '',
  calendar: 'auto',
  dateTimeFormat: 'locale',
  timezone: 'Asia/Tehran',
  theme: 'system',
};

const loadSettings = (currentModel) => {
  return { ...defaultSettings, model: currentModel, ...readStoredSettings() };
};

const MODELS_FETCH_DEBOUNCE = 500;

const SettingsModal = ({ open, currentModel, onClose, onModelChange }) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('ai');
  const [settings, setSettings] = useState(() => loadSettings(currentModel));
  const [modelOptions, setModelOptions] = useState([]);
  const [modelsState, setModelsState] = useState('idle');
  const [manualModel, setManualModel] = useState(false);

  useEffect(() => {
    if (open) setSettings(loadSettings(currentModel));
  }, [open, currentModel]);

  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setModelsState('loading');
      try {
        const response = await fetch('/api/ai/models/', {
          headers: {
            'X-AI-API-Token': settings.apiToken || '',
            'X-AI-API-URL': settings.apiUrl || '',
            'X-AI-API-Provider': settings.provider || DEFAULT_PROVIDER,
          },
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'failed');
        setModelOptions(data.models || []);
        setModelsState('loaded');
      } catch (error) {
        if (controller.signal.aborted) return;
        setModelOptions([]);
        setModelsState('error');
      }
    }, MODELS_FETCH_DEBOUNCE);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, settings.provider, settings.apiUrl, settings.apiToken]);

  if (!open) return null;

  const updateSetting = (name, value) => setSettings((current) => ({ ...current, [name]: value }));
  const changeProvider = (id) =>
    setSettings((current) => ({
      ...current,
      provider: id,
      apiUrl: getProvider(id)?.baseUrl || '',
      model: '',
    }));
  const provider = getProvider(settings.provider) || getProvider(DEFAULT_PROVIDER);
  const showModelSelect = modelsState === 'loaded' && !manualModel && modelOptions.length > 0;
  const saveSettings = (event, requestClose) => {
    event.preventDefault();
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new Event(SETTINGS_CHANGED_EVENT));
    onModelChange(settings.model);
    requestClose();
  };

  return (
    <PopupBackdrop onClose={onClose}>
      {(requestClose) => (
        <section
          className="settings-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-title"
        >
          <header className="settings-header">
            <div>
              <h2 id="settings-title">{t('settings')}</h2>
              <p>{t('settingsDescription')}</p>
            </div>
            <Button type="button" onClick={requestClose} aria-label={t('closeSettings')}>
              <X size={18} />
            </Button>
          </header>
          <form className="settings-layout" onSubmit={(event) => saveSettings(event, requestClose)}>
            <nav className="settings-tabs" aria-label={t('settingsSections')}>
              <Button
                type="button"
                className={activeTab === 'ai' ? 'active' : ''}
                onClick={() => setActiveTab('ai')}
                aria-selected={activeTab === 'ai'}
              >
                <Bot size={17} /> {t('ai')}
              </Button>
              <Button
                type="button"
                className={activeTab === 'localization' ? 'active' : ''}
                onClick={() => setActiveTab('localization')}
                aria-selected={activeTab === 'localization'}
              >
                <Globe2 size={17} /> {t('localization')}
              </Button>
              <Button
                type="button"
                className={activeTab === 'appearance' ? 'active' : ''}
                onClick={() => setActiveTab('appearance')}
                aria-selected={activeTab === 'appearance'}
              >
                <MoonStar size={17} /> {t('appearance')}
              </Button>
            </nav>
            <div className="settings-content">
              {activeTab === 'ai' ? (
                <div className="settings-panel">
                  <h3>{t('ai')}</h3>
                  <label>
                    {t('aiProvider')}
                    <select
                      value={provider.id}
                      onChange={(event) => changeProvider(event.target.value)}
                    >
                      {AI_PROVIDERS.map((item) => (
                        <option value={item.id} key={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t('aiApiToken')}
                    <input
                      type="password"
                      value={settings.apiToken}
                      onChange={(event) => updateSetting('apiToken', event.target.value)}
                      placeholder={t('enterApiToken')}
                      autoComplete="off"
                      disabled={!provider.requiresKey}
                    />
                  </label>
                  {!provider.requiresKey && (
                    <p className="settings-hint">{t('tokenNotRequired')}</p>
                  )}
                  <label>
                    {t('aiApiUrl')}
                    <input
                      type="url"
                      value={settings.apiUrl}
                      onChange={(event) => updateSetting('apiUrl', event.target.value)}
                      placeholder={provider.baseUrl || 'https://api.example.com'}
                    />
                  </label>
                  <label>
                    {t('aiModel')}
                    {showModelSelect ? (
                      <span className="settings-model-row">
                        <select
                          value={settings.model}
                          onChange={(event) => updateSetting('model', event.target.value)}
                        >
                          <option value="">{t('chooseModel')}</option>
                          {modelOptions.map((item) => (
                            <option value={item.id} key={item.id}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          className="settings-model-action"
                          onClick={() => setManualModel(true)}
                          aria-label={t('useManualModel')}
                          title={t('useManualModel')}
                        >
                          {t('useManualModel')}
                        </Button>
                      </span>
                    ) : (
                      <input
                        type="text"
                        value={settings.model}
                        onChange={(event) => updateSetting('model', event.target.value)}
                        placeholder={t('enterModelManually')}
                      />
                    )}
                  </label>
                  {modelsState === 'error' && (
                    <p className="settings-hint">{t('modelsLoadFailed')}</p>
                  )}
                  {modelsState === 'loading' && (
                    <p className="settings-hint">{t('modelsLoading')}</p>
                  )}
                  {!showModelSelect &&
                    modelsState === 'loaded' &&
                    modelOptions.length > 0 &&
                    manualModel && (
                      <Button
                        type="button"
                        className="settings-model-action"
                        onClick={() => setManualModel(false)}
                      >
                        <RefreshCw size={14} /> {t('useModelList')}
                      </Button>
                    )}
                </div>
              ) : activeTab === 'localization' ? (
                <div className="settings-panel">
                  <h3>{t('localization')}</h3>
                  <label>
                    {t('calendar')}
                    <select
                      value={settings.calendar}
                      onChange={(event) => updateSetting('calendar', event.target.value)}
                    >
                      <option value="auto">{t('followLanguage')}</option>
                      <option value="gregorian">{t('gregorian')}</option>
                      <option value="jalali">{t('jalali')}</option>
                    </select>
                  </label>
                  <label>
                    {t('dateTimeFormat')}
                    <select
                      value={settings.dateTimeFormat}
                      onChange={(event) => updateSetting('dateTimeFormat', event.target.value)}
                    >
                      <option value="locale">{t('automatic')}</option>
                      <option value="yyyy-mm-dd">{t('formatYmd')}</option>
                      <option value="dd-mm-yyyy">{t('formatDmy')}</option>
                      <option value="mm-dd-yyyy">{t('formatMdy')}</option>
                    </select>
                  </label>
                  <label>
                    {t('timezone')}
                    <select
                      value={settings.timezone}
                      onChange={(event) => updateSetting('timezone', event.target.value)}
                    >
                      <option value="Asia/Tehran">{t('tehran')}</option>
                      <option value="UTC">{t('utc')}</option>
                      <option value="Europe/London">{t('london')}</option>
                      <option value="Europe/Berlin">{t('berlin')}</option>
                      <option value="America/New_York">{t('newYork')}</option>
                      <option value="America/Los_Angeles">{t('losAngeles')}</option>
                      <option value="Asia/Dubai">{t('dubai')}</option>
                      <option value="Asia/Tokyo">{t('tokyo')}</option>
                    </select>
                  </label>
                </div>
              ) : (
                <div className="settings-panel">
                  <h3>{t('appearance')}</h3>
                  <label>
                    {t('theme')}
                    <select
                      value={settings.theme}
                      onChange={(event) => updateSetting('theme', event.target.value)}
                    >
                      <option value="system">{t('systemTheme')}</option>
                      <option value="light">{t('lightTheme')}</option>
                      <option value="dark">{t('darkTheme')}</option>
                    </select>
                  </label>
                </div>
              )}
              <footer className="settings-actions">
                <Button type="button" onClick={requestClose}>
                  {t('cancel')}
                </Button>
                <Button type="submit" className="settings-save">
                  {t('saveChanges')}
                </Button>
              </footer>
            </div>
          </form>
        </section>
      )}
    </PopupBackdrop>
  );
};

export default SettingsModal;
