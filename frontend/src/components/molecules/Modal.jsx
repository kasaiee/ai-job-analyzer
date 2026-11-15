import React from 'react';
import { X } from 'lucide-react';
import Button from '../atoms/Button';
import PopupBackdrop from './PopupBackdrop';

/**
 * Shared modal shell: backdrop behavior, dialog semantics, and a close button.
 * Children receive `requestClose` so forms can close after a successful action.
 */
const Modal = ({
  open = true,
  onClose,
  title,
  titleId,
  closeLabel = 'Close',
  className = '',
  priority = 0,
  children,
}) => {
  if (!open) return null;

  const dialogClasses = ['modal', className].filter(Boolean).join(' ');

  return (
    <PopupBackdrop onClose={onClose} priority={priority}>
      {(requestClose) => (
        <div className={dialogClasses} role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <div className="modal-head">
            <h2 id={titleId}>{title}</h2>
            <Button type="button" onClick={requestClose} aria-label={closeLabel}>
              <X size={18} />
            </Button>
          </div>
          {typeof children === 'function' ? children(requestClose) : children}
        </div>
      )}
    </PopupBackdrop>
  );
};

export default Modal;
