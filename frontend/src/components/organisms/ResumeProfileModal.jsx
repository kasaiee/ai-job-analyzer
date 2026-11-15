import React, { useEffect, useState } from 'react';
import Button from '../atoms/Button';
import Modal from '../molecules/Modal';
import { useLanguage } from '../../templates/LanguageProvider';

const ResumeProfileModal = ({ open, profile, saving, onClose, onSave }) => {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [resumeText, setResumeText] = useState('');

  useEffect(() => {
    if (open) {
      setName(profile?.name || t('defaultResume'));
      setResumeText(profile?.resume_text || '');
    }
  }, [open, profile, t]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('resumeProfile')}
      titleId="resume-profile-title"
      closeLabel={t('close')}
      className="resume-profile-modal"
    >
      {(requestClose) => (
        <form
          className="job-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (await onSave({ name, resume_text: resumeText })) requestClose();
          }}
        >
          <p className="form-help">{t('resumeProfileDescription')}</p>
          <label>
            {t('resumeName')}
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label>
            {t('resumeText')}
            <textarea
              className="resume-textarea"
              rows="18"
              value={resumeText}
              onChange={(event) => setResumeText(event.target.value)}
              placeholder={t('resumeTextPlaceholder')}
              required
            />
          </label>
          <p className="form-help">{t('resumeEvidenceHelp')}</p>
          <div className="modal-actions">
            <Button type="button" onClick={requestClose}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? t('saving') : t('save')}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default ResumeProfileModal;
