import assert from 'node:assert/strict';
import test from 'node:test';
import {Match, floorAt, obstructed} from './core.mjs';
import {GUNTRUCK} from './vehicles.mjs';

const match=()=>new Match('chatgpt','openclaw',()=>.5,'blood-gulch',{mode:'ctf',botCount:0,respawn:1});

test('Blood Gulch matches clone supported polygon terrain and both Pumas',()=>{
  const a=match(),b=match();
  assert.equal(a.vehicles.length,2);
  assert.notEqual(a.vehicles,b.vehicles);
  assert.ok(floorAt(0,0,a.arena)>5&&floorAt(0,0,a.arena)<8);
  assert.ok(floorAt(0,-19,a.arena)>1&&floorAt(0,-19,a.arena)<1.5);
  assert.equal(a.vehicles[0].position.y,0);
  a.vehicles[0].position.x=-20;
  assert.equal(b.vehicles[0].position.x,-46);
  assert.equal(b.vehicles[1].position.x,46);
});

test('Puma enter, drive, paired chainguns, turret tracking and exit remain authoritative',()=>{
  const m=match(),a=m.actors[0];
  Object.assign(a,{x:-46,y:0,z:0,yaw:Math.PI/2,pitch:0,grounded:true,protection:0});
  m.step(1/60,{inputs:{0:{interact:true}}});
  assert.equal(a.vehicleId,m.vehicles[0].id);
  for(let i=0;i<60;i++)m.step(1/60,{inputs:{0:{x:1,z:0,yaw:-Math.PI/2,pitch:0,fire:true}}});
  assert.ok(a.x>-42);
  assert.ok(m.vehicles[0].heat>0);
  assert.equal(m.events.filter(e=>e.type==='vehicle-shot').length,16);
  assert.ok(m.vehicles[0].turretYaw>=-1e-9&&m.vehicles[0].turretYaw<=1e-9);
  const snapshot=m.snapshot().vehicles[0];
  assert.ok(Number.isFinite(snapshot.turretYaw)&&Number.isFinite(snapshot.roll)&&Number.isFinite(snapshot.pitchBody));
  m.step(1/60,{inputs:{0:{interact:true}}});
  assert.equal(a.vehicleId,null);
  assert.equal(m.vehicles[0].driver,null);
});

test('Puma chainguns resolve an actor hit through the authoritative ray path',()=>{
  const m=new Match('chatgpt','openclaw',()=>.5,'blood-gulch',{mode:'ctf',botCount:1});
  const [a,target]=m.actors;
  Object.assign(a,{x:-46,y:0,z:0,yaw:-Math.PI/2,pitch:0,grounded:true,protection:0});
  Object.assign(target,{x:-40,y:0,z:0.82,health:100,armor:0,protection:0,grounded:true});
  m.step(1/60,{inputs:{0:{interact:true}}});
  for(let i=0;i<12;i++)m.step(1/60,{inputs:{0:{x:0,z:0,yaw:-Math.PI/2,pitch:0,fire:true}}});
  assert.ok(target.health<100);
  assert.ok(m.events.some(event=>event.type==='vehicle-shot'&&event.hit===target.id));
});

test('a moving Puma runs over and splatters a grounded non-occupant',()=>{
  const m=new Match('chatgpt','openclaw',()=>.5,'blood-gulch',{mode:'deathmatch',botCount:1,respawn:5});
  const [a,target]=m.actors;
  Object.assign(a,{x:-46,y:0,z:0,yaw:Math.PI/2,pitch:0,grounded:true,protection:0});
  Object.assign(target,{x:-38,y:0,z:0,health:100,armor:0,protection:0,grounded:true,bot:null});
  m.step(1/60,{inputs:{0:{interact:true}}});
  for(let i=0;i<120&&target.health>0;i++)m.step(1/60,{inputs:{0:{x:1,z:0,yaw:-Math.PI/2,pitch:0}}});
  assert.ok(target.health<100);
  assert.ok(m.events.some(e=>e.type==='vehicle-splatter'&&e.actor===target.id));
});

test('Puma damage releases its driver and respawns from its authored slot',()=>{
  const m=match(),a=m.actors[0],vehicle=m.vehicles[0];
  Object.assign(a,{x:-46,y:0,z:0,yaw:Math.PI/2,pitch:0,grounded:true,protection:0});
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

test('Pumas can leave both garages, cross either valley lane, and exit safely',()=>{
  for(const side of [-1,1])for(const lane of [-1,1]){
    const m=match(),a=m.actors[0],vehicle=m.vehicles[side<0?0:1];
    Object.assign(a,{x:side*46,y:0,z:0,grounded:true});
    assert.ok(m.enterVehicle(a));
    for(const [axis,target,direction] of [['z',lane*8,lane],['x',-side*20,-side],['z',0,-lane]]){
      vehicle.heading=axis==='x'?direction*Math.PI/2:direction>0?0:Math.PI;
      vehicle.velocity.x=vehicle.velocity.z=0;
      a.yaw=vehicle.heading-Math.PI;
      let frames=0;
      while(direction*(target-vehicle.position[axis])>.12&&frames++<600)m.driveVehicle(a,{[axis]:direction},1/60);
      assert.ok(frames<600,`route ${side}/${lane} stalled on ${axis}`);
    }
    assert.ok(Math.abs(vehicle.position.x+side*20)<.8,`route ${side}/${lane} crossing`);
    assert.ok(m.releaseVehicle(a));
    assert.equal(a.vehicleId,null);
    assert.equal(a.y,floorAt(a.x,a.z,m.arena));
    assert.ok(!obstructed(a.x,a.y,a.z,.52,m.arena));
  }
});
