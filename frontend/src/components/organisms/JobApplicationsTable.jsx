import React from 'react';
import {ArrowDown, ArrowUp, ArrowUpDown, Brain, Edit3, Trash2} from 'lucide-react';
import Button from '../atoms/Button';
import CompanyLogo from '../atoms/CompanyLogo';
import JobMatchScore from '../atoms/JobMatchScore';
import {useLanguage} from '../../templates/LanguageProvider';
import {getJobMatchScore} from '../../utils/jobMatch';
import {getJobTitle} from '../../utils/jobTitle';

const JobApplicationsTable = ({applications, sort, selectedIds, onSelectionChange, onSort, onEdit, onAnalysis, onDelete}) => {
  const {t, formatDate} = useLanguage();
  const allSelected = applications.length > 0 && applications.every(application => selectedIds.includes(application.id));

  const toggleAll = checked => {
    onSelectionChange(checked ? applications.map(application => application.id) : []);
  };

  const toggleApplication = (applicationId, checked) => {
    onSelectionChange(current => checked
      ? [...new Set([...current, applicationId])]
      : current.filter(id => id !== applicationId));
  };

  const SortIcon = ({column}) => {
    if (sort.key !== column) return <ArrowUpDown size={13}/>;
    return sort.direction === 'asc' ? <ArrowUp size={13}/> : <ArrowDown size={13}/>;
  };

  return <div className="company-table-wrap">
      <table className="company-table job-table">
        <thead><tr>
          <th className="selection-column"><input type="checkbox" checked={allSelected} onChange={event => toggleAll(event.target.checked)} aria-label={t('selectAllJobs')}/></th>
          <th>{t('jobTitle')}</th>
          <th><Button type="button" className="table-sort-button" onClick={() => onSort('company')} aria-label={t('sortByCompany')} aria-pressed={sort.key === 'company'}>{t('company')}<SortIcon column="company"/></Button></th>
          <th>{t('jobPost')}</th>
          <th><Button type="button" className="table-sort-button" onClick={() => onSort('match')} aria-label={t('sortByJobMatch')} aria-pressed={sort.key === 'match'}>{t('jobMatch')}<SortIcon column="match"/></Button></th>
          <th><Button type="button" className="table-sort-button" onClick={() => onSort('date')} aria-label={t('sortByAddedDate')} aria-pressed={sort.key === 'date'}>{t('added')}<SortIcon column="date"/></Button></th>
          <th>{t('aiAnalysis')}</th>
          <th>{t('actions')}</th>
        </tr></thead>
        <tbody>{applications.map(application => <tr key={application.id} onClick={() => onEdit(application)} tabIndex="0" onKeyDown={event => {if (event.key === 'Enter' || event.key === ' ') {event.preventDefault(); onEdit(application);}}}>
          <td className="selection-column" onClick={event => event.stopPropagation()}>
            <input type="checkbox" checked={selectedIds.includes(application.id)} onChange={event => toggleApplication(application.id, event.target.checked)} aria-label={t('selectCompanyJob', {name: application.company_name})}/>
          </td>
          <td className="job-title-cell">{getJobTitle(application) || <span className="job-title-unavailable">{t('titleUnavailable')}</span>}</td>
          <td><span className="table-company"><CompanyLogo name={application.company_name} src={application.company_image_url}/><b>{application.company_name}</b></span></td>
          <td>{application.job_post_link ? <a href={application.job_post_link} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()}>{t('viewJobPost')}</a> : '—'}</td>
          <td><JobMatchScore score={getJobMatchScore(application.ai_analysis)} label={t('jobMatch')} unavailableLabel={t('notAnalyzed')}/></td>
          <td>{formatDate(application.created_at)}</td>
          <td><Button type="button" className="job-table-link" onClick={event => {event.stopPropagation(); onAnalysis(application);}}><Brain size={15}/> {t('viewAiResult')}</Button></td>
          <td><span className="job-row-actions">
            <Button iconOnly type="button" onClick={event => {event.stopPropagation(); onEdit(application);}} aria-label={t('editCompanyJob', {name: application.company_name})} title={t('editJob')}><Edit3 size={16}/></Button>
            <Button variant="danger" iconOnly type="button" onClick={event => {event.stopPropagation(); onDelete(application.id);}} aria-label={t('deleteCompanyJob', {name: application.company_name})} title={t('deleteJobApplication')}><Trash2 size={16}/></Button>
          </span></td>
        </tr>)}</tbody>
      </table>
    </div>;
};

export default JobApplicationsTable;
