import React, {useEffect, useState} from 'react';
import {X} from 'lucide-react';
import Button from '../atoms/Button';
import {useLanguage} from '../../templates/LanguageProvider';

const ResumeProfileModal = ({open, profile, saving, onClose, onSave}) => {
  const {t} = useLanguage();
  const [name, setName] = useState('');
  const [resumeText, setResumeText] = useState('');

  useEffect(() => {
    if (open) {
      setName(profile?.name || t('defaultResume'));
      setResumeText(profile?.resume_text || '');
    }
  }, [open, profile, t]);

  if (!open) return null;
  return <div className="modal-backdrop" onMouseDown={event => {if (event.target === event.currentTarget) onClose();}}>
    <div className="modal resume-profile-modal" role="dialog" aria-modal="true" aria-labelledby="resume-profile-title">
      <div className="modal-head"><div><h2 id="resume-profile-title">{t('resumeProfile')}</h2><small>{t('resumeProfileDescription')}</small></div><Button type="button" onClick={onClose} aria-label={t('close')}><X size={18}/></Button></div>
      <form className="job-form" onSubmit={event => {event.preventDefault(); onSave({name, resume_text: resumeText});}}>
        <label>{t('resumeName')}<input value={name} onChange={event => setName(event.target.value)} required/></label>
        <label>{t('resumeText')}<textarea className="resume-textarea" rows="18" value={resumeText} onChange={event => setResumeText(event.target.value)} placeholder={t('resumeTextPlaceholder')} required/></label>
        <p className="form-help">{t('resumeEvidenceHelp')}</p>
        <div className="modal-actions"><Button type="button" onClick={onClose}>{t('cancel')}</Button><Button type="submit" disabled={saving}>{saving?t('saving'):t('save')}</Button></div>
      </form>
    </div>
  </div>;
};

export default ResumeProfileModal;
