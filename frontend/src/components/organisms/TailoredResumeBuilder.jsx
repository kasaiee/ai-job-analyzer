import React, {useEffect, useMemo, useState} from 'react';
import {Download, Save, Sparkles, Trash2, X} from 'lucide-react';
import Button from '../atoms/Button';
import ResumePreview from '../molecules/ResumePreview';
import PopupBackdrop from '../molecules/PopupBackdrop';
import {compactContactLinks} from '../../utils/resumeContact';

const updateListItem = (data, section, index, field, value) => ({...data,[section]:data[section].map((item,itemIndex)=>itemIndex===index?{...item,[field]:value}:item)});
const placeholderCount = data => (JSON.stringify(data).match(/\[ADD [^\]]+\]/g)||[]).length;
const auditLabels={job_title_match:'Target job title',degree_match:'Degree requirement',word_count:'Resume length',accomplishments:'Quantified accomplishments',buzz_words:'Buzzwords',verb_choice:'Action verbs',first_person:'First-person language',date_formatting:'Date consistency',general_formatting:'General formatting'};
const passingAuditStatuses=new Set(['MATCH','NO_REQUIREMENT','OPTIMAL','GOOD','CLEAN']);

const ResumeAudit = ({audit}) => {
  if (!audit) return <div className="tailored-resume-audit"><h3>ATS resume audit</h3><p>Sync the job analysis to generate the ATS audit.</p></div>;
  const items=Object.entries(auditLabels).map(([key,label])=>({key,label,item:audit[key]})).filter(({item})=>item);
  if (audit.contact_info) items.push({key:'contact_info',label:'Contact information',item:{status:audit.contact_info.has_email&&audit.contact_info.has_phone?'CLEAN':'FLAGGED',feedback:audit.contact_info.feedback,suggestions:[`Email: ${audit.contact_info.has_email?'present':'missing'} · Phone: ${audit.contact_info.has_phone?'present':'missing'}`]}});
  return <div className="tailored-resume-audit"><h3>ATS resume audit</h3><div className="tailored-resume-audit-grid">{items.map(({key,label,item})=>{const passed=passingAuditStatuses.has(item.status);return <article className={`tailored-resume-audit-item ${passed?'pass':'flag'}`} key={key}><span className="tailored-resume-audit-icon">{passed?'✓':'!'}</span><div><div><h4>{label}</h4><b>{item.status?.replaceAll('_',' ')}</b></div>{item.feedback&&<p>{item.feedback}</p>}{item.suggestions?.length>0&&<ul>{item.suggestions.map((suggestion,index)=><li key={index}>{suggestion}</li>)}</ul>}</div></article>})}</div></div>;
};

