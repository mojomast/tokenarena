import assert from 'node:assert/strict';
import test from 'node:test';
import {Match} from './core.mjs';
import {pickShowcase,seatShowcaseVehicles,SHOWCASES} from './showcase.mjs';
import {maxBotsFor} from './arenas.mjs';

test('showcase cycles between combined arms and instagib', () => {
  const combined = pickShowcase(0, () => 0);
  const rail = pickShowcase(1, () => 0);
  assert.equal(combined.mode, 'combined-arms');
  assert.equal(rail.mode, 'instagib');
  assert.ok(['skyfall-basin', 'trenchline', 'signal-ridge', 'warfront'].includes(combined.mapId));
  assert.ok(combined.botCount <= maxBotsFor('combined-arms'));
  assert.ok(rail.botCount <= maxBotsFor('instagib'));
  assert.equal(pickShowcase(SHOWCASES.length, () => 0).mode, 'combined-arms');
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
