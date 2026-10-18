import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecoveryPrompt} from '../src/recovery-prompt.js';

function fixture() {
  const yes = new EventTarget(), no = new EventTarget(), dialog = new EventTarget();
  dialog.open = false;
  dialog.querySelector = selector => selector === '[data-recovery-yes]' ? yes : no;
  dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => { dialog.open = false; dialog.dispatchEvent(new Event('close')); };
  const downloads = [];
  return {dialog, yes, no, downloads, offer: createRecoveryPrompt(dialog, (...args) => downloads.push(args))};
}

test('declining or dismissing recovery skips downloads and allows the flow to continue', async () => {
  const f = fixture();
  let result = f.offer({cash: 12});
  assert.equal(f.dialog.open, true);
  assert.equal(f.downloads.length, 0);
  f.no.dispatchEvent(new Event('click'));
  assert.equal(await result, false);
  result = f.offer({cash: 34});
  f.dialog.close();
  assert.equal(await result, false);
  assert.equal(f.downloads.length, 0);
});

test('accepting downloads exactly the chosen backup and reopening does not retain old handlers', async () => {
  const f = fixture(), first = {cash: 12}, second = {cash: 34};
  let result = f.offer(first, 'first');
  f.yes.dispatchEvent(new Event('click'));
  assert.equal(await result, true);
  f.yes.dispatchEvent(new Event('click'));
  assert.deepEqual(f.downloads, [[first, 'first']]);
  result = f.offer(second, 'second');
  f.yes.dispatchEvent(new Event('click'));
  assert.equal(await result, true);
  assert.deepEqual(f.downloads, [[first, 'first'], [second, 'second']]);
});
