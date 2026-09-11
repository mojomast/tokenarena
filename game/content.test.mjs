import test from 'node:test';
import assert from 'node:assert/strict';
import {HARNESSES,POWERUPS,WEAPONS} from './data.mjs';

const originalWeapons=['Pulse Rifle','Rocket Launcher','Rail Lance','Scattergun','Plasma Driver'];
const effectKeys=new Set(['speedMultiplier','damageMultiplier','armor','cooldownMultiplier']);
const color=/^#[0-9a-f]{6}$/i;

test('weapon IDs and original order remain stable while new slots append',()=>{
  assert.deepEqual(WEAPONS.slice(0,5).map(w=>w.name),originalWeapons);
  assert.deepEqual(WEAPONS.slice(5).map(w=>w.short),['GRENADE','SHOCK','FLAK','MARKSMAN','SMG']);
  assert.equal(WEAPONS.length,10);
  assert.deepEqual(WEAPONS.map((_,id)=>id),[0,1,2,3,4,5,6,7,8,9]);
});

test('every weapon has a safe generic fire contract',()=>{
  for(const weapon of WEAPONS){
    for(const field of ['name','short','color'])assert.equal(typeof weapon[field],'string');
    for(const field of ['damage','interval','range','ammo','cap'])assert.ok(typeof weapon[field]==='number'&&weapon[field]>0,`${weapon.name}.${field}`);
    assert.match(weapon.color,color);
    assert.ok(weapon.pellets||weapon.speed||(!weapon.splash&&!weapon.radius),weapon.name);
    if(weapon.pellets){assert.ok(Number.isInteger(weapon.pellets)&&weapon.pellets>1);assert.ok(weapon.spread>0);}
    if(weapon.speed){assert.ok(weapon.splash>0&&weapon.radius>0);}
    if(weapon.life||weapon.gravity||weapon.bounce){assert.ok(weapon.life>0&&weapon.gravity>0&&weapon.bounce>=0);}
    if(weapon.feel)assert.equal(typeof weapon.feel,'object');
  }
});

test('new weapons occupy distinct, bounded combat niches',()=>{
  const [grenade,shock,flak]=WEAPONS.slice(5);
  assert.ok(grenade.speed&&grenade.radius>=3&&grenade.range<60);
  assert.ok(!shock.speed&&!shock.pellets&&shock.range>flak.range&&shock.range<grenade.range);
  assert.ok(flak.pellets>=10&&flak.range<=24&&flak.damage*flak.pellets<shock.damage*2);
  assert.ok(grenade.damage<WEAPONS[1].damage&&grenade.splash<WEAPONS[1].splash);
});

test('powerups have unique IDs, explicit effects, and no harness collision',()=>{
  assert.ok(POWERUPS.length>=3);
  const harnessIds=new Set(HARNESSES.map(h=>h.id));
  assert.equal(new Set(POWERUPS.map(p=>p.id)).size,POWERUPS.length);
  for(const powerup of POWERUPS){
    assert.equal(typeof powerup.id,'string');
    assert.equal(typeof powerup.name,'string');
    assert.ok(powerup.duration>0);
    assert.match(powerup.color,color);
    assert.equal(typeof powerup.description,'string');
    assert.ok(Object.keys(powerup.effect).length>0);
    for(const key of Object.keys(powerup.effect))assert.ok(effectKeys.has(key),key);
    assert.ok(!harnessIds.has(powerup.id),powerup.id);
  }
});
