import assert from 'node:assert/strict';
import test from 'node:test';
import {Match} from './core.mjs';

test('zero-length and malformed gameplay rays fail safely',()=>{
  const match=new Match('chatgpt','openclaw',()=>.5,'blood-gulch',{mode:'ctf',botCount:0});
  const point={x:0,y:1,z:0};
  assert.equal(match.visible(point,point),true);
  assert.equal(match.visible({x:NaN,y:1,z:0},point),false);
  assert.equal(match.rayWorld({x:NaN,y:1,z:0},{x:0,y:0,z:-1},20),0);
  assert.equal(match.rayWorld(point,{x:0,y:0,z:0},20),0);
  assert.equal(match.fire(match.actors[0],{x:NaN,y:0,z:-1}),false);
});

test('vehicle-centered explosions do not throw on visibility checks',()=>{
  const match=new Match('chatgpt','openclaw',()=>.5,'blood-gulch',{mode:'ctf',botCount:0});
  const vehicle=match.vehicles[0];
  assert.doesNotThrow(()=>match.explode({owner:0,weapon:1,pos:{...vehicle.position}}));
});
