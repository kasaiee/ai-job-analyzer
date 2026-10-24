import React, {useEffect, useState} from 'react';
import {X} from 'lucide-react';
import Button from '../atoms/Button';
import {useLanguage} from '../../templates/LanguageProvider';

const DriveDescriptionModal = ({item, saving, onClose, onSave}) => {
  const {t} = useLanguage();
  const [description, setDescription] = useState('');

  useEffect(() => setDescription(item?.description || ''), [item]);
  if (!item) return null;

  return <div className="modal-backdrop" onMouseDown={event => {if (event.target === event.currentTarget) onClose();}}>
    <div className="modal drive-description-modal" role="dialog" aria-modal="true" aria-labelledby="drive-description-title">
      <div className="modal-head"><div><h2 id="drive-description-title">{t('itemDescription')}</h2><small>{item.name}</small></div><Button type="button" onClick={onClose} aria-label={t('close')}><X size={18}/></Button></div>
      <form className="job-form" onSubmit={event => {event.preventDefault(); onSave(description);}}>
        <label>{t('description')}<textarea rows="8" value={description} onChange={event => setDescription(event.target.value)} placeholder={t('descriptionPlaceholder')} autoFocus/></label>
        <div className="modal-actions"><Button type="button" onClick={onClose}>{t('cancel')}</Button><Button type="submit" disabled={saving}>{saving?t('saving'):t('save')}</Button></div>
      </form>
    </div>
  </div>;
};

export default DriveDescriptionModal;
