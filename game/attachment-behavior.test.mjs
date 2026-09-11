import assert from 'node:assert/strict';
import test from 'node:test';
import {Match} from './core.mjs';

const rig = (attachments) => new Match('chatgpt', 'openclaw', () => .5, 'exchange', {mode: 'deathmatch', botCount: 0, loadouts: {0: {character: 'chatgpt', harness: 'openclaw', attachments}}});

test('a burst module keeps firing after the initial trigger pull', () => {
  const m = rig({underbarrel: 'burst-module'}), a = m.actors[0];
  a.weapon = 0; a.ammo[0] = 50; a.shotWait = 0; a.protection = 0;
  const before = m.stats.shots;
  m.fire(a);
  assert.equal(a.burstLeft, 2);
  for (let i = 0; i < 40; i++) m.step(1 / 60, {});
  assert.ok(m.stats.shots - before >= 3, `expected a 3-round burst, got ${m.stats.shots - before}`);
});

test('attachment stat modifiers change the derived weapon', () => {
  const m = rig({barrel: 'long-barrel', magazine: 'extended-mag'}), a = m.actors[0];
  a.weapon = 0;
  const w = m.weaponFor(a);
  assert.ok(w.range > 60, `long barrel should extend range, got ${w.range}`);
  assert.ok(w.cap > 30, `extended magazine should raise capacity, got ${w.cap}`);
});
