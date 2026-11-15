import React from 'react';
import { Trash2 } from 'lucide-react';
import Button from '../atoms/Button';
import CompanyLogo from '../atoms/CompanyLogo';
import JobMatchScore from '../atoms/JobMatchScore';
import SortIcon from '../atoms/SortIcon';
import { useLanguage } from '../../templates/LanguageProvider';
import { getJobMatchScore } from '../../utils/jobMatch';
import { getJobTitle } from '../../utils/jobTitle';
import { getJobStatus, getJobStatusClass, getJobStatusLabelKey } from '../../utils/jobStatus';

const JobApplicationsTable = ({
  applications,
  sort,
  selectedIds,
  onSelectionChange,
  onSort,
  onEdit,
  onAnalysis,
  onDelete,
}) => {
  const { t, formatDate } = useLanguage();
  const allSelected =
    applications.length > 0 && applications.every((application) => selectedIds.includes(application.id));

  const toggleAll = (checked) => {
    onSelectionChange(checked ? applications.map((application) => application.id) : []);
  };

  const toggleApplication = (applicationId, checked) => {
    onSelectionChange((current) =>
      checked ? [...new Set([...current, applicationId])] : current.filter((id) => id !== applicationId),
    );
  };

  return (
    <div className="company-table-wrap">
      <table className="company-table job-table">
        <thead>
          <tr>
            <th className="selection-column">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(event) => toggleAll(event.target.checked)}
                aria-label={t('selectAllJobs')}
              />
            </th>
            <th>{t('jobTitle')}</th>
            <th>
              <Button
                type="button"
                className="table-sort-button"
                onClick={() => onSort('company')}
                aria-label={t('sortByCompany')}
                aria-pressed={sort.key === 'company'}
              >
                {t('company')}
                <SortIcon column="company" sort={sort} />
              </Button>
            </th>
            <th>{t('status')}</th>
            <th>
              <Button
                type="button"
                className="table-sort-button"
                onClick={() => onSort('match')}
                aria-label={t('sortByJobMatch')}
                aria-pressed={sort.key === 'match'}
              >
                {t('jobMatch')}
                <SortIcon column="match" sort={sort} />
              </Button>
            </th>
            <th>
              <Button
                type="button"
                className="table-sort-button"
                onClick={() => onSort('date')}
                aria-label={t('sortByAddedDate')}
                aria-pressed={sort.key === 'date'}
              >
                {t('added')}
                <SortIcon column="date" sort={sort} />
              </Button>
            </th>
            <th>{t('actions')}</th>
          </tr>
        </thead>
        <tbody>
          {applications.map((application) => {
            const status = getJobStatus(application.status);
            return (
              <tr
                key={application.id}
                className="clickable-row"
                onClick={() => onAnalysis(application)}
                tabIndex="0"
                onKeyDown={(event) => {
                  if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    onAnalysis(application);
                  }
                }}
              >
                <td className="selection-column" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(application.id)}
                    onChange={(event) => toggleApplication(application.id, event.target.checked)}
                    aria-label={t('selectCompanyJob', { name: application.company_name })}
                  />
                </td>
                <td className="job-title-cell">
                  {getJobTitle(application) || <span className="job-title-unavailable">{t('titleUnavailable')}</span>}
                </td>
                <td>
                  <span className="table-company">
                    <CompanyLogo name={application.company_name} src={application.company_image_url} />
                    <b>{application.company_name}</b>
                  </span>
                </td>
                <td>
                  <span className={`job-status-badge ${getJobStatusClass(status)}`}>
                    {t(getJobStatusLabelKey(status))}
                  </span>
                </td>
                <td>
                  <JobMatchScore
                    score={getJobMatchScore(application.ai_analysis)}
                    label={t('jobMatch')}
                    unavailableLabel={t('notAnalyzed')}
                  />
                </td>
                <td>{formatDate(application.created_at)}</td>
                <td>
                  <span className="job-row-actions">
                    <Button
                      variant="danger"
                      iconOnly
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(application.id);
                      }}
                      aria-label={t('deleteCompanyJob', { name: application.company_name })}
                      title={t('deleteJobApplication')}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default JobApplicationsTable;
