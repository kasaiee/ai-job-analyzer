import React, { useEffect, useMemo, useState } from 'react';
import { FolderPlus } from 'lucide-react';
import Button from '../atoms/Button';
import Modal from './Modal';
import { useLanguage } from '../../templates/LanguageProvider';

const MemoryCaptureModal = ({ capture, paths, saving, onClose, onSave }) => {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  useEffect(() => {
    setName('');
    setPath('');
    setActiveIndex(-1);
  }, [capture]);
  const matches = useMemo(() => {
    const query = path.trim().toLocaleLowerCase();
    return paths.filter((item) => !query || item.toLocaleLowerCase().includes(query)).slice(0, 8);
  }, [path, paths]);
  const options = useMemo(() => ['', ...matches], [matches]);
  const selectPath = (value) => {
    setPath(value);
    setFocused(false);
    setActiveIndex(-1);
  };
  const handlePathKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setFocused(true);
      setActiveIndex((index) => (index < options.length - 1 ? index + 1 : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setFocused(true);
      setActiveIndex((index) => (index > 0 ? index - 1 : options.length - 1));
    } else if (event.key === 'Enter' && focused && activeIndex >= 0) {
      event.preventDefault();
      selectPath(options[activeIndex]);
    } else if (event.key === 'Escape' && focused) {
      event.preventDefault();
      setFocused(false);
      setActiveIndex(-1);
    }
  };
  if (!capture) return null;

  return (
    <Modal
      onClose={onClose}
      title={t('saveSelectionToMemory')}
      titleId="memory-capture-title"
      closeLabel={t('close')}
      className="memory-capture-modal"
    >
      {(requestClose) => (
        <form
          className="job-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (await onSave({ name: name.trim(), path: path.trim(), content: capture.text })) {
              requestClose();
            }
          }}
        >
            <label>
              {t('memoryPlacement')}
              <div className="memory-path-autocomplete">
                <FolderPlus size={17} />
                <input
                  value={path}
                  onChange={(event) => {
                    setPath(event.target.value);
                    setFocused(true);
                    setActiveIndex(-1);
                  }}
                  onFocus={() => setFocused(true)}
                  onBlur={() =>
                    setTimeout(() => {
                      setFocused(false);
                      setActiveIndex(-1);
                    }, 150)
                  }
                  onKeyDown={handlePathKeyDown}
                  placeholder={t('memoryPathPlaceholder')}
                  autoComplete="off"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={focused}
                  aria-controls="memory-path-options"
                  aria-activedescendant={
                    activeIndex >= 0 ? `memory-path-option-${activeIndex}` : undefined
                  }
                  autoFocus
                />
                {focused && (
                  <div id="memory-path-options" className="memory-path-suggestions" role="listbox">
                    {options.map((item, index) => (
                      <button
                        id={`memory-path-option-${index}`}
                        type="button"
                        role="option"
                        aria-selected={index === activeIndex}
                        className={index === activeIndex ? 'active' : ''}
                        key={item || 'memory-root'}
                        onMouseDown={(event) => event.preventDefault()}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => selectPath(item)}
                      >
                        <span className="memory-absolute-path">
                          <b>{t('memoryRoot')}</b>
                          {item && (
                            <>
                              <span aria-hidden="true"> / </span>
                              {item.split('/').map((part, partIndex) => (
                                <React.Fragment key={`${part}-${partIndex}`}>
                                  <span>{part}</span>
                                  {partIndex < item.split('/').length - 1 && (
                                    <span aria-hidden="true"> / </span>
                                  )}
                                </React.Fragment>
                              ))}
                            </>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <small className="form-help">{t('memoryPathHelp')}</small>
            </label>
            <label>
              {t('memoryTitle')}
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                maxLength="200"
              />
            </label>
            <label>
              {t('selectedText')}
              <textarea value={capture.text} readOnly rows="6" />
            </label>
            <div className="modal-actions">
              <Button type="button" onClick={requestClose}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? t('saving') : t('saveToMemory')}
              </Button>
            </div>
        </form>
      )}
    </Modal>
  );
};

export default MemoryCaptureModal;
