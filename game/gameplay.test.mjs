import test from 'node:test';
import assert from 'node:assert/strict';
import {Match,moveActor,obstructed,floorAt} from './core.mjs';
import {MAPS} from './maps.mjs';
import {RULES} from './data.mjs';
import {DEFAULT_CONFIG,normalizeConfig} from './config.mjs';
const rng=()=>{let n=42;return()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);};
const actor=(arena,values={})=>Object.assign(new Match('chatgpt','hermes',rng(),arena.id,{botCount:0}).actors[0],{vx:0,vy:0,vz:0,active:0,grounded:false},values);
const clear=(a,arena)=>assert.equal(obstructed(a.x,a.y,a.z,RULES.radius,arena),false,`${arena.id}: ${JSON.stringify({x:a.x,y:a.y,z:a.z})}`);

test('casual defaults preserve explicit saved difficulty and roster',()=>{
 assert.equal(DEFAULT_CONFIG.botCount,2);assert.equal(DEFAULT_CONFIG.difficulty,'easy');
 assert.deepEqual(normalizeConfig(),DEFAULT_CONFIG);
 assert.equal(new Match().actors.length,3);
 const saved=normalizeConfig(JSON.parse('{"botCount":4,"difficulty":"normal"}'));
 assert.equal(saved.botCount,4);assert.equal(saved.difficulty,'normal');
});

for(const arena of MAPS)for(const gravity of [1,.4])test(`${arena.id} gravity ${gravity}: solid landings, edges, recovery and turbo collision`,()=>{
 const config={speed:1.5,gravity};
 for(const b of arena.blocks.filter(b=>b.kind==='cover')){
  for(const offset of [0,b.w/2+RULES.radius-.01]){
   const a=actor(arena,{x:b.x+offset,z:b.z,y:b.h+.1,vy:-40});
   moveActor(a,{},1/30,arena,config);assert.equal(a.y,b.h);assert.equal(a.grounded,true);clear(a,arena);
   for(let i=0;i<20;i++)moveActor(a,{},1/60,arena,config);
   assert.equal(a.y,b.h);
  }
  const a=actor(arena,{x:b.x,z:b.z,y:b.h-.1,vy:-3});
  moveActor(a,{},1/60,arena,config);assert.equal(a.y,b.h);clear(a,arena);
  Object.assign(a,{x:b.x,z:b.z,y:0});moveActor(a,{},1/60,arena,config);clear(a,arena);assert.equal(a.y,0);
  Object.assign(a,{x:b.x,z:b.z+b.d/2+RULES.radius+.05,y:b.h-.05,vz:-60,vy:0,active:3});
  moveActor(a,{z:-1},1/30,arena,config);clear(a,arena);assert.ok(a.z>=b.z+b.d/2+RULES.radius);
  Object.assign(a,{x:b.x,z:b.z,y:b.h,vx:0,vy:0,vz:0,grounded:true});
  for(let i=0;i<90;i++){moveActor(a,{z:1},1/60,arena,config);clear(a,arena);}
  assert.ok(a.y<b.h);assert.equal(a.y,floorAt(a.x,a.z,arena));
 }
});

 for(const arena of MAPS.filter(m=>m.raised&&!m.bounds))test(`${arena.id}: both ramps ascend, descend and accept low-gravity turbo landings`,()=>{
 for(const x of [-11,11])for(const gravity of [1,.4]){
  const config={speed:1.5,gravity},a=actor(arena,{x,z:7,y:0,grounded:true,active:3});
  for(let i=0;i<90;i++){moveActor(a,{z:-1},1/60,arena,config);clear(a,arena);}
  assert.equal(a.y,3.8);assert.ok(a.z<-9);
  for(let i=0;i<100;i++){moveActor(a,{z:1},1/60,arena,config);clear(a,arena);assert.equal(a.grounded,true);}
  assert.equal(a.y,0);
  Object.assign(a,{x,z:-3,y:5,vy:-30,vx:0,vz:0,grounded:false});
  for(let i=0;i<30;i++)moveActor(a,{},1/60,arena,config);
  assert.equal(a.y,floorAt(a.x,a.z,arena));assert.equal(a.grounded,true);clear(a,arena);
 }
});

