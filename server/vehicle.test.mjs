import assert from 'node:assert/strict';
import test from 'node:test';
import {Room} from './room.mjs';
import {floorAt,obstructed} from '../game/core.mjs';

test('Room forwards Puma interaction as a one-shot authoritative edge',()=>{
  const room=new Room('test',()=>.5);
  room.join('peer','Driver','chatgpt','openclaw');
  room.host('peer',{mode:'ctf',botCount:0,respawn:1},'blood-gulch');
  room.start('peer');
  const actor=room.match.actors[0],vehicle=room.match.vehicles[0];
  Object.assign(actor,{x:vehicle.position.x,y:vehicle.position.y,z:vehicle.position.z,yaw:vehicle.heading-Math.PI,protection:0});
  room.input('peer',{seq:1,x:0,z:0,interact:true});
  room.tick(1/60);
  assert.ok(actor.vehicleId);
  room.input('peer',{seq:2,x:0,z:0,interact:true});
  room.tick(1/60);
  assert.ok(actor.vehicleId,'held interact does not toggle twice');
  room.input('peer',{seq:3,x:0,z:0,interact:false});
  room.tick(1/60);
  room.input('peer',{seq:4,x:0,z:0,interact:true});
  room.tick(1/60);
  assert.equal(actor.vehicleId,null);
  assert.equal(actor.y,floorAt(actor.x,actor.z,room.match.arena));
  assert.ok(!obstructed(actor.x,actor.y,actor.z,.52,room.match.arena));
});

test('Room drives the arcade Puma and exposes its deterministic dynamics fields',()=>{
  const room=new Room('puma-dynamics',()=>.5);
  room.join('peer','Driver','chatgpt','openclaw');
  room.host('peer',{mode:'ctf',botCount:0,respawn:1},'blood-gulch');
  room.start('peer');
  const vehicle=room.match.vehicles[0];
  for(const field of ['turretYaw','roll','pitchBody','speed'])assert.equal(vehicle[field],0);
  assert.equal(vehicle.grounded,true);
  assert.equal(vehicle.handbrake,false);
  const actor=room.match.actors[0];
  Object.assign(actor,{x:vehicle.position.x,y:vehicle.position.y,z:vehicle.position.z,yaw:vehicle.heading-Math.PI,protection:0});
  room.input('peer',{seq:1,x:0,z:0,interact:true});
  room.tick(1/60);
  assert.equal(actor.vehicleId,vehicle.id);
  room.input('peer',{seq:2,x:1,z:0,interact:false});
  for(let i=0;i<30;i++)room.tick(1/60);
  assert.ok(vehicle.speed>0,'driving builds forward speed');
  assert.ok(vehicle.position.x>vehicle.spawn.x,'Puma advances along its heading');
  assert.ok([vehicle.turretYaw,vehicle.roll,vehicle.pitchBody].every(Number.isFinite));
  assert.ok(room.match.releaseVehicle(actor));
  assert.equal(actor.vehicleId,null);
});

test('Blood Gulch room starts with accessible flags and safe bunker-side team spawns',()=>{
  const room=new Room('gulch-spawns',()=>.5);
  room.join('red','Red','chatgpt','openclaw');
  room.join('blue','Blue','chatgpt','openclaw');
  room.host('red',{mode:'ctf',botCount:0},'blood-gulch');
  room.start('red');
  const {arena,actors,flags,vehicles}=room.match;
  assert.equal(actors.length,2);
  for(const p of [...actors,...Object.values(flags)]){
    const y=floorAt(p.x,p.z,arena);
    assert.notEqual(y,null);
    assert.ok(!obstructed(p.x,y,p.z,.65,arena));
  }
  assert.equal(vehicles.length,2);
  assert.ok(vehicles.every(vehicle=>vehicle.position.y===floorAt(vehicle.position.x,vehicle.position.z,arena)));
  assert.ok(vehicles.every(vehicle=>!obstructed(vehicle.position.x,vehicle.position.y,vehicle.position.z,.9,arena)));
});
