import assert from 'node:assert/strict';
import test from 'node:test';
import {Match, floorAt} from './core.mjs';
import {GUNTRUCK} from './vehicles.mjs';

const match=()=>new Match('chatgpt','openclaw',()=>.5,'blood-gulch',{mode:'ctf',botCount:0,respawn:1});

test('Blood Gulch matches clone supported polygon terrain and both Pumas',()=>{
  const a=match(),b=match();
  assert.equal(a.vehicles.length,2);
  assert.notEqual(a.vehicles,b.vehicles);
  assert.equal(floorAt(0,0,a.arena),0);
  assert.equal(floorAt(0,-13,a.arena),2.5);
  assert.equal(a.vehicles[0].position.y,0);
  a.vehicles[0].position.x=-20;
  assert.equal(b.vehicles[0].position.x,-29);
});

test('Puma enter, drive, paired chainguns, and exit remain authoritative',()=>{
  const m=match(),a=m.actors[0];
  Object.assign(a,{x:-27,y:0,z:0,yaw:Math.PI/2,pitch:0,grounded:true,protection:0});
  m.step(1/60,{inputs:{0:{interact:true}}});
  assert.equal(a.vehicleId,m.vehicles[0].id);
  for(let i=0;i<60;i++)m.step(1/60,{inputs:{0:{x:-1,z:0,yaw:Math.PI/2,pitch:0,fire:true}}});
  assert.ok(a.x>-29);
  assert.ok(m.vehicles[0].heat>0);
  assert.equal(m.events.filter(e=>e.type==='vehicle-shot').length,16);
  m.step(1/60,{inputs:{0:{interact:true}}});
  assert.equal(a.vehicleId,null);
  assert.equal(m.vehicles[0].driver,null);
});

test('Puma chainguns resolve an actor hit through the authoritative ray path',()=>{
  const m=new Match('chatgpt','openclaw',()=>.5,'blood-gulch',{mode:'ctf',botCount:1});
  const [a,target]=m.actors;
  Object.assign(a,{x:-27,y:0,z:0,yaw:Math.PI/2,pitch:0,grounded:true,protection:0});
  Object.assign(target,{x:-31,y:0,z:0,health:100,armor:0,protection:0,grounded:true});
  m.step(1/60,{inputs:{0:{interact:true}}});
  for(let i=0;i<12;i++)m.step(1/60,{inputs:{0:{x:0,z:0,yaw:Math.PI/2,pitch:0,fire:true}}});
  assert.ok(target.health<100);
  assert.ok(m.events.some(event=>event.type==='vehicle-shot'&&event.hit===target.id));
});

test('Puma damage releases its driver and respawns from its authored slot',()=>{
  const m=match(),a=m.actors[0],vehicle=m.vehicles[0];
  Object.assign(a,{x:-27,y:0,z:0,yaw:Math.PI/2,pitch:0,grounded:true,protection:0});
  m.step(1/60,{inputs:{0:{interact:true}}});
  assert.equal(vehicle.driver,a.id);
  m.damageVehicle(vehicle,vehicle.maxHealth,a);
  assert.equal(vehicle.health,0);
  assert.equal(a.vehicleId,null);
  for(let i=0;i<Math.ceil(GUNTRUCK.respawn/(1/60))+1;i++)m.step(1/60);
  assert.equal(vehicle.health,vehicle.maxHealth);
  assert.deepEqual(vehicle.position,vehicle.spawn);
  assert.ok(m.events.some(e=>e.type==='vehicle-respawn'));
});
