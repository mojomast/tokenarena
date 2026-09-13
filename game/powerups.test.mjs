import test from 'node:test';
import assert from 'node:assert/strict';
import {Match, floorAt, obstructed} from './core.mjs';
import {POWERUPS, WEAPONS} from './data.mjs';
import {MAPS, pickupWeapon} from './maps.mjs';
import {normalizeConfig, spawnInventory} from './config.mjs';

const rng=()=>{let n=17;return()=>((n=Math.imul(n,1664525)+1013904223>>>0)/4294967296);};
const quiet=(options={})=>new Match('chatgpt','openclaw',rng(),'crosswire',{botCount:1,...options});

test('current weapons use ten inventory slots and map every pickup',()=>{
  assert.equal(spawnInventory(normalizeConfig({startingWeapon:99})).length,10);
  assert.deepEqual(['grenade','shock','flak','marksman','smg'].map(pickupWeapon),[5,6,7,8,9]);
  const m=quiet();
  for(const [kind,index] of [['grenade',5],['shock',6],['flak',7],['marksman',8],['smg',9]]){const a=m.actors[0],p={kind,x:a.x,z:a.z,y:a.y,wait:0};assert.equal(m.collect(a,p),true);assert.ok(a.ammo[index]>0);}
});

test('powerups apply, refresh without stacking, expire, and reset on respawn',()=>{
  const m=quiet(),a=m.actors[0],p={kind:'haste',x:a.x,z:a.z,y:a.y,wait:0};
  assert.equal(m.collect(a,p),true);assert.equal(a.speedMultiplier,1.35);assert.equal(a.cooldownMultiplier,.7);const first=a.powerups.haste;
  assert.equal(m.collect(a,p),true);assert.equal(a.powerups.haste,first);
  for(let i=0;i<361;i++)m.step(1/60);assert.equal(a.powerups.haste,undefined);assert.equal(a.speedMultiplier,1);
  p.kind='overcharge';m.collect(a,p);assert.equal(a.damageMultiplier,1.35);a.health=0;a.dead=0;m.step(1/60);assert.equal(a.damageMultiplier,1);
});

test('overshield absorbs before armor and health and expires deterministically',()=>{
 const m=quiet(),[a,b]=m.actors;a.protection=0;b.protection=0;
 m.collect(a,{kind:'overshield',x:a.x,z:a.z,y:a.y,wait:0});a.armor=20;assert.equal(m.damage(a,50,b),50);assert.equal(a.temporaryShield,10);assert.equal(a.armor,20);assert.equal(a.health,100);
 for(let i=0;i<481;i++)m.step(1/60);assert.equal(a.temporaryShield,0);a.health=0;a.dead=0;m.step(1/60);assert.equal(a.temporaryShield,0);
});

test('unrelated powerups never refill a depleted overshield',()=>{
 const m=quiet(),[a,b]=m.actors;a.protection=0;b.protection=0;
 m.collect(a,{kind:'overshield',x:a.x,z:a.z,y:a.y,wait:0});assert.equal(a.temporaryShield,60);
 m.damage(a,50,b);assert.equal(a.temporaryShield,10);
 m.collect(a,{kind:'haste',x:a.x,z:a.z,y:a.y,wait:0});assert.equal(a.speedMultiplier,1.35);
 assert.equal(a.temporaryShield,10,'collecting haste must not refill overshield');
 m.refreshPowerups(a);assert.equal(a.temporaryShield,10,'recomputing multipliers must not refill overshield');
 a.powerups.haste=.001;m.step(1/60);
 assert.equal(a.powerups.haste,undefined);assert.equal(a.temporaryShield,10,'haste expiry must not refill overshield');
 m.collect(a,{kind:'overshield',x:a.x,z:a.z,y:a.y,wait:0});assert.equal(a.temporaryShield,60,'collecting overshield again refreshes it');
 a.powerups.overshield=.001;m.step(1/60);
 assert.equal(a.temporaryShield,0,'overshield expiry clears the shield');
});


test('red and blue CTF metadata normalizes into numeric teams',()=>{
  const m=new Match('chatgpt','openclaw',rng(),'launchpad',{mode:'ctf',botCount:0});
  assert.ok(m.teamSpawns[0].length&&m.teamSpawns[1].length);assert.equal(m.flags[0].x,-20);assert.equal(m.flags[1].x,20);
});

test('expansion map floors, traversal routes and pickups are safe',()=>{
  for(const map of MAPS.filter(m=>['launchpad','citadel'].includes(m.id))){assert.equal(floorAt(0,map.id==='launchpad'?-11:8,map),0);if(map.id==='launchpad')assert.ok(map.traversal);for(const [kind,x,z] of map.pickups)assert.equal(obstructed(x,floorAt(x,z,map),z,.42,map),false,`${map.id}:${kind}`);}
});

test('new projectile weapons fire and explode with source overcharge',()=>{
  const m=quiet(),[a,b]=m.actors;a.bot=b.bot=null;a.protection=b.protection=0;Object.assign(a,{x:-10,y:0,z:3,weapon:5,ammo:Array(WEAPONS.length).fill(0),yaw:0,pitch:0,shotWait:0});a.ammo[5]=1;b.health=100;Object.assign(b,{x:-10,y:0,z:-3});a.damageMultiplier=1.35;m.fire(a);assert.equal(a.ammo[5],0);for(let i=0;i<200;i++)m.step(1/60);assert.ok(m.events.some(e=>e.type==='explosion'&&e.weapon===5));assert.ok(b.health<100);
});

test('instagib and rocket locks keep their original mode invariants',()=>{
  const i=quiet({mode:'instagib'}),r=quiet({mode:'rockets'});assert.equal(i.actors[0].weapon,2);assert.equal(i.pickups.length,0);assert.equal(r.actors[0].weapon,1);assert.ok(r.actors[0].ammo.every((n,index)=>index===1?n===Infinity:n===0));assert.equal(POWERUPS.length,4);assert.equal(WEAPONS.length,10);
});

test('the recon pickup applies a timed reveal effect',()=>{
 const m=quiet(),a=m.actors[0];
 assert.equal(m.collect(a,{kind:'recon',x:a.x,z:a.z,y:a.y,wait:0}),true);
 assert.ok(a.powerups.recon>0);
 for(let i=0;i<601;i++)m.step(1/60);
 assert.equal(a.powerups.recon,undefined);
});
