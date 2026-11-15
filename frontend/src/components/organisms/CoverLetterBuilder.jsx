import React, { useEffect, useState } from 'react';
import { ArrowLeft, Copy, Download, Save, Sparkles, Trash2, X } from 'lucide-react';
import Button from '../atoms/Button';
import PopupBackdrop from '../molecules/PopupBackdrop';
import CoverLetterPreview from '../molecules/CoverLetterPreview';

const CoverLetterBuilder = ({
  job,
  versions,
  activeLetter,
  loading,
  saving,
  onClose,
  onGenerate,
  onSelect,
  onSave,
  onDelete,
  onExportPdf,
  onRenderPdf,
  page = false,
  fullscreen = false,
}) => {
  const [draft, setDraft] = useState(activeLetter);
  const [instructions, setInstructions] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  useEffect(() => setDraft(activeLetter), [activeLetter]);
  useEffect(() => {
    if (!draft?.id || !draft.content.trim()) {
      setPreviewUrl('');
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      setPreviewError('');
      try {
        const { blob } = await onRenderPdf(draft, controller.signal);
        if (controller.signal.aborted) return;
        const nextUrl = URL.createObjectURL(blob);
        setPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return nextUrl;
        });
      } catch (error) {
        if (error.name !== 'AbortError') setPreviewError(error.message);
      } finally {
        if (!controller.signal.aborted) setPreviewLoading(false);
      }
    }, 450);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [draft?.id, draft?.content, draft?.template_data, onRenderPdf]);
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );
  if (!job) return null;
  const copy = () => navigator.clipboard?.writeText(draft?.content || '');
  const download = () => onExportPdf(draft);
  const updateTemplateField = (field, value) =>
    setDraft((current) => ({
      ...current,
      template_data: { ...(current.template_data || {}), [field]: value },
    }));
  const builder = (
    <div
      className={`tailored-resume-modal cover-letter-modal${page ? ' tailored-resume-page' : ''}${fullscreen ? ' tailored-resume-fullscreen' : ''}`}
      role={page ? undefined : 'dialog'}
      aria-modal={page ? undefined : 'true'}
      aria-labelledby="cover-letter-title"
    >
      <header className="tailored-resume-header">
        <div>
          <h2 id="cover-letter-title">Cover letter — {job.company_name}</h2>
          <p>
            Personalized from Personal Memory, this job’s requirements, and the company profile.
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
      <div className="resume-builder-toolbar cover-letter-toolbar">
        {versions.length > 0 && (
          <select
            aria-label="Cover letter version"
            value={activeLetter?.id || ''}
            onChange={(e) => onSelect(e.target.value)}
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.version_number} — {v.name}
              </option>
            ))}
          </select>
        )}
        {draft && (
          <>
            <Button
              className="resume-button"
              variant="primary"
              onClick={() => onSave(draft)}
              disabled={saving}
            >
              <Save size={16} />
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button className="resume-button" variant="secondary" onClick={copy}>
              <Copy size={16} />
              Copy
            </Button>
            <Button
              className="resume-button"
              variant="secondary"
              onClick={download}
              disabled={saving}
            >
              <Download size={16} />
              PDF
            </Button>
            <Button
              className="resume-button"
              variant="danger"
              iconOnly
              onClick={() => onDelete(draft.id)}
              aria-label="Delete version"
            >
              <Trash2 size={16} />
            </Button>
          </>
        )}
      </div>
      <div className="cover-letter-body">
        <div className="cover-letter-editor-column">
          <section className="resume-generation-prompt cover-letter-generation-prompt">
            <label htmlFor="cover-letter-instructions">
              Instructions for the next generated letter
            </label>
            <textarea
              id="cover-letter-instructions"
              rows="8"
              maxLength="20000"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Write guidance for the next version: tone, relevant experience, company motivation, or structure."
            />
            <small>
              {instructions.length.toLocaleString()} / 20,000 characters. Optional. The AI cannot
              add facts outside Personal Memory or the company profile.
            </small>
            <Button
              className="resume-button resume-generation-button"
              variant="primary"
              onClick={() => onGenerate(instructions)}
              disabled={loading}
            >
              <Sparkles size={16} />
              {loading ? 'Generating…' : draft ? 'Generate new version' : 'Generate cover letter'}
            </Button>
          </section>
          {!draft && (
            <div className="resume-builder-empty">
              <h3>{loading ? 'Generating your cover letter…' : 'No cover letter yet'}</h3>
              <p>
                {loading
                  ? 'Your first version will appear in the preview when generation is complete.'
                  : 'Generate a tailored letter for this job.'}
              </p>
            </div>
          )}
        </div>
        <section className="cover-letter-preview-pane" aria-label="Editable cover letter preview">
          {draft ? (
            <CoverLetterPreview draft={draft} onChange={setDraft} />
          ) : (
            <div className="resume-builder-empty">
              <h3>Preview will appear here</h3>
              <p>Generate a letter to edit it in the preview.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
  return page ? (
    builder
  ) : (
    <PopupBackdrop
      className={`tailored-resume-backdrop${fullscreen ? ' tailored-resume-fullscreen-backdrop' : ''}`}
      onClose={onClose}
      priority={131}
    >
      {() => builder}
    </PopupBackdrop>
  );
};
export default CoverLetterBuilder;
