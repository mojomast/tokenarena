import assert from 'node:assert/strict';
import test from 'node:test';
import {Room} from './room.mjs';
import {floorAt,obstructed} from '../game/core.mjs';

test('Room forwards Puma interaction as a one-shot authoritative edge',()=>{
  const room=new Room('test',()=>.5);
  room.join('peer','Driver','chatgpt','openclaw');
  room.host('peer',{mode:'ctf',botCount:0,respawn:1},'blood-gulch');
  room.start('peer');
  const actor=room.match.actors[0];
  Object.assign(actor,{x:-28.5,y:0,z:0,yaw:Math.PI/2,protection:0});
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
    assert.equal(y,0);
    assert.ok(!obstructed(p.x,y,p.z,.65,arena));
  }
  assert.equal(vehicles.length,2);
  assert.ok(vehicles.every(vehicle=>vehicle.position.y===floorAt(vehicle.position.x,vehicle.position.z,arena)));
});
