import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from './core.mjs';

test('actors expose a bounded body facing that lags their aim', () => {
  const match = new Match('chatgpt', 'openclaw', Math.random, 'warfront', {mode: 'combined-arms', botCount: 0});
  const actor = match.actors[0];
  actor.yaw = 0;
  actor.bodyYaw = 0;
  match.step(1 / 60, {inputs: {0: {yaw: Math.PI}}});
  assert.ok(actor.bodyYaw > 0 && actor.bodyYaw < 0.25, `body should swivel gradually, got ${actor.bodyYaw}`);
  for (let i = 0; i < 120; i++) match.step(1 / 60, {inputs: {0: {yaw: Math.PI}}});
  assert.ok(Math.abs(actor.bodyYaw - Math.PI) < 0.05, 'body facing should catch up to the aim');
});

test('bots keep a finite body facing while roaming a combined-arms battlefield', () => {
  const match = new Match('grok', 'hermes', Math.random, 'warfront', {mode: 'combined-arms', botCount: 6, difficulty: 'normal'});
  for (let i = 0; i < 300; i++) match.step(1 / 60, {inputs: {}});
  const snap = match.snapshot();
  for (const actor of snap.actors) {
    assert.equal(typeof actor.bodyYaw, 'number', `actor ${actor.id} should report bodyYaw`);
    assert.ok(Number.isFinite(actor.bodyYaw), 'bodyYaw must be finite');
    assert.ok(Math.abs(actor.bodyYaw) <= Math.PI + 1e-6, 'bodyYaw must stay wrapped');
  }
});