const TailoredResumeBuilder = ({job, versions, activeResume, loading, saving, onClose, onGenerate, onSelect, onSave, onDelete, onDownload}) => {
  const [draft,setDraft]=useState(null);const [tab,setTab]=useState('edit');const [generationInstructions,setGenerationInstructions]=useState('');
  useEffect(()=>setDraft(activeResume?structuredClone(activeResume):null),[activeResume]);
  useEffect(()=>setGenerationInstructions(''),[job?.id]);
  const data=draft?.resume_data;const placeholders=useMemo(()=>data?placeholderCount(data):0,[data]);
  const resumeQuality=Number.isInteger(data?.quality_assessment?.score)?data.quality_assessment.score:null;
  const resumeQualityMissing=data?.quality_assessment?.missing_information||[];
  const resumeAudit=data?.resume_audit;
  const updateContact=(field,value)=>setDraft(current=>({...current,resume_data:{...current.resume_data,contact:{...current.resume_data.contact,[field]:value}}}));
  const updateData=(field,value)=>setDraft(current=>({...current,resume_data:{...current.resume_data,[field]:value}}));
  const updateItem=(section,index,field,value)=>setDraft(current=>({...current,resume_data:updateListItem(current.resume_data,section,index,field,value)}));
  const updateBullet=(section,itemIndex,bulletIndex,value)=>setDraft(current=>({...current,resume_data:updateListItem(current.resume_data,section,itemIndex,'bullets',current.resume_data[section][itemIndex].bullets.map((bullet,index)=>index===bulletIndex?{...bullet,text:value}:bullet))}));
  const save=()=>onSave({...draft,resume_data:{...data,contact:{...data.contact,links:compactContactLinks(data.contact.links)}}});
  if (!job) return null;
  const generationPrompt=<section className="resume-generation-prompt">{resumeQuality!==null&&<div className="resume-quality-indicator"><span>Resume quality</span><div className="confidence-gauge" style={{'--confidence':resumeQuality}} role="img" aria-label={`Resume quality: ${resumeQuality}%`}><div><strong>{resumeQuality}</strong><small>%</small></div></div></div>}<div className="resume-quality-summary"></div>{draft&&<div className="resume-quality-missing"><b>Missing information that could improve this resume</b>{resumeQualityMissing.length?<ul>{resumeQualityMissing.map((item,index)=><li key={`${item.title}-${index}`}><strong>{item.title}</strong><span>{item.detail}</span></li>)}</ul>:<p>{data?.quality_assessment?'No important missing resume information was identified in this generated resume.':'Generate a new version to assess the completed resume itself.'}</p>}</div>}<ResumeAudit audit={resumeAudit}/><textarea id="resume-generation-instructions" rows="3" maxLength="5000" value={generationInstructions} onChange={event=>setGenerationInstructions(event.target.value)} placeholder="Example: Emphasize my teaching experience, Python projects, and leadership achievements. Keep the resume to two pages."/><Button className="resume-button resume-generation-button" variant="primary" onClick={()=>onGenerate(generationInstructions)} disabled={loading}><Sparkles size={16}/>{loading?'Generating…':draft?'Generate new version':'Generate resume'}</Button></section>;
  return <PopupBackdrop className="tailored-resume-backdrop" onClose={onClose} priority={130}>{requestClose=><div className="tailored-resume-modal" role="dialog" aria-modal="true" aria-labelledby="tailored-resume-title">
    <header className="tailored-resume-header"><div><h2 id="tailored-resume-title">Tailored resume — {job.company_name}</h2><p>Generated from Personal Memory for this job. Unsupported details remain red placeholders.</p></div><Button className="resume-button" variant="ghost" iconOnly onClick={requestClose} aria-label="Close"><X size={19}/></Button></header>
    <div className="resume-builder-toolbar">{versions.length>0&&<select value={activeResume?.id||''} onChange={event=>onSelect(event.target.value)}>{versions.map(version=><option value={version.id} key={version.id}>v{version.version_number} — {version.name}</option>)}</select>}<div className="resume-mobile-tabs"><Button className={`resume-button${tab==='edit'?' selected':''}`} variant="ghost" onClick={()=>setTab('edit')}>Edit</Button><Button className={`resume-button${tab==='preview'?' selected':''}`} variant="ghost" onClick={()=>setTab('preview')}>Preview</Button></div>{draft&&<><select value={draft.page_size} onChange={event=>setDraft(current=>({...current,page_size:event.target.value}))}><option value="A4">A4</option><option value="LETTER">US Letter</option></select><span className={placeholders?'placeholder-warning':'placeholder-clear'}>{placeholders} placeholder{placeholders===1?'':'s'}</span><Button className="resume-button" variant="primary" onClick={save} disabled={saving}><Save size={16}/>{saving?'Saving…':'Save'}</Button><Button className="resume-button" variant="secondary" onClick={()=>onDownload(draft,placeholders)}><Download size={16}/>PDF</Button><Button className="resume-button" variant="danger" iconOnly title="Delete version" aria-label="Delete version" onClick={()=>onDelete(draft.id)}><Trash2 size={16}/></Button></>}</div>
    {!draft?<div className="resume-builder-body"><div className="resume-editor">{generationPrompt}</div><div className="resume-preview-pane"><div className="resume-builder-empty"><h3>No tailored resume yet</h3><p>Add optional instructions on the left, then generate a version from this job description and Personal Memory.</p></div></div></div>:<div className="resume-builder-body">
      <div className={`resume-editor ${tab!=='edit'?'mobile-hidden':''}`}>
        {generationPrompt}
      </div>
      <div className={`resume-preview-pane ${tab!=='preview'?'mobile-hidden':''}`}><ResumePreview data={data} pageSize={draft.page_size} editable onContactChange={updateContact} onFieldChange={updateData} onItemChange={updateItem} onBulletChange={updateBullet}/></div>
    </div>}
  </div>}</PopupBackdrop>;
};

export default TailoredResumeBuilder;
