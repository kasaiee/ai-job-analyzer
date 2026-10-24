import React, {useEffect, useState} from 'react';
import {X} from 'lucide-react';
import Button from '../atoms/Button';
import {useLanguage} from '../../templates/LanguageProvider';

const folderPath = (folder, folders) => {
  const names=[folder.name];let parent=folders.find(item=>item.id===folder.parent_id);
  while(parent){names.unshift(parent.name);parent=folders.find(item=>item.id===parent.parent_id)}
  return names.join(' / ');
};

const MemoryMoveModal = ({open, folders, saving, onClose, onMove}) => {
  const {t}=useLanguage();const [parentId,setParentId]=useState('');
  useEffect(()=>{if(open)setParentId('')},[open]);
  if(!open)return null;
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}><div className="modal memory-move-modal" role="dialog" aria-modal="true" aria-labelledby="memory-move-title"><div className="modal-head"><h2 id="memory-move-title">{t('moveMemoryItems')}</h2><Button type="button" onClick={onClose} aria-label={t('close')}><X size={18}/></Button></div><form className="job-form" onSubmit={event=>{event.preventDefault();onMove(parentId||null)}}><label>{t('destinationFolder')}<select value={parentId} onChange={event=>setParentId(event.target.value)}><option value="">{t('memoryRoot')}</option>{folders.map(folder=><option key={folder.id} value={folder.id}>{folderPath(folder,folders)}</option>)}</select></label><div className="modal-actions"><Button type="button" onClick={onClose}>{t('cancel')}</Button><Button type="submit" disabled={saving}>{saving?t('saving'):t('move')}</Button></div></form></div></div>;
};
export default MemoryMoveModal;
