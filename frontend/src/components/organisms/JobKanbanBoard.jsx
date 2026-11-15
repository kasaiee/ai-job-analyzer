import React, { useState } from 'react';
import { Brain, Edit3, ExternalLink } from 'lucide-react';
import Button from '../atoms/Button';
import CompanyLogo from '../atoms/CompanyLogo';
import JobMatchScore from '../atoms/JobMatchScore';
import { useLanguage } from '../../templates/LanguageProvider';
import { getJobMatchScore } from '../../utils/jobMatch';
import { getJobTitle } from '../../utils/jobTitle';
import { getJobStatus, getJobStatusClass, getJobStatusLabelKey, JOB_STATUSES } from '../../utils/jobStatus';

export { JOB_STATUSES };

const JobKanbanBoard = ({ applications, onMove, onEdit, onAnalysis }) => {
  const { t, formatDate } = useLanguage();
  const [draggedId, setDraggedId] = useState(null);
  const [target, setTarget] = useState(null);

  const columnJobs = (status) =>
    applications.filter(
      (application) => getJobStatus(application.status) === status && application.id !== draggedId,
    );

  const reset = () => {
    setDraggedId(null);
    setTarget(null);
  };

  const drop = (event) => {
    event.preventDefault();
    const application = applications.find((item) => item.id === draggedId);
    if (application && target) {
      onMove(application, target.status, target.beforeId);
    }
    reset();
  };

  const hoverCard = (event, status, application) => {
    if (!draggedId) return;
    event.preventDefault();
    event.stopPropagation();
    if (application.id === draggedId) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const jobs = columnJobs(status);
    const index = jobs.findIndex((item) => item.id === application.id);
    const beforeId =
      event.clientY < rect.top + rect.height / 2 ? application.id : jobs[index + 1]?.id ?? null;

    setTarget((current) =>
      current?.status === status && current.beforeId === beforeId ? current : { status, beforeId },
    );
  };

  const indicator = <div className="job-kanban-drop-indicator" aria-hidden="true" />;

  return (
    <div className="job-kanban" aria-label={t('kanbanView')}>
      {JOB_STATUSES.map((status) => {
        const jobs = applications.filter((application) => getJobStatus(application.status) === status);
        const isTarget = target?.status === status;

        return (
          <section
            className={`job-kanban-column ${getJobStatusClass(status)}${isTarget ? ' is-drop-target' : ''}`}
            key={status}
            onDragOver={(event) => {
              if (!draggedId) return;
              event.preventDefault();
              setTarget((current) =>
                current?.status === status && current.beforeId === null
                  ? current
                  : { status, beforeId: null },
              );
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setTarget((current) => (current?.status === status ? null : current));
              }
            }}
            onDrop={drop}
          >
            <header className="job-kanban-column-head">
              <span className="job-status-dot" />
              <h2>{t(getJobStatusLabelKey(status))}</h2>
              <span className="job-kanban-count">{jobs.length}</span>
            </header>
            <div className="job-kanban-cards">
              {jobs.map((application) => {
                const applicationStatus = getJobStatus(application.status);
                return (
                  <React.Fragment key={application.id}>
                    {isTarget && target.beforeId === application.id && indicator}
                    <article
                      className={`job-kanban-card${draggedId === application.id ? ' is-dragging' : ''}`}
                      draggable
                      onDragStart={(event) => {
                        setDraggedId(application.id);
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', application.id);
                      }}
                      onDragEnd={reset}
                      onDragOver={(event) => hoverCard(event, status, application)}
                      onClick={() => onAnalysis(application)}
                      onKeyDown={(event) => {
                        if (
                          event.target === event.currentTarget &&
                          (event.key === 'Enter' || event.key === ' ')
                        ) {
                          event.preventDefault();
                          onAnalysis(application);
                        }
                      }}
                      tabIndex="0"
                    >
                      <div className="job-kanban-company">
                        <CompanyLogo
                          name={application.company_name}
                          src={application.company_image_url}
                        />
                        <div>
                          <h3>{getJobTitle(application) || t('titleUnavailable')}</h3>
                          <p>{application.company_name}</p>
                        </div>
                      </div>
                      <JobMatchScore
                        score={getJobMatchScore(application.ai_analysis)}
                        label={t('jobMatch')}
                        unavailableLabel={t('notAnalyzed')}
                      />
                      <div className="job-kanban-meta">
                        <span>{formatDate(application.created_at)}</span>
                      </div>
                      <label className="job-status-select" onClick={(event) => event.stopPropagation()}>
                        <span>{t('status')}</span>
                        <select
                          value={applicationStatus}
                          onChange={(event) => onMove(application, event.target.value, null)}
                        >
                          {JOB_STATUSES.map((option) => (
                            <option key={option} value={option}>
                              {t(getJobStatusLabelKey(option))}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="job-kanban-actions" onClick={(event) => event.stopPropagation()}>
                        <Button
                          iconOnly
                          onClick={() => onEdit(application)}
                          title={t('editJob')}
                          aria-label={t('editCompanyJob', { name: application.company_name })}
                        >
                          <Edit3 size={15} />
                        </Button>
                        <Button
                          iconOnly
                          onClick={() => onAnalysis(application)}
                          title={t('viewAiResult')}
                          aria-label={t('viewAiResult')}
                        >
                          <Brain size={15} />
                        </Button>
                        {application.job_post_link && (
                          <a
                            href={application.job_post_link}
                            target="_blank"
                            rel="noreferrer"
                            title={t('viewJobPost')}
                            aria-label={t('viewJobPost')}
                          >
                            <ExternalLink size={15} />
                          </a>
                        )}
                      </div>
                    </article>
                  </React.Fragment>
                );
              })}
              {isTarget && target.beforeId === null && indicator}
              {!jobs.length && !isTarget && (
                <div className="job-kanban-empty">{t('noJobsInStatus')}</div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
};

export default JobKanbanBoard;
