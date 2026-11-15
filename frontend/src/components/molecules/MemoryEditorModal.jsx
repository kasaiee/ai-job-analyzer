import React, { useEffect, useState } from 'react';
import Button from '../atoms/Button';
import Modal from './Modal';
import { useLanguage } from '../../templates/LanguageProvider';

const MemoryEditorModal = ({ item, type, saving, onClose, onSave }) => {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    setName(item?.name || '');
    setContent(item?.content || '');
  }, [item, type]);

  if (!type) return null;

  const isFolder = type === 'folder';
  const title = item
    ? t(isFolder ? 'editMemoryFolder' : 'editMemory')
    : t(isFolder ? 'newMemoryFolder' : 'addMemory');

  return (
    <Modal
      onClose={onClose}
      title={title}
      titleId="memory-editor-title"
      closeLabel={t('close')}
      className="memory-editor-modal"
    >
      {(requestClose) => (
        <form
          className="job-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (await onSave({ name, content, is_leaf: !isFolder })) requestClose();
          }}
        >
          <label>
            {t('name')}
            <input value={name} onChange={(event) => setName(event.target.value)} required autoFocus />
          </label>
          {!isFolder && (
            <label>
              {t('memoryContent')}
              <textarea
                rows="9"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                required
              />
            </label>
          )}
          <div className="modal-actions">
            <Button type="button" onClick={requestClose}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? t('saving') : t('save')}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default MemoryEditorModal;
