export const POPUP_EXIT_DURATION_MS = 160;

/**
 * Schedules one popup close and ignores repeated requests during its exit.
 *
 * @param {() => void} onClose
 * @param {(callback: () => void, delay: number) => unknown} schedule
 * @param {number} delay
 * @returns {{requestClose: () => boolean, cancel: () => void}}
 */
export const createPopupCloseController = (
  onClose,
  schedule = setTimeout,
  delay = POPUP_EXIT_DURATION_MS,
) => {
  let timer = null;

  return {
    requestClose: () => {
      if (timer !== null) return false;
      timer = schedule(onClose, delay);
      return true;
    },
    cancel: () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
};
