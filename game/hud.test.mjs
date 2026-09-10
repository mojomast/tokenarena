import test from 'node:test';
import assert from 'node:assert/strict';
import {vehicleHud, escapeHint, voiceHint, reloadProgress, dynamicCrosshairGap, lowAmmo, postureLabel, hitMarker, projectToScreen, damageNumberStyle, boundList, damageBearing, killBanner, weaponTag, ammoText, matchStartBanner, scoreAnnouncer} from './hud.mjs';
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

const identity = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
const camera = {matrixWorldInverse:{elements:identity}, projectionMatrix:{elements:identity}};
const rect = {left:100, top:50, width:800, height:600};

test('projectToScreen maps NDC to CSS pixels over the canvas rect', () => {
  assert.deepEqual(projectToScreen(camera, rect, {x:0, y:0, z:0}), {x:500, y:350, depth:0});
  assert.deepEqual(projectToScreen(camera, rect, {x:1, y:1, z:0}), {x:900, y:50, depth:0});
  assert.deepEqual(projectToScreen(camera, rect, {x:-1, y:-1, z:0}), {x:100, y:650, depth:0});
  assert.equal(projectToScreen(camera, rect, {x:0, y:0, z:2}), null);
  assert.equal(projectToScreen(camera, rect, {x:0, y:0, z:-2}), null);
  assert.equal(projectToScreen(camera, rect, {x:NaN, y:0, z:0}), null);
  assert.equal(projectToScreen(null, rect, {x:0, y:0, z:0}), null);
  assert.equal(projectToScreen(camera, null, {x:0, y:0, z:0}), null);
});

test('projectToScreen reads column-major THREE matrix elements', () => {
  const rotateZ = {matrixWorldInverse:{elements:[0,1,0,0, -1,0,0,0, 0,0,1,0, 0,0,0,1]}, projectionMatrix:{elements:identity}};
  const top = projectToScreen(rotateZ, rect, {x:1, y:0, z:0});
  assert.equal(top.x, 500);
  assert.equal(top.y, 50);
});

test('damageNumberStyle fades and rises, holding position under reduced motion', () => {
  assert.deepEqual(damageNumberStyle(0), {opacity:1, dy:0, done:false});
  assert.equal(damageNumberStyle(.3).dy, -14);
  assert.ok(damageNumberStyle(.6).done);
  assert.equal(damageNumberStyle(.6).opacity, 0);
  assert.equal(damageNumberStyle(.3, {reduced:true}).dy, 0);
  assert.equal(damageNumberStyle(undefined).opacity, 1);
});

test('boundList caps concurrent entries and tolerates missing or invalid lists', () => {
  assert.deepEqual(boundList([], 'a', 2), ['a']);
  assert.deepEqual(boundList(['a', 'b'], 'c', 2), ['b', 'c']);
  assert.deepEqual(boundList(undefined, 'a', 2), ['a']);
  assert.deepEqual(boundList(['a', 'b', 'c'], 'd', -1), ['a', 'b', 'c', 'd']);
});

test('damageBearing measures relative yaw with forward at zero', () => {
  const local = {x:0, z:0, yaw:0};
  assert.ok(Math.abs(damageBearing(local, {x:0, z:-1}).angle) < 1e-9);
  assert.ok(Math.abs(damageBearing(local, {x:-1, z:0}).angle - Math.PI / 2) < 1e-9);
  assert.ok(Math.abs(damageBearing(local, {x:1, z:0}).angle + Math.PI / 2) < 1e-9);
  assert.ok(Math.abs(Math.abs(damageBearing(local, {x:0, z:1}).angle) - Math.PI) < 1e-9);
  assert.equal(damageBearing({x:0, z:0, yaw:Math.PI / 2}, {x:-1, z:0}).angle, 0);
  assert.equal(damageBearing(local, null), null);
  assert.equal(damageBearing(null, {x:0, z:0}), null);
});

test('killBanner derives kill, death and self text with age', () => {
  const player = {name:'ChatGPT'}, close = (actual, expected) => { const rest = {...actual}; delete rest.age; assert.deepEqual(rest, expected); assert.ok(Math.abs(actual.age - .6) < 1e-9); };
  close(killBanner({time:10, feed:[{killer:'ChatGPT', victim:'Grok', self:false, time:9.4}]}, player), {kind:'kill', text:'YOU ELIMINATED Grok'});
  close(killBanner({time:10, feed:[{killer:'Grok', victim:'ChatGPT', self:false, time:9.4}]}, player), {kind:'death', text:'Grok ELIMINATED YOU'});
  close(killBanner({time:10, feed:[{killer:'The void', victim:'ChatGPT', self:true, time:9.4}]}, player), {kind:'self', text:'ELIMINATED'});
  assert.equal(killBanner({time:10, feed:[{killer:'Grok', victim:'Llama', self:false, time:9.4}]}, player), null);
  assert.equal(killBanner({time:10, feed:[{killer:'ChatGPT', victim:'Grok', self:false}]}, player), null);
  assert.equal(killBanner({}, player), null);
});

test('weaponTag and ammoText describe fire mode and unlimited ammo', () => {
  assert.equal(weaponTag(WEAPONS[0]), 'AUTO');
  assert.equal(weaponTag(WEAPONS[2]), 'SEMI');
  assert.equal(weaponTag(null), null);
  assert.equal(ammoText(5), '5');
  assert.equal(ammoText(Infinity), '∞');
  assert.equal(ammoText('∞'), '∞');
});

test('matchStartBanner announces FIGHT with the mode and map for a short window', () => {
  const start = matchStartBanner({time:.5, modeName:'Capture the Flag', mapName:'Exchange'});
  assert.deepEqual(start, {text:'FIGHT', detail:'CAPTURE THE FLAG · EXCHANGE', age:.5, duration:2.6});
  assert.equal(matchStartBanner({time:3, modeName:'Capture the Flag', mapName:'Exchange'}), null);
  assert.equal(matchStartBanner({}), null);
});

test('scoreAnnouncer fires only when a team score crosses an integer', () => {
  assert.deepEqual(scoreAnnouncer({teamScores:{0:2, 1:1}, config:{mode:'teamdeathmatch'}}, {0:1, 1:1}), {team:0, kind:'score', text:'RED SCORES', score:2, amount:1});
  assert.deepEqual(scoreAnnouncer({teamScores:{0:1, 1:3}, config:{mode:'ctf'}}, {0:1, 1:2}), {team:1, kind:'capture', text:'FLAG CAPTURED', score:3, amount:1});
  assert.equal(scoreAnnouncer({teamScores:{0:4.4, 1:1}, config:{mode:'domination'}}, {0:4.1, 1:1}), null);
  assert.equal(scoreAnnouncer({teamScores:{0:2, 1:1}, config:{mode:'deathmatch'}}, {0:2, 1:1}), null);
  assert.equal(scoreAnnouncer({teamScores:{0:2, 1:1}}, null), null);
});
