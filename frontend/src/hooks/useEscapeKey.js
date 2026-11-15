import {useEffect, useRef} from 'react';
import {getTopmostEscapeHandler, registerEscapeHandler, unregisterEscapeHandler} from '../utils/escapeHandlerStack';

/**
 * Closes only the topmost active popup when Escape is pressed.
 *
 * @param {boolean} active
 * @param {() => void} onEscape
 * @param {number} priority
 */
export const useEscapeKey = (active, onEscape, priority = 0) => {
  const handlerRef = useRef(onEscape);
  handlerRef.current = onEscape;

  useEffect(() => {
    if (!active) return undefined;

    const entry = registerEscapeHandler(() => handlerRef.current(), priority);

    const handleKeyDown = event => {
      if (event.key !== 'Escape' || event.defaultPrevented || getTopmostEscapeHandler() !== entry) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      entry.close();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      unregisterEscapeHandler(entry);
    };
  }, [active, priority]);
};
