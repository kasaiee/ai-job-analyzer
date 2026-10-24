import React, {useEffect, useMemo, useState} from 'react';
import {Download, Plus, Save, Sparkles, Trash2, X} from 'lucide-react';
import Button from '../atoms/Button';
import ResumePreview from '../molecules/ResumePreview';

const updateListItem = (data, section, index, field, value) => ({...data,[section]:data[section].map((item,itemIndex)=>itemIndex===index?{...item,[field]:value}:item)});
const emptyExperience = {company:'',role:'',location:'',start_date:'',end_date:'',bullets:[],source_memory_ids:[]};
const placeholderCount = data => (JSON.stringify(data).match(/\[ADD [^\]]+\]/g)||[]).length;

const TailoredResumeBuilder = ({job, versions, activeResume, loading, saving, onClose, onGenerate, onSelect, onSave, onDelete, onDownload}) => {
  const [draft,setDraft]=useState(null);const [tab,setTab]=useState('edit');
  useEffect(()=>setDraft(activeResume?structuredClone(activeResume):null),[activeResume]);
  const data=draft?.resume_data;const placeholders=useMemo(()=>data?placeholderCount(data):0,[data]);
  const updateContact=(field,value)=>setDraft(current=>({...current,resume_data:{...current.resume_data,contact:{...current.resume_data.contact,[field]:value}}}));
  const updateData=(field,value)=>setDraft(current=>({...current,resume_data:{...current.resume_data,[field]:value}}));
  const updateItem=(section,index,field,value)=>setDraft(current=>({...current,resume_data:updateListItem(current.resume_data,section,index,field,value)}));
  const removeItem=(section,index)=>updateData(section,data[section].filter((_,itemIndex)=>itemIndex!==index));
  const save=()=>onSave(draft);
  if (!job) return null;
  return <div className="modal-backdrop tailored-resume-backdrop"><div className="tailored-resume-modal" role="dialog" aria-modal="true" aria-labelledby="tailored-resume-title">
    <header className="tailored-resume-header"><div><h2 id="tailored-resume-title">Tailored resume — {job.company_name}</h2><p>Generated from Personal Memory for this job. Unsupported details remain red placeholders.</p></div><Button onClick={onClose} aria-label="Close"><X size={19}/></Button></header>
    <div className="resume-builder-toolbar"><Button onClick={onGenerate} disabled={loading}><Sparkles size={16}/>{loading?'Generating…':'Generate new version'}</Button>{versions.length>0&&<select value={activeResume?.id||''} onChange={event=>onSelect(event.target.value)}>{versions.map(version=><option value={version.id} key={version.id}>v{version.version_number} — {version.name}</option>)}</select>}<div className="resume-mobile-tabs"><Button className={tab==='edit'?'selected':''} onClick={()=>setTab('edit')}>Edit</Button><Button className={tab==='preview'?'selected':''} onClick={()=>setTab('preview')}>Preview</Button></div>{draft&&<><select value={draft.page_size} onChange={event=>setDraft(current=>({...current,page_size:event.target.value}))}><option value="A4">A4</option><option value="LETTER">US Letter</option></select><span className={placeholders?'placeholder-warning':'placeholder-clear'}>{placeholders} placeholder{placeholders===1?'':'s'}</span><Button onClick={save} disabled={saving}><Save size={16}/>{saving?'Saving…':'Save'}</Button><Button onClick={()=>onDownload(draft,placeholders)}><Download size={16}/>PDF</Button><Button variant="danger" iconOnly title="Delete version" onClick={()=>onDelete(draft.id)}><Trash2 size={16}/></Button></>}</div>
    {!draft?<div className="resume-builder-empty"><h3>No tailored resume yet</h3><p>Generate a version from this job description and Personal Memory.</p><Button onClick={onGenerate} disabled={loading}><Sparkles size={16}/>Generate resume</Button></div>:<div className="resume-builder-body">
      <div className={`resume-editor ${tab!=='edit'?'mobile-hidden':''}`}>
        <section><h3>Contact</h3><div className="resume-field-grid">{['name','headline','email','phone','location'].map(field=><label key={field}><span>{field.replace('_',' ')}</span><input value={data.contact[field]||''} onChange={event=>updateContact(field,event.target.value)}/></label>)}</div><label><span>Links (one per line)</span><textarea rows="3" value={(data.contact.links||[]).join('\n')} onChange={event=>updateContact('links',event.target.value.split('\n').filter(Boolean))}/></label></section>
        <section><h3>Professional Summary</h3><textarea rows="5" value={data.professional_summary||''} onChange={event=>updateData('professional_summary',event.target.value)}/></section>
        <section><div className="resume-section-heading"><h3>Skills</h3><Button onClick={()=>updateData('skills',[...data.skills,{name:'',source_memory_ids:[]}])}><Plus size={14}/>Add</Button></div>{data.skills.map((item,index)=><div className="resume-inline-editor" key={index}><input value={item.name} onChange={event=>updateItem('skills',index,'name',event.target.value)}/><Button variant="danger" iconOnly onClick={()=>removeItem('skills',index)}><Trash2 size={14}/></Button></div>)}</section>
        <section><div className="resume-section-heading"><h3>Experience</h3><Button onClick={()=>updateData('experience',[...data.experience,emptyExperience])}><Plus size={14}/>Add</Button></div>{data.experience.map((item,index)=><article className="resume-editor-card" key={index}><div className="resume-section-heading"><b>Experience {index+1}</b><Button variant="danger" iconOnly onClick={()=>removeItem('experience',index)}><Trash2 size={14}/></Button></div><div className="resume-field-grid">{['role','company','location','start_date','end_date'].map(field=><label key={field}><span>{field.replace('_',' ')}</span><input value={item[field]||''} onChange={event=>updateItem('experience',index,field,event.target.value)}/></label>)}</div><label><span>Achievement bullets (one per line)</span><textarea rows="6" value={(item.bullets||[]).map(bullet=>bullet.text).join('\n')} onChange={event=>updateItem('experience',index,'bullets',event.target.value.split('\n').filter(Boolean).map((text,bulletIndex)=>({text,source_memory_ids:item.bullets?.[bulletIndex]?.source_memory_ids||[]})))}/></label></article>)}</section>
        {['projects','education','certifications','languages'].map(section=><section key={section}><h3>{section[0].toUpperCase()+section.slice(1)}</h3><textarea rows="6" value={JSON.stringify(data[section],null,2)} onChange={event=>{try{updateData(section,JSON.parse(event.target.value))}catch{}}}/><small>Edit this advanced section as JSON.</small></section>)}
      </div>
      <div className={`resume-preview-pane ${tab!=='preview'?'mobile-hidden':''}`}><ResumePreview data={data} pageSize={draft.page_size}/></div>
    </div>}
  </div></div>;
};

export default TailoredResumeBuilder;
