import test from 'node:test';
import assert from 'node:assert/strict';
import {vehicleHud, escapeHint, voiceHint} from './hud.mjs';

const player = {id:0, health:100, x:0, z:0, vehicleId:null};
const ride = {id:0, health:200, maxHealth:300, x:2, z:0, driver:null, respawnTimer:0, heat:.8, overheated:true};

test('entry prompt matches range, occupancy, life and flag restrictions', () => {
  assert.equal(vehicleHud(player, [ride]).prompt, 'E / ENTER PUMA');
  for (const change of [{x:2.4}, {driver:1}, {health:0}, {respawnTimer:1}]) assert.equal(vehicleHud(player, [{...ride, ...change}]).prompt, '');
  assert.equal(vehicleHud(player, [ride], [{carrier:0}]).prompt, '');
  assert.equal(vehicleHud({...player, health:0}, [ride]).prompt, '');
  assert.equal(vehicleHud(player, [ride], [], true).prompt, '');
  assert.equal(vehicleHud(undefined).prompt, '');
});

test('driver receives authoritative vehicle telemetry and exit prompt, including id zero', () => {
  const vehicle = {...ride, driver:0};
  const result = vehicleHud({...player, vehicleId:0}, [vehicle]);
  assert.equal(result.vehicle, vehicle);
  assert.equal(result.prompt, 'E / EXIT PUMA');
  assert.equal(vehicleHud({...player, vehicleId:0}, [ride]).vehicle, null);
  assert.equal(vehicleHud({...player, vehicleId:0}, [vehicle], [], true).vehicle, null);
});

test('Escape distinguishes local pause from the live online lobby', () => {
  assert.equal(escapeHint(false), 'ESC / PAUSE');
  assert.equal(escapeHint(true), 'ESC / LOBBY (MATCH CONTINUES)');
});

test('voice hint exposes PTT and voice activation without implying a silent mic', () => {
  assert.equal(voiceHint(false, 'ptt'), null);
  assert.equal(voiceHint(false, 'auto'), null);
  assert.equal(voiceHint(true, 'ptt'), 'V / TALK');
  assert.equal(voiceHint(true, 'auto'), 'VOICE / AUTO TALK');
  assert.equal(voiceHint(true, 'unknown'), 'VOICE ON');
});
