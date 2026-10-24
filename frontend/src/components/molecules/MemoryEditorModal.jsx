import React, {useEffect, useState} from 'react';
import {X} from 'lucide-react';
import Button from '../atoms/Button';
import {useLanguage} from '../../templates/LanguageProvider';

const MemoryEditorModal = ({item, type, saving, onClose, onSave}) => {
  const {t} = useLanguage();
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  useEffect(()=>{setName(item?.name||'');setContent(item?.content||'')},[item,type]);
  if (!type) return null;
  const isFolder = type === 'folder';
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}><div className="modal memory-editor-modal" role="dialog" aria-modal="true" aria-labelledby="memory-editor-title"><div className="modal-head"><h2 id="memory-editor-title">{item?t(isFolder?'editMemoryFolder':'editMemory'):t(isFolder?'newMemoryFolder':'addMemory')}</h2><Button type="button" onClick={onClose} aria-label={t('close')}><X size={18}/></Button></div><form className="job-form" onSubmit={event=>{event.preventDefault();onSave({name,content,is_leaf:!isFolder})}}><label>{t('name')}<input value={name} onChange={event=>setName(event.target.value)} required autoFocus/></label>{!isFolder&&<label>{t('memoryContent')}<textarea rows="9" value={content} onChange={event=>setContent(event.target.value)} required/></label>}<div className="modal-actions"><Button type="button" onClick={onClose}>{t('cancel')}</Button><Button type="submit" disabled={saving}>{saving?t('saving'):t('save')}</Button></div></form></div></div>;
};
export default MemoryEditorModal;
