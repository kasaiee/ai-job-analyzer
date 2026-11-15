import React from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import Button from '../atoms/Button';
import ErrorMessage from '../atoms/ErrorMessage';
import CompanyAutocomplete from '../molecules/CompanyAutocomplete';
import ImageUpload from '../molecules/ImageUpload';
import { useLanguage } from '../../templates/LanguageProvider';
import { getJobStatus, getJobStatusLabelKey, JOB_STATUSES } from '../../utils/jobStatus';

const JobEditPage = ({
  job,
  error,
  saving,
  companyName,
  companyDescription,
  companyImage,
  companyId,
  onCompanyName,
  onCompanySelect,
  onDescription,
  onBack,
  onSubmit,
}) => {
  const { t } = useLanguage();

  if (!job) {
    return (
      <div className="job-edit-page">
        <Button type="button" variant="secondary" className="header-back-button" onClick={onBack}>
          <ArrowLeft className="directional-icon" size={16} /> {t('back')}
        </Button>
        <ErrorMessage message={error} />
      </div>
    );
  }

  return (
    <div className="job-edit-page">
      <div className="job-edit-page-head">
        <Button type="button" variant="secondary" className="header-back-button" onClick={onBack}>
          <ArrowLeft className="directional-icon" size={16} /> {t('back')}
        </Button>
        <div>
          <h2>{t('editJob')}</h2>
          <p>
            {job.company_name} · {job.job_title}
          </p>
        </div>
      </div>
      <form onSubmit={onSubmit} className="job-form job-edit-form">
        <ErrorMessage message={error} />
        <label>
          {t('jobTitle')}
          <input name="job_title" type="text" required maxLength="300" defaultValue={job.job_title || ''} />
        </label>
        <label>
          {t('status')}
          <select name="status" defaultValue={getJobStatus(job.status)}>
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
            rows="5"
            value={companyDescription}
            onChange={(event) => onDescription(event.target.value)}
          />
        </label>
        <label>
          {t('jobPostLink')}
          <input name="job_post_link" type="url" placeholder="https://..." defaultValue={job.job_post_link || ''} />
        </label>
        <label>
          {t('jobDescription')}
          <textarea name="job_description" rows="8" defaultValue={job.job_description || ''} />
        </label>
        <div className="job-edit-actions">
          <Button type="button" variant="secondary" onClick={onBack}>
            {t('cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            <Save size={16} /> {saving ? t('saving') : t('save')}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default JobEditPage;
