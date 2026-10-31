import assert from 'node:assert/strict';
import test from 'node:test';
import {createPopupCloseController, POPUP_EXIT_DURATION_MS} from './popupTransition.js';

test('should delay popup removal until the exit animation finishes', () => {
  let scheduledCallback;
  let scheduledDelay;
  let closeCount = 0;
  const schedule = (callback, delay) => {
    scheduledCallback = callback;
    scheduledDelay = delay;
    return 1;
  };
  const controller = createPopupCloseController(() => {closeCount += 1;}, schedule);

  controller.requestClose();

  assert.equal(closeCount, 0);
  assert.equal(scheduledDelay, POPUP_EXIT_DURATION_MS);
  scheduledCallback();
  assert.equal(closeCount, 1);
});

test('should ignore repeated close requests during the exit animation', () => {
  let scheduleCount = 0;
  const schedule = () => {
    scheduleCount += 1;
    return scheduleCount;
  };
  const controller = createPopupCloseController(() => {}, schedule);

  assert.equal(controller.requestClose(), true);
  assert.equal(controller.requestClose(), false);
  assert.equal(scheduleCount, 1);
});
