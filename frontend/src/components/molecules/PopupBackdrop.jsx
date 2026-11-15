import React, {useEffect, useRef, useState} from 'react';
import {useEscapeKey} from '../../hooks/useEscapeKey';
import {createPopupCloseController} from '../../utils/popupTransition';

/**
 * Provides shared backdrop dismissal, Escape handling, and exit animation.
 *
 * @param {{children: (requestClose: () => void) => React.ReactNode, className?: string, onClose: () => void, priority?: number}} props
 */
const PopupBackdrop = ({children, className = '', onClose, priority = 0}) => {
  const [closing, setClosing] = useState(false);
  const onCloseRef = useRef(onClose);
  const controllerRef = useRef(null);
  onCloseRef.current = onClose;

  if (!controllerRef.current) {
    controllerRef.current = createPopupCloseController(() => onCloseRef.current());
  }

  useEffect(() => () => controllerRef.current?.cancel(), []);

  const requestClose = () => {
    if (!controllerRef.current.requestClose()) return;
    setClosing(true);
  };

  useEscapeKey(!closing, requestClose, priority);

  const backdropClasses = ['modal-backdrop', className, closing ? 'popup-closing' : 'popup-open'].filter(Boolean).join(' ');

  return <div className={backdropClasses} onMouseDown={event => {if (event.target === event.currentTarget) requestClose();}}>
    {children(requestClose)}
  </div>;
};

export default PopupBackdrop;
