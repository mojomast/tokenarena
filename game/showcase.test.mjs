import assert from 'node:assert/strict';
import test from 'node:test';
import {Match} from './core.mjs';
import {pickShowcase,seatShowcaseVehicles,SHOWCASES} from './showcase.mjs';
import {maxBotsFor} from './arenas.mjs';

test('showcase reel cycles through every scenario', () => {
  assert.ok(SHOWCASES.length >= 5, 'the reel shows several feature sets');
  const modes = SHOWCASES.map(s => s.mode);
  for (const expected of ['combined-arms', 'instagib', 'rockets', 'ctf', 'payload', 'assault']) assert.ok(modes.includes(expected), expected);
  SHOWCASES.forEach((scenario, index) => {
    const spec = pickShowcase(index, () => 0);
    assert.equal(spec.mode, scenario.mode);
    assert.ok(spec.botCount <= maxBotsFor(scenario.mode));
    assert.ok(spec.botCount >= 4);
  });
  assert.equal(pickShowcase(SHOWCASES.length, () => 0).mode, SHOWCASES[0].mode);
  assert.equal(pickShowcase(-1, () => 0).mode, SHOWCASES[SHOWCASES.length - 1].mode);
});

test('combined arms showcase seats bots inside vehicles', () => {
  const spec = pickShowcase(0, () => 0);
  const match = new Match('chatgpt', 'openclaw', () => .5, spec.mapId, {mode: spec.mode, botCount: spec.botCount, difficulty: spec.difficulty});
  assert.ok(match.vehicles.length > 0);
  const seated = seatShowcaseVehicles(match, spec.seatVehicles);
  assert.ok(seated > 0, 'at least one bot should be seated');
  assert.ok(match.actors.some(actor => actor.vehicleId != null));
  assert.ok(match.actors.some(actor => actor.vehicleId == null), 'some bots should stay on foot');
});
