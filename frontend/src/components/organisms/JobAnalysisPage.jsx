import React from 'react';
import { ArrowLeft, Brain, Edit3, FileText, Trash2 } from 'lucide-react';
import Button from '../atoms/Button';
import ErrorMessage from '../atoms/ErrorMessage';
import ActionMenu from '../molecules/ActionMenu';
import PageHeader from './PageHeader';
import JobAnalysisDashboard from './JobAnalysisDashboard';
import { useLanguage } from '../../templates/LanguageProvider';

const JobAnalysisPage = ({ job, error, syncing, onBack, onSync, onResume, onCoverLetter, onEdit, onRemove }) => {
  const { t, formatDateTime } = useLanguage();

  if (!job) {
    return (
      <div className="analysis-page analysis-page-empty">
        <Button type="button" variant="secondary" onClick={onBack}>
          <ArrowLeft size={16} /> {t('back')}
        </Button>
        {error ? <ErrorMessage message={error} /> : <p>{t('loadingAnalysis')}</p>}
      </div>
    );
  }

  return (
    <div className="analysis-page">
      <PageHeader
        title={`${t('aiAnalysis')} — ${job.company_name}`}
        subtitle={job.ai_analyzed_at && t('lastAnalyzed', { date: formatDateTime(job.ai_analyzed_at) })}
        onBack={onBack}
        backLabel={t('back')}
      >
        <ActionMenu label={t('actions')} align="end">
          <Button type="button" variant="ghost" role="menuitem" onClick={() => onEdit(job)}>
            <Edit3 size={16} /> {t('edit')}
          </Button>
          <Button type="button" variant="ghost" role="menuitem" onClick={() => onResume(job)}>
            <FileText size={16} /> {t('createTailoredResume')}
          </Button>
          <Button type="button" variant="ghost" role="menuitem" onClick={() => onCoverLetter(job)}>
            <FileText size={16} /> {t('createCoverLetter')}
          </Button>
          <Button type="button" variant="ghost" role="menuitem" onClick={onSync} disabled={syncing}>
            <Brain size={16} /> {syncing ? t('syncingAnalysis') : t('syncAnalysis')}
          </Button>
          <Button type="button" variant="danger" role="menuitem" onClick={() => onRemove(job)}>
            <Trash2 size={16} /> {t('removeJob')}
          </Button>
        </ActionMenu>
      </PageHeader>
      <ErrorMessage message={error} />
      <div className="analysis-page-content">
        {job.ai_analysis ? <JobAnalysisDashboard analysis={job.ai_analysis} /> : <p>{t('noAiAnalysis')}</p>}
      </div>
    </div>
  );
};

export default JobAnalysisPage;
