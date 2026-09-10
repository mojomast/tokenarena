import test from 'node:test';
import assert from 'node:assert/strict';
import {vehicleHud, escapeHint, voiceHint, reloadProgress, dynamicCrosshairGap, lowAmmo, postureLabel, hitMarker} from './hud.mjs';
import {WEAPONS} from './data.mjs';

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

test('reloadProgress tracks a countdown timer and clamps to the bar', () => {
  assert.equal(reloadProgress({reloading:true,reloadTimer:1,reloadDuration:2}), .5);
  assert.equal(reloadProgress({reloading:true,reloadTimer:0,reloadDuration:2}), 1);
  assert.equal(reloadProgress({reloading:true,reloadTimer:2,reloadDuration:2}), 0);
  assert.equal(reloadProgress({reloading:false,reloadTimer:1,reloadDuration:2}), 0);
  assert.equal(reloadProgress({reloading:true,reloadDuration:0}), 1);
  assert.equal(reloadProgress(undefined), 0);
});

test('dynamicCrosshairGap grows with spread, respects size and stays bounded', () => {
  assert.equal(dynamicCrosshairGap(0), 0);
  assert.ok(dynamicCrosshairGap(.05) > dynamicCrosshairGap(.01));
  assert.equal(dynamicCrosshairGap(.05, 2), dynamicCrosshairGap(.05, 1) * 2);
  assert.ok(dynamicCrosshairGap(1) <= 24);
  assert.equal(dynamicCrosshairGap(undefined), 0);
});

test('lowAmmo warns only for finite weapons at a quarter capacity', () => {
  assert.equal(lowAmmo({weapon:1, ammo:[Infinity, 4, 0]}, WEAPONS), true);
  assert.equal(lowAmmo({weapon:1, ammo:[Infinity, 5, 0]}, WEAPONS), false);
  assert.equal(lowAmmo({weapon:0, ammo:[Infinity, 5, 0]}, WEAPONS), false);
  assert.equal(lowAmmo({weapon:1, ammo:[Infinity, 0, 0]}, WEAPONS), false);
  assert.equal(lowAmmo(undefined, WEAPONS), false);
});

test('postureLabel prioritizes slide, then crouch, then sprint', () => {
  assert.equal(postureLabel({sliding:true,crouching:true,sprinting:true}), 'SLIDE');
  assert.equal(postureLabel({crouching:true,sprinting:true}), 'CROUCH');
  assert.equal(postureLabel({sprinting:true}), 'SPRINT');
  assert.equal(postureLabel({}), null);
  assert.equal(postureLabel(undefined), null);
});

test('hitMarker promotes a recent local kill over a normal hit', () => {
  const player = {name:'ChatGPT'};
  assert.equal(hitMarker({hit:true,time:10}, player), 'hit');
  assert.equal(hitMarker({hit:true,time:10,feed:[{killer:'ChatGPT',victim:'Grok',self:false,time:9.5}]}, player), 'kill');
  assert.equal(hitMarker({hit:true,time:10,feed:[{killer:'Grok',victim:'ChatGPT',self:false,time:9.5}]}, player), 'hit');
  assert.equal(hitMarker({hit:false,time:10,feed:[{killer:'ChatGPT',victim:'Grok',time:1}]}, player), null);
  assert.equal(hitMarker({}, player), null);
});
