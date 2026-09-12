import test from 'node:test';
import assert from 'node:assert/strict';
import {postStage,applyComposerSize,disposeComposer,reducedMotion} from './post.mjs';

const fakeComposer = () => {
  const calls = [];
  const composer = {
    passes: [],
    ratio: 1,
    target: { w: 0, h: 0 },
    setPixelRatio(ratio) { calls.push(['ratio', ratio]); composer.ratio = ratio; },
    setSize(w, h) { calls.push(['size', w, h]); composer.target = { w: Math.round(w * composer.ratio), h: Math.round(h * composer.ratio) }; },
    dispose() { calls.push(['dispose']); },
  };
  return { composer, calls };
};

test('post-processing is only enabled for a full-resolution hardware renderer', () => {
  assert.equal(postStage({ eligible: true, reduced: false, scale: 1 }), true);
  assert.equal(postStage({ eligible: true, reduced: false, scale: 1.5 }), true);
  assert.equal(postStage({ eligible: true, reduced: true, scale: 1 }), false);
  assert.equal(postStage({ eligible: true, reduced: false, scale: .9 }), false);
  assert.equal(postStage({ eligible: false, reduced: false, scale: 1 }), false);
  assert.equal(postStage({ eligible: true, reduced: false }), true);
});

test('composer sizing applies the pixel ratio exactly once', () => {
  const { composer } = fakeComposer();
  applyComposerSize(composer, 800, 450, 1.5);
  assert.deepEqual(composer.target, { w: 1200, h: 675 }, 'CSS pixels must be passed, not device pixels');
  applyComposerSize(composer, 800, 450, 1);
  assert.deepEqual(composer.target, { w: 800, h: 450 }, 'a DPR change re-sizes the targets');
  applyComposerSize(composer, 800, 450, 0);
  assert.deepEqual(composer.target, { w: 800, h: 450 }, 'an invalid ratio falls back to 1');
});

test('disposing a composer releases added passes and then the composer', () => {
  let passDisposed = 0, composerDisposed = 0;
  disposeComposer({ passes: [{ dispose: () => { passDisposed++; } }, { dispose: () => { passDisposed++; } }], dispose: () => { composerDisposed++; } });
  assert.equal(passDisposed, 2);
  assert.equal(composerDisposed, 1);
  assert.doesNotThrow(() => disposeComposer(null));
  assert.doesNotThrow(() => disposeComposer({}));
});

test('reduced motion combines the app preference with the OS preference', () => {
  assert.equal(reducedMotion(false, false), false);
  assert.equal(reducedMotion(true, false), true);
  assert.equal(reducedMotion(false, true), true);
  assert.equal(reducedMotion(true, true), true);
});
