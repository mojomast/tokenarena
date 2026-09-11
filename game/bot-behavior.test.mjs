import test from 'node:test';
import assert from 'node:assert/strict';
import {Match, blastUnsafe} from './core.mjs';
import {WEAPONS} from './data.mjs';
import {botBehaviorKey} from './bot-personalities.mjs';

const seeded=()=>{let n=20240910;return()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);};

function clustering(match,frames=3600){
 let sum=0,peak=0,samples=0;
 for(let i=0;i<frames;i++){
  match.step(1/60);
  if(i%30===0&&match.time>5){
   samples++;
   let framePeak=0;
   for(const a of match.actors){
    let near=0;
    for(const b of match.actors)if(a!==b&&Math.hypot(a.x-b.x,a.z-b.z)<2)near++;
    framePeak=Math.max(framePeak,near);
   }
   peak=Math.max(peak,framePeak);sum+=framePeak;
  }
 }
 return {avg:samples?sum/samples:0,peak};
}

test('a seven-bot match fields varied personalities and keeps bots from stacking',()=>{
 const m=new Match('chatgpt','openclaw',seeded(),'exchange',{mode:'deathmatch',botCount:7,difficulty:'normal',timeLimit:120,fragLimit:40});
 const behaviors=m.actors.filter(a=>a.bot).map(a=>botBehaviorKey(a));
 assert.ok(new Set(behaviors).size>=5,`expected varied behaviors, got ${new Set(behaviors).size}`);
 const {avg,peak}=clustering(m);
 assert.ok(avg<1.6,`bots should not pile up (avg near-neighbors ${avg.toFixed(2)})`);
 assert.ok(peak<=4,`peak stacking too high (${peak})`);
 assert.ok(m.stats.shots>100,`bots should fight (${m.stats.shots} shots)`);
 assert.ok(m.stats.kills>5,`bots should trade kills (${m.stats.kills})`);
});

test('slots around an objective spread a capturing team instead of one point',()=>{
 const m=new Match('chatgpt','openclaw',seeded(),'exchange',{mode:'koth',botCount:6,difficulty:'normal',timeLimit:120});
 const zone=m.objectiveState.zones[0];
 const points=m.actors.filter(a=>a.bot).map(a=>m.zoneSlot(a,zone,a.team));
 const unique=new Set(points.map(p=>`${Math.round(p.x*4)}:${Math.round(p.z*4)}`));
 assert.ok(unique.size>=4,`expected spread objective slots, got ${unique.size}`);
 for(const p of points)assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.z)&&Number.isFinite(p.y));
});

test('contested control decays so a lone holder cannot keep the hill',()=>{
 const m=new Match('chatgpt','openclaw',seeded(),'exchange',{mode:'koth',botCount:1,difficulty:'normal',timeLimit:600});
 const zone=m.objectiveState.zones[0];
 zone.owner=0;zone.progress=100;zone.captureTeam=null;
 const holder=m.actors.find(a=>a.team===0),challenger=m.actors.find(a=>a.team===1);
 for(let i=0;i<180;i++){
  Object.assign(holder,{x:zone.x,z:zone.z,y:zone.y,health:100,dead:0,protection:0});
  Object.assign(challenger,{x:zone.x+.2,z:zone.z+.1,y:zone.y,health:100,dead:0,protection:0});
  m.updateObjectives(1/60);
 }
 assert.ok(zone.contested,'zone should be contested');
 assert.ok(zone.progress<100,`contested progress should decay (${zone.progress})`);
});

test('an uncontested owner still scores and holds the hill',()=>{
 const m=new Match('chatgpt','openclaw',seeded(),'exchange',{mode:'koth',botCount:1,difficulty:'normal',timeLimit:600});
 const zone=m.objectiveState.zones[0];
 zone.owner=0;zone.progress=100;zone.captureTeam=null;
 const holder=m.actors.find(a=>a.team===0),other=m.actors.find(a=>a.team===1);
 const before=m.teamScores[0];
 for(let i=0;i<180;i++){
  Object.assign(holder,{x:zone.x,z:zone.z,y:zone.y,health:100,dead:0});
  Object.assign(other,{x:zone.x+40,z:zone.z+40,y:zone.y,health:100,dead:0});
  m.updateObjectives(1/60);
 }
 assert.equal(zone.owner,0);
 assert.ok(zone.progress===100);
 assert.ok(m.teamScores[0]>before,`owner should score while holding (${before} -> ${m.teamScores[0]})`);
});

