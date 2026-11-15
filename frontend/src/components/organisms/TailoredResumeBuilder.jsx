import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Check, Download, Save, Sparkles, Trash2, X } from 'lucide-react';
import Button from '../atoms/Button';
import ResumePreview from '../molecules/ResumePreview';
import PopupBackdrop from '../molecules/PopupBackdrop';
import { compactContactLinks } from '../../utils/resumeContact';
import { getAIRequestHeaders } from '../../utils/settings';

const updateListItem = (data, section, index, field, value) => ({
  ...data,
  [section]: data[section].map((item, itemIndex) =>
    itemIndex === index ? { ...item, [field]: value } : item,
  ),
});
const placeholderCount = (data) => (JSON.stringify(data).match(/\[ADD [^\]]+\]/g) || []).length;
const auditLabels = {
  job_title_match: 'Target job title',
  degree_match: 'Degree requirement',
  word_count: 'Resume length',
  accomplishments: 'Quantified accomplishments',
  buzz_words: 'Buzzwords',
  verb_choice: 'Action verbs',
  first_person: 'First-person language',
  date_formatting: 'Date consistency',
  general_formatting: 'General formatting',
};
const passingAuditStatuses = new Set(['MATCH', 'NO_REQUIREMENT', 'OPTIMAL', 'GOOD', 'CLEAN']);
const normalizeReason = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const isMetadataWarning = (value) =>
  /template[_ ]?id|source[_ ]memory[_ ]ids|generation[_ ]notes|quality[_ ]assessment|resume[_ ]audit|internal metadata/i.test(
    String(value || ''),
  );

