import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from './core.mjs';

const seeded = () => { let n = 29; return () => ((n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296); };
const fresh = () => new Match('chatgpt', 'openclaw', seeded(), 'crosswire', {mode: 'teamdeathmatch', botCount: 0, humanCount: 2, timeLimit: 60, fragLimit: 50});
const kill = (m, attacker, victim) => { Object.assign(victim, {health: 1, protection: 0, armor: 0}); m.damage(victim, 999, attacker); };

test('killstreak rewards land at 3, 5 and 7 kills and reset on death', () => {
  const m = fresh(), [a, b] = m.actors;
  a.health = 50;
  kill(m, a, b); kill(m, a, b);
  assert.equal(a.streak, 2);
  kill(m, a, b);
  assert.equal(a.streak, 3);
  assert.ok(a.health > 50, 'scavenger heals the killer');
  assert.equal(m.events.filter(e => e.type === 'killstreak').at(-1).reward, 'scavenger');
  kill(m, a, b); kill(m, a, b);
  assert.equal(a.streak, 5);
  assert.ok((a.powerups.overcharge || 0) > 0, 'overcharge at five kills');
  kill(m, a, b); kill(m, a, b);
  assert.equal(a.streak, 7);
  assert.ok((a.powerups.overshield || 0) > 0, 'overshield at seven kills');
  assert.ok(a.temporaryShield > 0, 'overshield grants a shield');
  Object.assign(a, {health: 1, protection: 0, armor: 0});
  m.damage(a, 999, b);
  assert.equal(a.streak, 0, 'death resets the streak');
  m.spawn(a);
  assert.equal(a.streak, 0, 'spawn resets the streak');
});