test('blastUnsafe protects bots from detonating their own explosive at point-blank',()=>{
  assert.equal(blastUnsafe(WEAPONS[1],10),false);
  assert.equal(blastUnsafe(WEAPONS[1],4.5),true);
  assert.equal(blastUnsafe(WEAPONS[1],4.6),false);
  assert.equal(blastUnsafe(WEAPONS[5],3.9),true);
  assert.equal(blastUnsafe(WEAPONS[0],1),false);
  assert.equal(blastUnsafe(null,1),false);
  assert.equal(blastUnsafe(WEAPONS[1],NaN),false);
});

test('a critically hurt bot with no supplies backpedals from a visible threat',()=>{
  const m=new Match('chatgpt','openclaw',seeded(),'exchange',{mode:'deathmatch',botCount:1,difficulty:'normal',timeLimit:120,fragLimit:40});
  m.pickups.length=0;
  const bot=m.actors.find(a=>a.bot),human=m.actors.find(a=>!a.bot);
  Object.assign(bot,{health:bot.maxHealth*.15,x:-11,z:10,vx:0,vz:0});
  Object.assign(human,{health:human.maxHealth,x:-8,z:10});
  Object.assign(bot.bot,{target:human.id,memory:1.5,think:0,route:[],destination:null,state:'engage'});
  const input=m.botInput(bot,1/60)||{};
  assert.ok((input.x??0)<-0.2,`expected retreat away from the threat on -x, got ${input.x}`);
});

test('bots use the expanded arsenal when those weapons are available',()=>{
  const m=new Match('chatgpt','openclaw',seeded(),'exchange',{mode:'arsenal',botCount:1,difficulty:'normal',timeLimit:120,fragLimit:40});
  const bot=m.actors.find(a=>a.bot),human=m.actors.find(a=>!a.bot);
  Object.assign(bot,{health:bot.maxHealth,x:-11,z:10,vx:0,vz:0});
  Object.assign(human,{health:human.maxHealth,x:-11,z:6});
  Object.assign(bot.bot,{target:human.id,memory:1.5,think:0,route:[],destination:null,state:'engage'});
  m.botInput(bot,1/60);
  assert.ok(bot.weapon>=5,`close-range bot should pick an expanded-arsenal weapon, got ${bot.weapon}`);
});
test('bots sprint on long rotations and aim down sights at mid range',()=>{
  const m=new Match('chatgpt','openclaw',seeded(),'exchange',{mode:'deathmatch',botCount:1,difficulty:'normal',timeLimit:120,fragLimit:40});
  m.pickups.length=0;
  const bot=m.actors.find(a=>a.bot),human=m.actors.find(a=>!a.bot);
  Object.assign(bot,{health:bot.maxHealth,x:-11,y:0,z:10,vx:0,vz:0,grounded:true});
  Object.assign(bot.bot,{target:-1,memory:0,think:0,route:[],destination:{x:-11,y:0,z:40},state:'roam'});
  Object.assign(human,{health:human.maxHealth,x:60,y:0,z:60});
  const retreat=m.botInput(bot,1/60)||{};
  assert.equal(retreat.sprint,true,'a long rotation should sprint');
  Object.assign(bot,{health:bot.maxHealth,vx:0,vz:0});
  Object.assign(human,{x:-11,y:0,z:-1});
  Object.assign(bot.bot,{target:human.id,memory:1.5,think:0,state:'engage'});
  const engage=m.botInput(bot,1/60)||{};
  assert.equal(engage.sprint,false,'engaging bots should not sprint');
  assert.equal(engage.ads,true,'mid-range engaging bots should aim down sights');
});

test('a critically hurt bot slides away while sprinting',()=>{
  const m=new Match('chatgpt','openclaw',seeded(),'exchange',{mode:'deathmatch',botCount:1,difficulty:'normal',timeLimit:120,fragLimit:40});
  m.pickups.length=0;
  const bot=m.actors.find(a=>a.bot),human=m.actors.find(a=>!a.bot);
  Object.assign(bot,{health:bot.maxHealth*.15,x:-11,y:0,z:10,vx:0,vz:-8,grounded:true,slideCooldown:0});
  Object.assign(bot.bot,{target:-1,memory:0,think:0,route:[],destination:{x:-11,y:0,z:40},state:'roam'});
  Object.assign(human,{health:human.maxHealth,x:60,y:0,z:60});
  const input=m.botInput(bot,1/60)||{};
  assert.equal(input.sprint,true);
  assert.equal(input.crouch,true,'a hurt bot at speed should slide');
});
