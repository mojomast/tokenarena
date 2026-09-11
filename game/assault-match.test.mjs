import assert from 'node:assert/strict';
import test from 'node:test';
import {Match} from './core.mjs';

test('assault mode captures sectors in order and breaches at the end', () => {
  const m = new Match('chatgpt', 'openclaw', () => .5, 'rampart', {mode: 'assault', botCount: 0, humanCount: 4, respawn: 5});
  assert.equal(m.objectiveState.kind, 'assault');
  assert.equal(m.objectiveState.sectors.length, 3);
  const attackers = m.actors.filter(a => a.team === 0), defenders = m.actors.filter(a => a.team === 1);
  assert.equal(attackers.length, 2);
  for (const defender of defenders) Object.assign(defender, {x: m.arena.bounds.minX + 2, y: 0, z: m.arena.bounds.minZ + 2, health: 100, protection: 0, grounded: true});
  const parkDefenders = () => { for (const d of defenders) Object.assign(d, {x: m.arena.bounds.minX + 2, y: 0, z: m.arena.bounds.minZ + 2, health: 100, protection: 0}); };
  for (let sector = 0; sector < 3; sector++) {
    const zone = m.objectiveState.sectors[sector];
    for (const attacker of attackers) Object.assign(attacker, {x: zone.x, y: zone.y ?? 0, z: zone.z, health: 100, protection: 0, grounded: true});
    let frames = 0;
    while (m.objectiveState.active === sector && !m.over && frames++ < 1200) { parkDefenders(); m.step(1 / 60, {inputs: {}}); }
    assert.equal(m.objectiveState.active, sector + 1, `sector ${sector} did not fall in order`);
  }
  assert.equal(m.over, true);
  assert.equal(m.objectiveState.breached, true);
  assert.equal(m.objectiveState.winner, 0);
});

test('defenders prevent an assault sector from falling', () => {
  const m = new Match('chatgpt', 'openclaw', () => .5, 'rampart', {mode: 'assault', botCount: 0, humanCount: 4, respawn: 5});
  const zone = m.objectiveState.sectors[0];
  for (const a of m.actors) Object.assign(a, {x: zone.x, y: zone.y ?? 0, z: zone.z, health: 100, protection: 0, grounded: true});
  for (let i = 0; i < 600; i++) m.step(1 / 60, {inputs: {}});
  assert.equal(m.objectiveState.active, 0);
  assert.equal(m.objectiveState.breached, false);
});
