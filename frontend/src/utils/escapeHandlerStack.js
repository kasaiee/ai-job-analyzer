const escapeHandlers = [];

/**
 * Adds a popup close handler and returns its stack entry.
 *
 * @param {() => void} close
 * @param {number} priority
 * @returns {{close: () => void, priority: number}}
 */
export const registerEscapeHandler = (close, priority = 0) => {
  const entry = {close, priority};
  escapeHandlers.push(entry);
  return entry;
};

/** @param {{close: () => void, priority: number}} entry */
export const unregisterEscapeHandler = entry => {
  const entryIndex = escapeHandlers.indexOf(entry);
  if (entryIndex >= 0) escapeHandlers.splice(entryIndex, 1);
};

/** @returns {{close: () => void, priority: number} | null} */
export const getTopmostEscapeHandler = () => {
  if (!escapeHandlers.length) return null;

  const highestPriority = Math.max(...escapeHandlers.map(handler => handler.priority));
  return escapeHandlers.findLast(handler => handler.priority === highestPriority) || null;
};
