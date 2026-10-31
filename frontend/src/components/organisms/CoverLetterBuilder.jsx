import React, {useEffect, useState} from 'react';
import {Copy, Download, Save, Sparkles, Trash2, X} from 'lucide-react';
import Button from '../atoms/Button';
import PopupBackdrop from '../molecules/PopupBackdrop';

const CoverLetterBuilder = ({job, versions, activeLetter, loading, saving, onClose, onGenerate, onSelect, onSave, onDelete, onExportPdf, onRenderPdf}) => {
  const [draft, setDraft] = useState(activeLetter); const [instructions, setInstructions] = useState('');
  const [previewUrl, setPreviewUrl] = useState(''); const [previewLoading, setPreviewLoading] = useState(false); const [previewError, setPreviewError] = useState('');
  useEffect(() => setDraft(activeLetter), [activeLetter]);
  useEffect(() => {
    if (!draft?.id || !draft.content.trim()) { setPreviewUrl(''); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setPreviewLoading(true); setPreviewError('');
      try {
        const {blob} = await onRenderPdf(draft, controller.signal);
        if (controller.signal.aborted) return;
        const nextUrl = URL.createObjectURL(blob);
        setPreviewUrl(current => { if (current) URL.revokeObjectURL(current); return nextUrl; });
      } catch (error) {
        if (error.name !== 'AbortError') setPreviewError(error.message);
      } finally {
        if (!controller.signal.aborted) setPreviewLoading(false);
      }
    }, 450);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [draft?.id, draft?.content, draft?.template_data, onRenderPdf]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  if (!job) return null;
  const copy = () => navigator.clipboard?.writeText(draft?.content || '');
  const download = () => onExportPdf(draft);
  const updateTemplateField = (field, value) => setDraft(current => ({...current, template_data: {...(current.template_data || {}), [field]: value}}));
  return <PopupBackdrop className="tailored-resume-backdrop" onClose={onClose} priority={131}>{requestClose => <div className="tailored-resume-modal cover-letter-modal" role="dialog" aria-modal="true" aria-labelledby="cover-letter-title">
    <header className="tailored-resume-header"><div><h2 id="cover-letter-title">Cover letter — {job.company_name}</h2><p>Personalized from Personal Memory, this job’s requirements, and the company profile.</p></div><Button className="resume-button" variant="ghost" iconOnly onClick={requestClose} aria-label="Close"><X size={19}/></Button></header>
    <div className="resume-builder-toolbar cover-letter-toolbar">{versions.length>0&&<select aria-label="Cover letter version" value={activeLetter?.id||''} onChange={e=>onSelect(e.target.value)}>{versions.map(v=><option key={v.id} value={v.id}>v{v.version_number} — {v.name}</option>)}</select>}{draft&&<><Button className="resume-button" variant="primary" onClick={()=>onSave(draft)} disabled={saving}><Save size={16}/>{saving?'Saving…':'Save'}</Button><Button className="resume-button" variant="secondary" onClick={copy}><Copy size={16}/>Copy</Button><Button className="resume-button" variant="secondary" onClick={download} disabled={saving}><Download size={16}/>PDF</Button><Button className="resume-button" variant="danger" iconOnly onClick={()=>onDelete(draft.id)} aria-label="Delete version"><Trash2 size={16}/></Button></>}</div>
    <div className="cover-letter-body"><div className="cover-letter-editor-column"><section className="resume-generation-prompt cover-letter-generation-prompt"><label htmlFor="cover-letter-instructions">Instructions for the next generated letter</label><textarea id="cover-letter-instructions" rows="8" maxLength="20000" value={instructions} onChange={e=>setInstructions(e.target.value)} placeholder="Write detailed guidance for this letter: tone, relevant experience to emphasize, company-specific motivation, structure, and anything else the AI should consider."/><small>{instructions.length.toLocaleString()} / 20,000 characters. Optional. The AI cannot add facts outside Personal Memory or the company profile.</small><Button className="resume-button resume-generation-button" variant="primary" onClick={()=>onGenerate(instructions)} disabled={loading}><Sparkles size={16}/>{loading?'Generating…':draft?'Generate new version':'Generate cover letter'}</Button></section>{draft?<><section className="cover-letter-template-fields" aria-labelledby="cover-letter-template-fields-title"><h3 id="cover-letter-template-fields-title">Document details</h3><div className="cover-letter-fields-grid"><label><span>Your name</span><input value={draft.template_data?.sender_name||''} onChange={e=>updateTemplateField('sender_name',e.target.value)} placeholder="Leave blank to hide"/></label><label><span>Email</span><input type="email" value={draft.template_data?.sender_email||''} onChange={e=>updateTemplateField('sender_email',e.target.value)} placeholder="Leave blank to hide"/></label><label><span>Date</span><input value={draft.template_data?.date||''} onChange={e=>updateTemplateField('date',e.target.value)} placeholder="Leave blank to hide"/></label><label><span>Target role</span><input value={draft.template_data?.role||''} onChange={e=>updateTemplateField('role',e.target.value)} placeholder="Leave blank to hide"/></label><label className="cover-letter-company-field"><span>Company</span><input value={draft.template_data?.company||''} onChange={e=>updateTemplateField('company',e.target.value)} placeholder="Leave blank to hide"/></label></div><small>These fields control the PDF header and signature. Empty fields are omitted.</small></section><div className="cover-letter-editor-wrap"><label htmlFor="cover-letter-content">Edit cover letter text</label><textarea id="cover-letter-content" className="cover-letter-editor" value={draft.content} onChange={e=>setDraft({...draft,content:e.target.value})}/></div></>:<div className="resume-builder-empty"><h3>{loading?'Generating your cover letter…':'No cover letter yet'}</h3><p>{loading?'Your first version will appear in the preview when generation is complete.':'Generate a tailored letter for this job.'}</p></div>}</div><section className="cover-letter-preview-pane cover-letter-pdf-preview" aria-label="Exact exported PDF preview">{previewUrl&&<iframe src={`${previewUrl}#toolbar=0&navpanes=0&view=FitH`} title="Exact cover letter PDF preview"/>}{(previewLoading||(!previewUrl&&draft))&&<div className="cover-letter-preview-status">Rendering exact PDF preview…</div>}{previewError&&<div className="cover-letter-preview-status cover-letter-preview-error">{previewError}</div>}{!draft&&<div className="resume-builder-empty"><h3>{loading?'Preparing preview…':'Preview will appear here'}</h3><p>The exact exported PDF updates as you edit the text.</p></div>}</section></div>
  </div>}</PopupBackdrop>;
};
export default CoverLetterBuilder;
