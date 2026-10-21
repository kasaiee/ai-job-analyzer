import React, {useEffect, useState} from 'react';
import {Bot, Globe2, MoonStar, X} from 'lucide-react';
import Button from '../atoms/Button';
import {useLanguage} from '../../templates/LanguageProvider';
import {readStoredSettings, SETTINGS_CHANGED_EVENT, SETTINGS_STORAGE_KEY} from '../../utils/settings';

const defaultSettings = {
  model: '',
  apiToken: '',
  apiUrl: '',
  language: 'en',
  calendar: 'auto',
  dateTimeFormat: 'locale',
  timezone: 'Asia/Tehran',
  theme: 'system',
};

const loadSettings = currentModel => {
  return {...defaultSettings, model: currentModel, ...readStoredSettings()};
};

const SettingsModal = ({open, models, currentModel, onClose, onModelChange}) => {
  const {t} = useLanguage();
  const [activeTab, setActiveTab] = useState('ai');
  const [settings, setSettings] = useState(() => loadSettings(currentModel));

  useEffect(() => {
    if (open) setSettings(loadSettings(currentModel));
  }, [open, currentModel]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = event => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open, onClose]);

  if (!open) return null;

  const updateSetting = (name, value) => setSettings(current => ({...current, [name]: value}));
  const saveSettings = event => {
    event.preventDefault();
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new Event(SETTINGS_CHANGED_EVENT));
    onModelChange(settings.model);
    onClose();
  };

  return (
    <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="settings-header">
          <div><h2 id="settings-title">{t('settings')}</h2><p>{t('settingsDescription')}</p></div>
          <Button type="button" onClick={onClose} aria-label={t('closeSettings')}><X size={18}/></Button>
        </header>
        <form className="settings-layout" onSubmit={saveSettings}>
          <nav className="settings-tabs" aria-label={t('settingsSections')}>
            <Button type="button" className={activeTab === 'ai' ? 'active' : ''} onClick={() => setActiveTab('ai')} aria-selected={activeTab === 'ai'}><Bot size={17}/> {t('ai')}</Button>
            <Button type="button" className={activeTab === 'localization' ? 'active' : ''} onClick={() => setActiveTab('localization')} aria-selected={activeTab === 'localization'}><Globe2 size={17}/> {t('localization')}</Button>
            <Button type="button" className={activeTab === 'appearance' ? 'active' : ''} onClick={() => setActiveTab('appearance')} aria-selected={activeTab === 'appearance'}><MoonStar size={17}/> {t('appearance')}</Button>
          </nav>
          <div className="settings-content">
            {activeTab === 'ai' ? (
              <div className="settings-panel">
                <h3>{t('ai')}</h3>
                <label>{t('aiModel')}<select value={settings.model} onChange={event => updateSetting('model', event.target.value)}>{models.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                <label>{t('aiApiToken')}<input type="password" value={settings.apiToken} onChange={event => updateSetting('apiToken', event.target.value)} placeholder={t('enterApiToken')} autoComplete="off"/></label>
                <label>{t('aiApiUrl')}<input type="url" value={settings.apiUrl} onChange={event => updateSetting('apiUrl', event.target.value)} placeholder="https://api.example.com"/></label>
              </div>
            ) : activeTab === 'localization' ? (
              <div className="settings-panel">
                <h3>{t('localization')}</h3>
                <label>{t('language')}<select value={settings.language} onChange={event => updateSetting('language', event.target.value)}><option value="en">{t('english')}</option><option value="fa">{t('persian')}</option></select></label>
                <label>{t('calendar')}<select value={settings.calendar} onChange={event => updateSetting('calendar', event.target.value)}><option value="auto">{t('followLanguage')}</option><option value="gregorian">{t('gregorian')}</option><option value="jalali">{t('jalali')}</option></select></label>
                <label>{t('dateTimeFormat')}<select value={settings.dateTimeFormat} onChange={event => updateSetting('dateTimeFormat', event.target.value)}><option value="locale">{t('automatic')}</option><option value="yyyy-mm-dd">{t('formatYmd')}</option><option value="dd-mm-yyyy">{t('formatDmy')}</option><option value="mm-dd-yyyy">{t('formatMdy')}</option></select></label>
                <label>{t('timezone')}<select value={settings.timezone} onChange={event => updateSetting('timezone', event.target.value)}><option value="Asia/Tehran">{t('tehran')}</option><option value="UTC">{t('utc')}</option><option value="Europe/London">{t('london')}</option><option value="Europe/Berlin">{t('berlin')}</option><option value="America/New_York">{t('newYork')}</option><option value="America/Los_Angeles">{t('losAngeles')}</option><option value="Asia/Dubai">{t('dubai')}</option><option value="Asia/Tokyo">{t('tokyo')}</option></select></label>
              </div>
            ) : (
              <div className="settings-panel">
                <h3>{t('appearance')}</h3>
                <label>{t('theme')}<select value={settings.theme} onChange={event => updateSetting('theme', event.target.value)}><option value="system">{t('systemTheme')}</option><option value="light">{t('lightTheme')}</option><option value="dark">{t('darkTheme')}</option></select></label>
              </div>
            )}
            <footer className="settings-actions"><Button type="button" onClick={onClose}>{t('cancel')}</Button><Button type="submit" className="settings-save">{t('saveChanges')}</Button></footer>
          </div>
        </form>
      </section>
    </div>
  );
};

export default SettingsModal;