test('low-gravity turbo jump crosses onto cover without embedding',()=>{
 for(const arena of MAPS){
  const b=arena.blocks.find(b=>b.kind==='cover'),a=actor(arena,{x:b.x,z:b.z+b.d/2+2,y:0,grounded:true});
  let landed=false;
  for(let i=0;i<240;i++){
   const z=a.y>b.h&&a.z>b.z+.6? -.35:0;
   moveActor(a,{z,jump:i===0},1/60,arena,{speed:1.5,gravity:.4});clear(a,arena);
   if(a.grounded&&a.y===b.h){landed=true;break;}
  }
  assert.ok(landed,arena.id);
 }
});

test('remembered targets require a new reaction after cover and turning is bounded',()=>{
 const m=new Match('chatgpt','hermes',rng(),'crosswire',{botCount:1,difficulty:'easy'}),[p,b]=m.actors;
 Object.assign(b,{x:0,y:0,z:8,yaw:Math.PI,pitch:0,protection:0,cooldown:100,shotWait:0});
 Object.assign(p,{x:0,y:0,z:4,protection:0});
 m.botInput(b,1/60);assert.ok(Math.abs(b.yaw-Math.PI)<=2.5/60+1e-9);
 b.bot.reaction=0;b.bot.think=1;
 Object.assign(p,{z:-4});m.botInput(b,1/60);assert.equal(b.bot.tracking,false);assert.equal(b.shots,0);
 assert.equal(b.bot.seen.z,4);
 Object.assign(p,{z:4});m.botInput(b,1/60);assert.ok(b.bot.reaction>=1.2);assert.equal(b.shots,0);
});

test('identical seeded firing lanes give easy opponents lower damage and longer survival',()=>{
 const run=difficulty=>{
  const m=new Match('chatgpt','hermes',rng(),'crosswire',{botCount:1,difficulty}),[p,b]=m.actors;
  Object.assign(p,{x:0,y:0,z:12,armor:0,protection:0});
  Object.assign(b,{x:0,y:0,z:4,yaw:Math.PI,pitch:0,cooldown:100,shotWait:0});
  let damage=0,death=Infinity;
  for(let i=0;i<1200;i++){
   m.time+=1/60;b.shotWait=Math.max(0,b.shotWait-1/60);m.botInput(b,1/60);
   damage+=100-p.health;if(p.health<=0&&death===Infinity)death=m.time;p.health=100;
   if(damage>=100&&death===Infinity)death=m.time;
  }
  return {damage,death,shots:b.shots};
 };
 const easy=run('easy'),normal=run('normal'),hard=run('hard');
 assert.ok(easy.damage<normal.damage,JSON.stringify({easy,normal}));
 assert.ok(normal.damage<hard.damage,JSON.stringify({normal,hard}));
 assert.ok(easy.death>normal.death);assert.ok(normal.death>hard.death);
 assert.ok(easy.shots<normal.shots);assert.ok(normal.shots<hard.shots);
 console.log('Seeded 20-second firing lane:',{easy,normal,hard});
});

test('matches share frozen map navigation but not mutable match state',()=>{
 for(const arena of MAPS){
  const a=new Match('chatgpt','hermes',rng(),arena.id),b=new Match('chatgpt','hermes',rng(),arena.id);
  assert.equal(a.nav,b.nav);assert.equal(a.edges,b.edges);assert.ok(Object.isFrozen(a.nav[0]));assert.ok(Object.isFrozen(a.edges[0]));
  assert.notEqual(a.pickups,b.pickups);assert.notEqual(a.actors[1].bot.route,b.actors[1].bot.route);
 }
});
