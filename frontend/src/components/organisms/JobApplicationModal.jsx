import React from 'react';
import Button from '../atoms/Button';
import ErrorMessage from '../atoms/ErrorMessage';
import CompanyAutocomplete from '../molecules/CompanyAutocomplete';
import ImageUpload from '../molecules/ImageUpload';
import Modal from '../molecules/Modal';
import { useLanguage } from '../../templates/LanguageProvider';
import { DEFAULT_JOB_STATUS, getJobStatusLabelKey, JOB_STATUSES } from '../../utils/jobStatus';

const JobApplicationModal = ({
  open,
  error,
  saving,
  companyName,
  companyDescription,
  companyImage,
  companyId,
  onCompanyName,
  onCompanySelect,
  onDescription,
  onClose,
  onSubmit,
}) => {
  const { t } = useLanguage();

  return (
    <Modal open={open} onClose={onClose} title={t('addJob')} titleId="job-modal-title" closeLabel={t('close')}>
      {(requestClose) => (
        <form onSubmit={(event) => onSubmit(event, requestClose)} className="job-form">
          <ErrorMessage message={error} />
          <label>
            {t('jobTitle')}
            <input name="job_title" type="text" required maxLength="300" autoFocus />
          </label>
          <label>
            {t('status')}
            <select name="status" defaultValue={DEFAULT_JOB_STATUS}>
              {JOB_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(getJobStatusLabelKey(status))}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('companyName')}
            <CompanyAutocomplete
              value={companyName}
              selectedId={companyId}
              onChange={onCompanyName}
              onSelect={onCompanySelect}
            />
          </label>
          <ImageUpload name="company_image" label={t('companyImage')} initialPreview={companyImage} />
          <label>
            {t('companyDescription')}
            <textarea
              name="company_description"
              rows="4"
              value={companyDescription}
              onChange={(event) => onDescription(event.target.value)}
            />
          </label>
          <label>
            {t('jobPostLink')}
            <input name="job_post_link" type="url" placeholder="https://..." />
          </label>
          <label>
            {t('jobDescription')}
            <textarea name="job_description" rows="6" />
          </label>
          <div className="modal-actions">
            <Button type="button" onClick={requestClose}>
              {t('cancel')}
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? t('saving') : t('save')}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default JobApplicationModal;