const trackerKey = (jobId) => `resume-issue-tracker:${jobId}`;
const readTracker = (jobId) => {
  try {
    const stored = JSON.parse(localStorage.getItem(trackerKey(jobId)));
    return Array.isArray(stored) ? stored : null;
  } catch {
    return null;
  }
};
const writeTracker = (jobId, issues) => {
  try {
    localStorage.setItem(trackerKey(jobId), JSON.stringify(issues));
  } catch {}
};
const similarIssue = (a, b) => {
  const x = normalizeReason(a),
    y = normalizeReason(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const s = new Set(x.split(' ').filter((word) => word.length > 2)),
    t = new Set(y.split(' ').filter((word) => word.length > 2));
  if (!s.size || !t.size) return false;
  const shared = [...s].filter((word) => t.has(word)).length;
  return shared / (s.size + t.size - shared) >= 0.5;
};
const reconcileIssues = (tracked, current, version, resumeId) => {
  const next = tracked.map((issue) => ({ ...issue }));
  const seen = new Set();
  current.forEach((item) => {
    const match = next.find((issue) => similarIssue(issue.title, item.title));
    if (match) {
      seen.add(match.id);
      match.detail = item.detail || match.detail;
      match.audit_key = item.audit_key;
      if (
        match.status === 'fixed' &&
        !(match.verifiedResumeId && match.verifiedResumeId === resumeId)
      ) {
        match.status = 'open';
        delete match.fixedIn;
        delete match.verifiedResumeId;
      }
    } else {
      const id = `issue_${next.length}_${version}`;
      next.push({
        id,
        title: item.title,
        detail: item.detail,
        audit_key: item.audit_key,
        status: 'open',
        firstSeen: version,
      });
      seen.add(id);
    }
  });
  next.forEach((issue) => {
    if (issue.status === 'open' && !seen.has(issue.id)) {
      issue.status = 'fixed';
      issue.fixedIn = version;
    }
  });
  return next;
};

const ResumeAudit = ({ audit, onCheck, checkingKey, results }) => {
  if (!audit) return null;
  const items = Object.entries(auditLabels)
    .map(([key, label]) => ({ key, label, item: audit[key] }))
    .filter(({ item }) => item);
  if (audit.contact_info)
    items.push({
      key: 'contact_info',
      label: 'Contact information',
      item: {
        status: audit.contact_info.has_email && audit.contact_info.has_phone ? 'CLEAN' : 'FLAGGED',
        feedback: audit.contact_info.feedback,
        suggestions: [
          `Email: ${audit.contact_info.has_email ? 'present' : 'missing'} · Phone: ${audit.contact_info.has_phone ? 'present' : 'missing'}`,
        ],
      },
    });
  return (
    <div className="tailored-resume-audit">
      <h3>ATS resume audit</h3>
      <div className="tailored-resume-audit-grid">
        {items.map(({ key, label, item }) => {
          const result = results[key] || item;
          const passed = passingAuditStatuses.has(result.status);
          return (
            <article className={`tailored-resume-audit-item ${passed ? 'pass' : 'flag'}`} key={key}>
              <span className="tailored-resume-audit-icon">{passed ? '✓' : '!'}</span>
              <div>
                <div>
                  <h4>{label}</h4>
                  <b>{result.status?.replaceAll('_', ' ')}</b>
                  <Button
                    className="resume-button"
                    variant="secondary"
                    onClick={() => onCheck(key)}
                    disabled={checkingKey === key}
                  >
                    {checkingKey === key ? (
                      'Checking…'
                    ) : (
                      <>
                        <Check size={14} />
                        Check with AI
                      </>
                    )}
                  </Button>
                </div>
                {result.feedback && <p>{result.feedback}</p>}
                {result.suggestions?.length > 0 && (
                  <ul>
                    {result.suggestions.map((suggestion, index) => (
                      <li key={index}>{suggestion}</li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};

const TailoredResumeBuilder = ({
  job,
  versions,
  activeResume,
  analysis,
  loading,
  saving,
  onClose,
  onGenerate,
  onSelect,
  onSave,
  onDelete,
  onDownload,
  onReassessQuality,
  page = false,
  fullscreen = false,
}) => {
  const [draft, setDraft] = useState(null);
  const [tab, setTab] = useState('edit');
  const [generationInstructions, setGenerationInstructions] = useState('');
  const [checkingKey, setCheckingKey] = useState(null);
  const [auditResults, setAuditResults] = useState({});
  const [auditError, setAuditError] = useState('');
  const [reassessing, setReassessing] = useState(false);
  const [previousQualityNotes, setPreviousQualityNotes] = useState([]);
  const [trackedIssues, setTrackedIssues] = useState([]);
  const [issueTab, setIssueTab] = useState('open');
  useEffect(() => {
    setTrackedIssues(job?.id ? readTracker(job.id) || [] : []);
  }, [job?.id]);
  useEffect(() => {
    if (activeResume) {
      setDraft(structuredClone(activeResume));
      if (activeResume.previous_quality_notes)
        setPreviousQualityNotes(activeResume.previous_quality_notes);
    } else setDraft(null);
  }, [activeResume?.id]);
  useEffect(() => setGenerationInstructions(''), [job?.id]);
  useEffect(() => {
    setAuditResults({});
    setAuditError('');
    setCheckingKey(null);
  }, [job?.id, activeResume?.id]);
  const data = draft?.resume_data;
  const placeholders = useMemo(() => (data ? placeholderCount(data) : 0), [data]);
  const resumeAudit = data?.resume_audit || analysis?.resume_audit;
  const scoredAudit = resumeAudit
    ? {
        ...resumeAudit,
        ...auditResults,
        ...(auditResults.contact_info
          ? {
              contact_info: {
                has_email: auditResults.contact_info.status === 'CLEAN',
                has_phone: auditResults.contact_info.status === 'CLEAN',
              },
            }
          : {}),
      }
    : null;
  const resumeQuality = Number.isInteger(data?.quality_assessment?.score)
    ? data.quality_assessment.score
    : null;
  const resumeQualityMissing = (data?.quality_assessment?.missing_information || []).filter(
    (item) => !isMetadataWarning(`${item.title} ${item.detail}`),
  );
  const previousNotes = previousQualityNotes.length
    ? previousQualityNotes
    : versions
        .filter((version) => version.id !== draft?.id)
        .sort((a, b) => b.version_number - a.version_number)[0]?.resume_data?.quality_assessment
        ?.missing_information || [];
  const resolvedNotes = previousNotes.map((note) => {
    const stillUnresolved = resumeQualityMissing.some(
      (current) =>
        normalizeReason(current.title) === normalizeReason(note.title) ||
        normalizeReason(note.detail).includes(normalizeReason(current.title)),
    );
    return { ...note, resolved: !stillUnresolved };
  });
  const auditWeaknesses = Object.entries({
    ...auditLabels,
    contact_info: 'Contact information',
  }).flatMap(([key, label]) => {
    const item = scoredAudit?.[key];
    const status =
      key === 'contact_info'
        ? item?.status || (item?.has_email && item?.has_phone ? 'CLEAN' : 'FLAGGED')
        : item?.status;
    const detail = item?.feedback || item?.suggestions?.join(' ');
    return status &&
      !passingAuditStatuses.has(status) &&
      status !== 'NOT_ASSESSABLE' &&
      !isMetadataWarning(`${detail} ${(item?.suggestions || []).join(' ')}`)
      ? [{ key, title: label, detail }]
      : [];
  });
  if (
    scoredAudit?.contact_info &&
    !(scoredAudit.contact_info.has_email && scoredAudit.contact_info.has_phone)
  )
    auditWeaknesses.push({
      key: 'contact_info',
      title: 'Contact information',
      detail: scoredAudit.contact_info.feedback || 'Add any missing email or phone details.',
    });
  const updateContact = (field, value) =>
    setDraft((current) => ({
      ...current,
      resume_data: {
        ...current.resume_data,
        contact: { ...current.resume_data.contact, [field]: value },
      },
    }));
  const updateData = (field, value) =>
    setDraft((current) => ({
      ...current,
      resume_data: { ...current.resume_data, [field]: value },
    }));
  const updateItem = (section, index, field, value) =>
    setDraft((current) => ({
      ...current,
      resume_data: updateListItem(current.resume_data, section, index, field, value),
    }));
  const updateBullet = (section, itemIndex, bulletIndex, value) =>
    setDraft((current) => ({
      ...current,
      resume_data: updateListItem(
        current.resume_data,
        section,
        itemIndex,
        'bullets',
        current.resume_data[section][itemIndex].bullets.map((bullet, index) =>
          index === bulletIndex ? { ...bullet, text: value } : bullet,
        ),
      ),
    }));
  const getSaveableDraft = () => ({
    ...draft,
    resume_data: {
      ...data,
      contact: { ...data.contact, links: compactContactLinks(data.contact.links) },
    },
  });
  const save = () => onSave(getSaveableDraft());
  const reassessQuality = async () => {
    if (!draft || reassessing) return;
    setReassessing(true);
    setAuditError('');
    try {
      const updated = await onReassessQuality(getSaveableDraft());
      setDraft(structuredClone(updated));
      setAuditResults({});
    } catch (error) {
      setAuditError(error.message);
    } finally {
      setReassessing(false);
    }
  };
  const generateNewVersion = async () => {
    if (!draft) return onGenerate(generationInstructions);
    setPreviousQualityNotes(data?.quality_assessment?.missing_information || []);
    await onGenerate(generationInstructions);
  };
  const checkAudit = async (key) => {
    if (!draft?.id || checkingKey) return;
    setCheckingKey(key);
    setAuditError('');
    try {
      const response = await fetch(
        `/api/job-applications/${job.id}/resumes/${draft.id}/audit-check/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAIRequestHeaders() },
          body: JSON.stringify({
            key,
            resume_data: {
              ...data,
              contact: { ...data.contact, links: compactContactLinks(data.contact.links) },
            },
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'ATS check failed.');
      setAuditResults((current) => ({ ...current, [key]: result.result }));
    } catch (error) {
      setAuditError(error.message);
    } finally {
      setCheckingKey(null);
    }
  };
  const checkRecommendation = async (recommendation, index) => {
    const key = recommendation.key || `recommendation_${index}`;
    if (checkingKey) return;
    setCheckingKey(key);
    setAuditError('');
    try {
      const response = await fetch(
        `/api/job-applications/${job.id}/resumes/${draft.id}/audit-check/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAIRequestHeaders() },
          body: JSON.stringify({
            key: recommendation.audit_key || 'general_formatting',
            resume_data: {
              ...data,
              contact: { ...data.contact, links: compactContactLinks(data.contact.links) },
            },
            recommendation: recommendation.detail || recommendation.title,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Recommendation check failed.');
      setAuditResults((current) => ({ ...current, [key]: result.result }));
      if (passingAuditStatuses.has(result.result?.status)) markIssueFixed(recommendation.id);
    } catch (error) {
      setAuditError(error.message);
    } finally {
      setCheckingKey(null);
    }
  };
  const currentIssues = [
    ...resumeQualityMissing.map((item) => ({
      title: item.title,
      detail: item.detail,
      audit_key: 'general_formatting',
    })),
    ...auditWeaknesses.map((item) => ({
      title: item.title,
      detail: item.detail,
      audit_key: item.key,
    })),
  ].filter((item) => normalizeReason(item.title));
  const currentIssuesSignature = JSON.stringify(currentIssues.map((item) => item.title));
  const latestVersionNumber = Math.max(
    0,
    ...versions.map((version) => version.version_number || 0),
  );
  const isLatestVersion =
    !!draft && draft.id === activeResume?.id && (draft.version_number || 0) >= latestVersionNumber;
  useEffect(() => {
    if (!job?.id || !isLatestVersion || !data) return;
    let issues = readTracker(job.id);
    if (!issues) {
      issues = [];
      [...versions]
        .filter((version) => version.id !== draft.id)
        .sort((a, b) => a.version_number - b.version_number)
        .forEach((version) => {
          const missing = (version.resume_data?.quality_assessment?.missing_information || [])
            .filter((item) => !isMetadataWarning(`${item.title} ${item.detail}`))
            .map((item) => ({
              title: item.title,
              detail: item.detail,
              audit_key: 'general_formatting',
            }));
          issues = reconcileIssues(issues, missing, version.version_number, version.id);
        });
    }
    const next = reconcileIssues(issues, currentIssues, draft.version_number, draft.id);
    writeTracker(job.id, next);
    setTrackedIssues(next);
  }, [job?.id, draft?.id, currentIssuesSignature, isLatestVersion]);
  const markIssueFixed = (issueId) =>
    setTrackedIssues((current) => {
      const next = current.map((issue) =>
        issue.id === issueId
          ? {
              ...issue,
              status: 'fixed',
              fixedIn: draft?.version_number,
              verifiedResumeId: draft?.id,
            }
          : issue,
      );
      writeTracker(job.id, next);
      return next;
    });
  if (!job) return null;
  const openIssues = trackedIssues.filter((issue) => issue.status === 'open');
  const fixedIssues = trackedIssues.filter((issue) => issue.status === 'fixed');
  const visibleIssues = issueTab === 'open' ? openIssues : fixedIssues;
  const generationPrompt = (
    <section className="resume-generation-prompt">
      {resumeQuality !== null && (
        <div className="resume-quality-indicator">
          <span>Resume quality</span>
          <div
            className="confidence-gauge"
            style={{ '--confidence': resumeQuality }}
            role="img"
            aria-label={`Resume quality: ${resumeQuality}%`}
          >
            <div>
              <strong>{resumeQuality}</strong>
              <small>%</small>
            </div>
          </div>
        </div>
      )}
      <div className="resume-quality-summary"></div>
      {draft && (
        <div className="resume-quality-missing">
          <div className="resume-recommendations-head">
            <b>AI recommendations</b>
            <Button
              className="resume-button"
              variant="secondary"
              onClick={reassessQuality}
              disabled={reassessing || saving}
            >
              <Sparkles size={15} />
              {reassessing ? 'Generating…' : 'Generate recommendations'}
            </Button>
          </div>
          {trackedIssues.length > 0 && (
            <div className="resume-issue-tabs" role="tablist">
              <Button
                className={`resume-button${issueTab === 'open' ? ' selected' : ''}`}
                variant="ghost"
                onClick={() => setIssueTab('open')}
              >
                Needs work ({openIssues.length})
              </Button>
              <Button
                className={`resume-button${issueTab === 'fixed' ? ' selected' : ''}`}
                variant="ghost"
                onClick={() => setIssueTab('fixed')}
              >
                Fixed ({fixedIssues.length})
              </Button>
            </div>
          )}
          {trackedIssues.length ? (
            visibleIssues.length ? (
              <ul>
                {visibleIssues.map((item, index) => {
                  const result = auditResults[item.id];
                  const fixed = item.status === 'fixed';
                  return (
                    <li className={fixed ? 'success' : 'danger'} key={item.id}>
                      <span>
                        <strong>{item.title}</strong>
                        <small>
                          {fixed
                            ? `Fixed in v${item.fixedIn} · first seen in v${item.firstSeen}`
                            : `Open since v${item.firstSeen}`}
                        </small>
                        <span>
                          {result?.feedback ||
                            item.detail ||
                            'AI did not provide details for this item.'}
                        </span>
                        {result?.suggestions?.length > 0 && (
                          <ul>
                            {result.suggestions.map((suggestion, suggestionIndex) => (
                              <li key={suggestionIndex}>{suggestion}</li>
                            ))}
                          </ul>
                        )}
                      </span>
                      {!fixed && (
                        <Button
                          className="resume-button"
                          variant="secondary"
                          onClick={() => checkRecommendation({ ...item, key: item.id }, index)}
                          disabled={checkingKey === item.id}
                        >
                          {checkingKey === item.id ? (
                            'Checking…'
                          ) : (
                            <>
                              <Check size={14} />
                              Check with AI
                            </>
                          )}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p>
                {issueTab === 'open'
                  ? 'Nothing needs work right now.'
                  : 'No issues have been fixed yet.'}
              </p>
            )
          ) : (
            <p>
              Generate AI recommendations to get specific, actionable feedback for this resume and
              job.
            </p>
          )}
        </div>
      )}
      {auditError && <p className="error">{auditError}</p>}
      <textarea
        id="resume-generation-instructions"
        rows="3"
        maxLength="5000"
        value={generationInstructions}
        onChange={(event) => setGenerationInstructions(event.target.value)}
        placeholder="Example: Emphasize my teaching experience, Python projects, and leadership achievements. Keep the resume to two pages."
      />
      <Button
        className="resume-button resume-generation-button"
        variant="primary"
        onClick={generateNewVersion}
        disabled={loading}
      >
        <Sparkles size={16} />
        {loading ? 'Generating…' : draft ? 'Generate new version' : 'Generate resume'}
      </Button>
    </section>
  );
  const builder = (
    <div
      className={`tailored-resume-modal${page ? ' tailored-resume-page' : ''}${fullscreen ? ' tailored-resume-fullscreen' : ''}`}
      role={page ? undefined : 'dialog'}
      aria-modal={page ? undefined : 'true'}
      aria-labelledby="tailored-resume-title"
    >
      <header className="tailored-resume-header">
        <div>
          <h2 id="tailored-resume-title">Tailored resume — {job.company_name}</h2>
          <p>
            Generated from Personal Memory for this job. Unsupported details remain red
            placeholders.
          </p>
        </div>
        <Button
          className="resume-button"
          variant="ghost"
          iconOnly
          onClick={onClose}
          aria-label={page ? 'Back to job analysis' : 'Close'}
        >
          {page ? <ArrowLeft size={19} /> : <X size={19} />}
        </Button>
      </header>
      <div className="resume-builder-toolbar">
        {versions.length > 0 && (
          <select value={activeResume?.id || ''} onChange={(event) => onSelect(event.target.value)}>
            {versions.map((version) => (
              <option value={version.id} key={version.id}>
                v{version.version_number} — {version.name}
              </option>
            ))}
          </select>
        )}
        <div className="resume-mobile-tabs">
          <Button
            className={`resume-button${tab === 'edit' ? ' selected' : ''}`}
            variant="ghost"
            onClick={() => setTab('edit')}
          >
            Edit
          </Button>
          <Button
            className={`resume-button${tab === 'preview' ? ' selected' : ''}`}
            variant="ghost"
            onClick={() => setTab('preview')}
          >
            Preview
          </Button>
        </div>
        {draft && (
          <>
            <select
              value={draft.page_size}
              onChange={(event) =>
                setDraft((current) => ({ ...current, page_size: event.target.value }))
              }
            >
              <option value="A4">A4</option>
              <option value="LETTER">US Letter</option>
            </select>
            <span className={placeholders ? 'placeholder-warning' : 'placeholder-clear'}>
              {placeholders} placeholder{placeholders === 1 ? '' : 's'}
            </span>
            <Button className="resume-button" variant="primary" onClick={save} disabled={saving}>
              <Save size={16} />
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button
              className="resume-button"
              variant="secondary"
              onClick={() => onDownload(getSaveableDraft(), placeholders)}
              disabled={saving}
            >
              <Download size={16} />
              PDF
            </Button>
            <Button
              className="resume-button"
              variant="danger"
              iconOnly
              title="Delete version"
              aria-label="Delete version"
              onClick={() => onDelete(draft.id)}
            >
              <Trash2 size={16} />
            </Button>
          </>
        )}
      </div>
      {!draft ? (
        <div className="resume-builder-body">
          <div className="resume-editor">{generationPrompt}</div>
          <div className="resume-preview-pane">
            <div className="resume-builder-empty">
              <h3>No tailored resume yet</h3>
              <p>
                Add optional instructions on the left, then generate a version from this job
                description and Personal Memory.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="resume-builder-body">
          <div className={`resume-editor ${tab !== 'edit' ? 'mobile-hidden' : ''}`}>
            {generationPrompt}
          </div>
          <div className={`resume-preview-pane ${tab !== 'preview' ? 'mobile-hidden' : ''}`}>
            <ResumePreview
              data={data}
              pageSize={draft.page_size}
              editable
              onContactChange={updateContact}
              onFieldChange={updateData}
              onItemChange={updateItem}
              onBulletChange={updateBullet}
            />
          </div>
        </div>
      )}
    </div>
  );
  return page ? (
    builder
  ) : (
    <PopupBackdrop
      className={`tailored-resume-backdrop${fullscreen ? ' tailored-resume-fullscreen-backdrop' : ''}`}
      onClose={onClose}
      priority={130}
    >
      {() => builder}
    </PopupBackdrop>
  );
};

export default TailoredResumeBuilder;
