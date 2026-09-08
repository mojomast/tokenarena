import assert from 'node:assert/strict';
import test from 'node:test';
import {Room} from './room.mjs';

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
});
