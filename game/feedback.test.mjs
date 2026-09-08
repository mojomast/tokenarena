import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {WeaponFeedback,EffectPool,SynthAudio} from './feedback.mjs';

const player={id:7,weapon:0,x:0,z:0,yaw:0,grounded:true,vx:0,vy:0,vz:0};
test('weapon kicks are distinct, bounded, pellet-deduplicated and recover exponentially',()=>{
 const poses=[];
  for(let weapon=0;weapon<8;weapon++){const f=new WeaponFeedback(),p={...player,weapon};f.shot(weapon,1);f.shot(weapon,1);assert.equal(f.kick,1);poses.push(f.update(p,0).z);for(let i=0;i<100;i++)f.shot(weapon,i+2);assert.equal(f.kick,1.4);let last=f.update(p,0).z;for(let i=0;i<120;i++){const pose=f.update(p,1/60);assert.ok(pose.z<=last);last=pose.z;}assert.ok(last<1e-8);}
  assert.equal(new Set(poses).size,8);
 const a=new WeaponFeedback(),b=new WeaponFeedback();a.shot(0,1);b.shot(0,1);a.update(player,.1);for(let i=0;i<6;i++)b.update(player,1/60);assert.ok(Math.abs(a.kick-b.kick)<1e-12);
});
test('motion is presentation-only, disabled for hidden/reduced weapons, with bounded landing',()=>{
 const f=new WeaponFeedback(),p={...player,vx:7,vy:-12,grounded:false},copy={...p};f.update(p,.016);assert.deepEqual(p,copy);
 const landed=f.update({...p,grounded:true,vy:0},.016);assert.ok(landed.y<0&&landed.y>-.05);
 for(const [reduced,visible] of [[true,true],[false,false]]){f.shot(0,2);assert.deepEqual(f.update(player,.016,reduced,visible),{x:0,y:0,z:0,pitch:0,roll:0});}
 f.shot(0,3);assert.equal(f.update({...player,weapon:1},0).z,0);
});
test('effect slots reuse resources, retain endpoints, expire and dispose once',()=>{
 const scene=new T.Scene(),pool=new EffectPool(scene,12),from=new T.Vector3(1,2,3),to=new T.Vector3(4,6,-2);
 const line=pool.add({from,to,color:'#ffffff'});line.updateMatrixWorld();assert.ok(new T.Vector3(0,0,1).applyMatrix4(line.matrixWorld).distanceTo(to)<1e-10);
 for(let i=0;i<1000;i++)pool.add(i%2?{from,to,color:'#ff0000'}:{pos:to,color:'#ffffff'});
 assert.equal(scene.children.length,12);assert.equal(pool.slots.length,12);assert.equal(new Set(pool.slots.map(s=>s.obj.geometry)).size,2);
 const resources=[pool.line,pool.sphere,...pool.slots.map(s=>s.obj.material)],counts=resources.map(()=>0);resources.forEach((r,i)=>r.addEventListener('dispose',()=>counts[i]++));
 pool.update(1);assert.ok(pool.slots.every(s=>!s.active&&!s.obj.visible));pool.add({from,to,color:'#ffffff'});assert.equal(pool.slots.length,12);pool.clear();assert.ok(pool.slots.every(s=>!s.active));pool.dispose();assert.equal(scene.children.length,0);assert.ok(counts.every(n=>n===1));
});
function audioFixture(){const audio=new SynthAudio(),nodes=[];const param=()=>({setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});const node=()=>{const n={frequency:param(),gain:param(),connect(){},disconnect(){this.disconnected=true;},start(){},stop(){}};nodes.push(n);return n;};audio.ctx={currentTime:1,destination:{},createOscillator:node,createGain:node,close(){this.closed=true;}};return {audio,nodes};}
test('audio uses passed player identity, distinct reports and one report per pellet burst',()=>{
 const audio=new SynthAudio(),calls=[];audio.tone=(...args)=>calls.push(args);
  for(let weapon=0;weapon<8;weapon++)audio.event({type:'shot',actor:7,weapon,time:weapon,from:{x:100,z:100}},player);
  assert.equal(calls.length,8);assert.equal(new Set(calls.map(c=>c[0])).size,8);assert.ok(calls.every(c=>c[3]===.032));
  audio.event({type:'shot',actor:7,weapon:7,time:7},player);assert.equal(calls.length,8);
  audio.event({type:'shot',actor:0,weapon:0,time:8,from:{x:100,z:100}},player);assert.equal(calls.length,8);
  audio.event({type:'pickup',actor:0},player);assert.equal(calls.length,8);audio.event({type:'pickup',actor:7},player);assert.equal(calls.length,9);
  audio.event({type:'shot',actor:0,weapon:0,time:9,from:{x:0,z:0},pos:{x:100,z:100}},player);assert.equal(calls.length,10);assert.ok(calls.at(-1)[3]<.032);
  audio.event({type:'dryfire',actor:7,weapon:2},player);assert.equal(calls.length,11);
 });
test('actual local damage and adjacent lethal damage produce hit/kill feedback, not hit flags',()=>{
 const {audio}=audioFixture(),calls=[];audio.tone=(...args)=>calls.push(args);
 audio.event({type:'shot',actor:0,weapon:0,hit:{id:1},from:{x:100,z:100}},player);assert.equal(calls.length,0);
 audio.event({type:'damage',id:1,time:2,actor:0,source:7,amount:20},player);assert.equal(calls.at(-1)[0],1050);
 audio.event({type:'death',id:2,time:2,actor:0},player);assert.equal(calls.at(-1)[0],1500);
 const count=calls.length;audio.event({type:'death',id:3,time:2,actor:1},player);assert.equal(calls.length,count);
 audio.event({type:'damage',id:4,time:2,actor:1,source:0,amount:20},player);audio.event({type:'death',id:5,time:2,actor:1},player);assert.equal(calls.length,count);
 audio.event({type:'damage',actor:7,source:7,amount:20},player);assert.equal(calls.at(-1)[0],120);
});
test('audio voices are capped, disconnected on end/disposal, and muted without allocation',()=>{
 const {audio,nodes}=audioFixture();audio.muted=true;audio.tone(100);assert.equal(nodes.length,0);audio.muted=false;
 for(let i=0;i<100;i++)audio.tone(100);assert.equal(audio.voices.size,24);assert.equal(nodes.length,48);
 nodes[0].onended();assert.equal(audio.voices.size,23);assert.ok(nodes[0].disconnected&&nodes[1].disconnected);audio.tone(200);assert.equal(audio.voices.size,24);
 const ctx=audio.ctx;audio.dispose();assert.equal(audio.voices.size,0);assert.ok(ctx.closed);assert.ok(nodes.every(n=>n.disconnected));
});
