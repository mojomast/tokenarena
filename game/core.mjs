import {CHARACTERS,HARNESSES,WEAPONS,POWERUPS,RULES,resolveLoadout} from './data.mjs';
import {MAPS,getMap,pickupWeapon} from './maps.mjs';
import {normalizeConfig,DIFFICULTIES,GAME_MODES,spawnInventory,modeWeapon} from './config.mjs';
import {harnessAbility,harnessBotHints,harnessPassive,harnessWeaponHandling,preferredHarnessWeapon} from './harness-profiles.mjs';
import {operatorProfile,preferredOperatorWeapon} from './operator-profiles.mjs';
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const v=(x=0,y=0,z=0)=>({x,y,z});
const add=(a,b,s=1)=>v(a.x+b.x*s,a.y+b.y*s,a.z+b.z*s);
const norm=a=>{const l=Math.hypot(a.x,a.y,a.z)||1;return v(a.x/l,a.y/l,a.z/l)};
export const eye=a=>v(a.x,a.y+1.45,a.z);
export const aim=(yaw,pitch=0)=>v(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
export const BLOCKS=MAPS[0].blocks;
const boundsOf=arena=>arena.bounds||{minX:-13.55,maxX:13.55,minZ:-13.55,maxZ:13.55};
const teamMode=c=>c.mode==='ctf'||c.mode==='teamdeathmatch';
const teamPoints=(value, fallback)=>{const out={0:[],1:[]};for(const key of [0,1,'red','blue']){const team=key===0||key==='red'?0:1;const points=value?.[key];if(Array.isArray(points))out[team]=points.map(p=>Array.isArray(p)?p:[p.x,p.z]).filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1]));}return {0:out[0].length?out[0]:fallback[0],1:out[1].length?out[1]:fallback[1]};};
const flagPoints=(value,fallback)=>{const out={0:fallback[0],1:fallback[1]};for(const key of [0,1,'red','blue']){const team=key===0||key==='red'?0:1,point=value?.[key];if(Array.isArray(point)&&Number.isFinite(point[0])&&Number.isFinite(point[1]))out[team]=point;else if(point&&Number.isFinite(point.x)&&Number.isFinite(point.z))out[team]=[point.x,point.z];}return out;};
const linkFor=(arena,id)=>{const link=(arena.jumpLinks||[]).find(item=>(item.traversal||item.traversalId||item.traversalID)===id);return link?.target;};
 const surfacesOf=arena=>arena.platforms||arena.surfaces||[];
 const surfaceY=surface=>surface.y??surface.topY??0;
 export function floorAt(x,z,arena=MAPS[0]){const surfaces=surfacesOf(arena);if(surfaces.length){let floor=null;for(const surface of surfaces)if(Math.abs(x-surface.x)<=surface.w/2&&Math.abs(z-surface.z)<=surface.d/2)floor=floor===null?surfaceY(surface):Math.max(floor,surfaceY(surface));return floor;}if(!arena.raised)return 0;let floor=0,solid=arena.blocks.some(b=>b.kind!=='deck'&&Math.abs(x-b.x)<=b.w/2&&Math.abs(z-b.z)<=b.d/2);for(const b of arena.blocks)if(b.kind==='deck'&&Math.abs(x-b.x)<=b.w/2&&Math.abs(z-b.z)<=b.d/2)floor=Math.max(floor,b.h);if(!arena.bounds&&!solid&&z<=-9)floor=Math.max(floor,3.8);else if(!arena.bounds&&!solid&&Math.abs(x)>8.2&&Math.abs(x)<14&&z<3)floor=Math.max(floor,(3-z)/12*3.8);return floor;}
 const supportAt=(x,z,arena)=>{let y=floorAt(x,z,arena);if(y===null)return null;for(const b of arena.blocks)if(b.kind!=='deck'&&Math.abs(x-b.x)<=b.w/2+RULES.radius&&Math.abs(z-b.z)<=b.d/2+RULES.radius)y=Math.max(y,b.h);return y;};
export function obstructed(x,y,z,r=RULES.radius,arena=MAPS[0]){return arena.blocks.some(b=>Math.abs(x-b.x)<b.w/2+r&&Math.abs(z-b.z)<b.d/2+r&&y<b.h-1e-6&&y+RULES.height>0);}
export function moveActor(a,input,dt,arena=MAPS[0],config={speed:1,gravity:1}){
 // Recover corrected/older embedded state without lifting actors through tall solids.
 for(const b of arena.blocks)if(Math.abs(a.x-b.x)<b.w/2+RULES.radius&&Math.abs(a.z-b.z)<b.d/2+RULES.radius&&a.y<b.h-1e-6){
  const candidates=[{x:b.x-b.w/2-RULES.radius-1e-6,y:a.y,z:a.z},{x:b.x+b.w/2+RULES.radius+1e-6,y:a.y,z:a.z},{x:a.x,y:a.y,z:b.z-b.d/2-RULES.radius-1e-6},{x:a.x,y:a.y,z:b.z+b.d/2+RULES.radius+1e-6}];
  if(b.h-a.y<=.25)candidates.push({x:a.x,y:b.h,z:a.z});
    const bounds=boundsOf(arena);const p=candidates.filter(p=>{const floor=floorAt(p.x,p.z,arena);return p.x>=bounds.minX&&p.x<=bounds.maxX&&p.z>=bounds.minZ&&p.z<=bounds.maxZ&&floor!==null&&floor<=p.y+1e-6&&!obstructed(p.x,p.y,p.z,RULES.radius,arena);}).sort((p,q)=>dist(a,p)-dist(a,q))[0];
  if(p){if(p.x!==a.x)a.vx=0;if(p.z!==a.z)a.vz=0;if(p.y!==a.y)a.vy=0;Object.assign(a,p);}
 }
   const speed=(a.moveSpeed??CHARACTERS.find(c=>c.id===a.character)?.stats.speed??RULES.speed)*config.speed*(a.harnessSpeedMultiplier||1)*(a.speedMultiplier||1)*(a.active>0&&a.harness==='hermes'?(a.activeSpeedMultiplier||1.6):1)*(a.slow>0?(a.slowMultiplier??.55):1),len=Math.hypot(input.x||0,input.z||0)||1;
 let ix=(input.x||0)/Math.max(1,len),iz=(input.z||0)/Math.max(1,len);
  if(a.grounded){if(!ix&&!iz){const f=Math.max(0,1-10*dt);a.vx*=f;a.vz*=f;}a.coyote=.1;}else a.coyote=Math.max(0,a.coyote-dt);
   const accel=a.grounded?55:a.traversalFlight?8:16;if(ix||iz){a.vx+=clamp(ix*speed-a.vx,-accel*dt,accel*dt);a.vz+=clamp(iz*speed-a.vz,-accel*dt,accel*dt);}
  const horizontal=Math.hypot(a.vx,a.vz);if(horizontal>speed&&!a.traversalFlight){const damping=Math.max(speed,horizontal-45*dt)/horizontal;a.vx*=damping;a.vz*=damping;}
 a.jumpBuffer=input.jump?.12:Math.max(0,a.jumpBuffer-dt);
 if(a.jumpBuffer>0&&a.coyote>0){a.vy=RULES.jump;a.grounded=false;a.jumpBuffer=0;a.coyote=0;}
 // Small axis moves preserve sliding and prevent fast knockback tunneling.
 const steps=Math.max(1,Math.ceil(Math.max(Math.abs(a.vx*dt),Math.abs(a.vz*dt),Math.abs(a.vy*dt)+RULES.gravity*config.gravity*dt*dt)/.18)),step=dt/steps;
 for(let i=0;i<steps;i++){
 for(const axis of ['x','z']){
  const value=a[axis]+a[axis==='x'?'vx':'vz']*step;
  const nx=axis==='x'?value:a.x,nz=axis==='z'?value:a.z;
   const f=floorAt(nx,nz,arena),tops=arena.blocks.filter(b=>b.kind!=='deck'&&Math.abs(nx-b.x)<b.w/2+RULES.radius&&Math.abs(nz-b.z)<b.d/2+RULES.radius);let ny=f!==null&&Math.abs(f-a.y)<.25&&a.vy<=0&&a.grounded?f:a.y;if(tops.length&&a.y>=Math.max(...tops.map(b=>b.h))-1e-6)ny=Math.max(...tops.map(b=>b.h));
  // The ramp meets the deck before the actor's center crosses the terrain seam.
  if(a.grounded&&a.vy<=0)for(const b of arena.blocks)if(b.kind==='deck'&&Math.abs(nx-b.x)<b.w/2+RULES.radius&&Math.abs(nz-b.z)<b.d/2+RULES.radius&&Math.abs(b.h-a.y)<.25)ny=Math.max(ny,b.h);
   if(!obstructed(nx,ny,nz,RULES.radius,arena)&&(f===null||f-a.y<.3)){a[axis]=value;a.y=ny;}else a[axis==='x'?'vx':'vz']=0;
 }
  a.vy-=RULES.gravity*config.gravity*step;const nextY=a.y+a.vy*step;let f=floorAt(a.x,a.z,arena),solidTops=arena.blocks.filter(b=>b.kind!=='deck'&&Math.abs(a.x-b.x)<b.w/2+RULES.radius&&Math.abs(a.z-b.z)<b.d/2+RULES.radius);if(solidTops.length)f=Math.max(f??-Infinity,Math.max(...solidTops.map(b=>b.h)));
 // Sweep feet against solid tops using the same footprint as side collision.
 for(const b of arena.blocks)if(Math.abs(a.x-b.x)<b.w/2+RULES.radius&&Math.abs(a.z-b.z)<b.d/2+RULES.radius&&a.y>=b.h-1e-6)f=Math.max(f,b.h);
   if(f!==null&&nextY<=f){a.y=f;a.vy=0;a.grounded=true;a.traversalFlight=false;a.traversalTarget=null;}else{a.y=nextY;a.grounded=false;}
   const target=a.traversalTarget,targetFloor=target&&floorAt(target.x,target.z,arena);if(a.traversalFlight&&target&&targetFloor!==null&&a.vy<=0&&Math.hypot(a.x-target.x,a.z-target.z)<=.9&&a.y<=targetFloor+.35){a.x=target.x;a.z=target.z;a.y=targetFloor;a.vx=a.vy=a.vz=0;a.grounded=true;a.traversalFlight=false;a.traversalTarget=null;}
  const bounds=boundsOf(arena);a.x=clamp(a.x,bounds.minX,bounds.maxX);a.z=clamp(a.z,bounds.minZ,bounds.maxZ);
  }
    const traversal=arena.traversal||arena.traversalMetadata||{},pads=[...(traversal.trampolines||arena.trampolines||[]).map((p,i)=>({...p,type:'trampoline',id:p.id??`t${i}`})),...(traversal.boostLaunchers||traversal.launchers||arena.boostLaunchers||[]).map((p,i)=>({...p,type:'boost',id:p.id??`b${i}`,target:p.target||linkFor(arena,p.id??`b${i}`)}))];
    const floor=floorAt(a.x,a.z,arena),pad=pads.find(p=>floor!==null&&Math.hypot(a.x-p.x,a.z-p.z)<.7&&Math.abs(a.y-floor)<.35&&a.grounded);
   if(pad&&a.traversalPad!==pad.id&&(a.traversalCooldown||0)<=0){
    if(pad.type==='trampoline')a.vy=Math.max(a.vy,pad.power??RULES.jump*1.5);
     else {const gravity=RULES.gravity*(config.gravity??1),target=pad.target,deltaY=(target?.y??0)-a.y,launchY=pad.vy??(pad.power??14)*.55,discriminant=launchY*launchY-2*gravity*deltaY,time=target&&discriminant>=0?(launchY+Math.sqrt(discriminant))/gravity:null,d=target&&time>0?norm(v((target.x-a.x)/time,0,(target.z-a.z)/time)):norm(v(pad.dir?.[0]??0,0,pad.dir?.[1]??0)),horizontal=target?Math.hypot(target.x-a.x,target.z-a.z)/(time||1):pad.power??14;a.vx=d.x*horizontal;a.vz=d.z*horizontal;a.vy=launchY;a.traversalTarget=target||null;}
    a.grounded=false;a.traversalFlight=pad.type==='boost';a.traversalCooldown=pad.cooldown??1;a.traversalPad=pad.id;
  }else if(!pad)a.traversalPad=null;
   a.traversalCooldown=Math.max(0,(a.traversalCooldown||0)-dt);
   const support=supportAt(a.x,a.z,arena);if(a.grounded&&support!==null&&Math.abs(a.y-support)<.35)a.lastValid={x:a.x,y:a.y,z:a.z};
}
function boxHit(o,d,b,max){let lo=0,hi=max;for(const k of ['x','y','z']){const c=k==='y'?b.h/2:b[k],s=k==='x'?b.w/2:k==='z'?b.d/2:b.h/2;if(Math.abs(d[k])<1e-8){if(o[k]<c-s||o[k]>c+s)return null;}else{let t1=(c-s-o[k])/d[k],t2=(c+s-o[k])/d[k];if(t1>t2)[t1,t2]=[t2,t1];lo=Math.max(lo,t1);hi=Math.min(hi,t2);if(lo>hi)return null;}}return lo;}
export function rayWorld(o,d,max=100,arena=MAPS[0]){let best=max;for(const b of arena.blocks){const t=boxHit(o,d,b,best);if(t!==null&&t<best)best=t;}
 // Analytic floor/ramp intersection by bounded ray marching, refined at first crossing.
  for(let t=.12;t<best;t+=.16){const p=add(o,d,t),floor=floorAt(p.x,p.z,arena);if(floor!==null&&p.y<floor){let lo=Math.max(0,t-.16),hi=t;for(let i=0;i<7;i++){const m=(lo+hi)/2,q=add(o,d,m),qFloor=floorAt(q.x,q.z,arena);if(qFloor!==null&&q.y<qFloor)hi=m;else lo=m;}best=hi;break;}}
 return best;}
export function visible(a,b,arena=MAPS[0]){const delta=v(b.x-a.x,b.y-a.y,b.z-a.z),l=Math.hypot(delta.x,delta.y,delta.z);return rayWorld(a,norm(delta),l,arena)>=l-.08;}
function actorHit(o,d,a,max){return boxHit(o,d,{x:a.x,z:a.z,w:.85,d:.85,h:1.8},max);}
function hitActor(o,d,a,max){const local=v(o.x,o.y-a.y,o.z);return actorHit(local,d,a,max);}
export function walkEdge(a,b,arena=MAPS[0]){const l=dist(a,b);if(l>6.5)return false;const n=Math.max(1,Math.ceil(l/.2));let prev=a.y;for(let i=0;i<=n;i++){const x=a.x+(b.x-a.x)*i/n,z=a.z+(b.z-a.z)*i/n;let y=floorAt(x,z,arena);if(y===null)return false;for(const block of arena.blocks)if(block.kind==='deck'&&Math.abs(x-block.x)<block.w/2+.52&&Math.abs(z-block.z)<block.d/2+.52&&Math.abs(block.h-y)<.25)y=Math.max(y,block.h);if(Math.abs(y-prev)>.3||obstructed(x,y,z,.52,arena))return false;prev=y;}return true;}
  export function navigation(arena=MAPS[0]){const nodes=[];const addNode=(x,z)=>{const y=floorAt(x,z,arena);if(y===null)return;if(!obstructed(x,y,z,.65,arena)&&!nodes.some(p=>Math.hypot(p.x-x,p.z-z)<.1))nodes.push(v(x,y,z));};const bounds=boundsOf(arena);for(let x=Math.ceil(bounds.minX/3)*3;x<=bounds.maxX;x+=3)for(let z=Math.ceil(bounds.minZ/3)*3;z<=bounds.maxZ;z+=3)addNode(x,z);if(arena.raised)for(const [x,z]of [[-1.8,-3.6],[1.8,-3.6],[-1.8,-6],[1.8,-6],[0,-7.5],[-6,-7.5],[6,-7.5]])addNode(x,z);for(const p of arena.navNodes||[])addNode(p.x,p.z);for(const [,x,z]of arena.pickups)addNode(x,z);for(const [x,z]of arena.spawns)addNode(x,z);for(const p of [...(arena.traversal?.trampolines||[]),...(arena.traversal?.boostLaunchers||[])])addNode(p.x,p.z);const edges=nodes.map((a,i)=>nodes.map((b,j)=>j!==i&&walkEdge(a,b,arena)?j:-1).filter(j=>j>=0));for(const link of arena.jumpLinks||[]){const from=nearest(link.source,nodes),to=nearest(link.target,nodes);if(from!==to&&!edges[from].includes(to))edges[from].push(to);}return {nodes,edges};}
const navigationCache=new Map();
function matchNavigation(arena){
 if(!navigationCache.has(arena)){
  const graph=navigation(arena);
  graph.nodes.forEach(Object.freeze);graph.edges.forEach(Object.freeze);
  Object.freeze(graph.nodes);Object.freeze(graph.edges);navigationCache.set(arena,Object.freeze(graph));
 }
 return navigationCache.get(arena);
}
const defaultNavigation=matchNavigation(MAPS[0]);
export const NAV=defaultNavigation.nodes,EDGES=defaultNavigation.edges;
function nearest(p,nodes){let id=0,best=Infinity;nodes.forEach((n,i)=>{const d=dist(p,n);if(d<best){id=i;best=d;}});return id;}
function path(a,b,nodes,edges){const from=nearest(a,nodes),to=nearest(b,nodes),queue=[from],prev=new Map([[from,-1]]);while(queue.length){const n=queue.shift();if(n===to)break;for(const j of edges[n])if(!prev.has(j)){prev.set(j,n);queue.push(j);}}if(!prev.has(to))return [from];const route=[];for(let n=to;n!==-1;n=prev.get(n))route.unshift(n);return route;}
function applyHarnessProfile(a){const passive=harnessPassive(a.harness),ability=harnessAbility(a.harness);a.harnessSpeedMultiplier=passive?.speed??1;a.harnessResistance=passive?.resistance??0;a.activeSpeedMultiplier=ability?.speed??(a.harness==='hermes'?1.6:1);}
export class Match{
 visible(a,b){return visible(a,b,this.arena);}
 rayWorld(o,d,max){return rayWorld(o,d,max,this.arena);}
   constructor(character='chatgpt',harness='openclaw',random=Math.random,mapId='exchange',options={}){this.config=normalizeConfig(options);this.humanCount=Math.max(1,Math.min(Math.round(options.humanCount??1),8));this.difficulty=DIFFICULTIES.find(d=>d.id===this.config.difficulty);this.arena=getMap(mapId);const nav=matchNavigation(this.arena);this.nav=nav.nodes;this.edges=nav.edges;this.spawns=this.arena.spawns.map(([x,z])=>v(x,floorAt(x,z,this.arena),z));this.random=random;this.time=0;this.over=false;this.events=[];this.feed=[];this.rockets=[];this.stats={shots:0,kills:0,pickups:0,powers:0,respawns:0,falls:0};this.serial=0;this.teamScores={0:0,1:0};
   const defaults={0:this.arena.spawns.filter((_,i)=>i%2===0),1:this.arena.spawns.filter((_,i)=>i%2===1)};
   this.teamSpawns=teamPoints(this.arena.teamSpawns,defaults);
   this.flagSpawns=flagPoints(this.arena.flagSpawns,{0:this.teamSpawns[0][0],1:this.teamSpawns[1][0]});
   this.flags=this.config.mode==='ctf'?{0:{team:0,state:'at-base',x:this.flagSpawns[0][0],z:this.flagSpawns[0][1],carrier:null},1:{team:1,state:'at-base',x:this.flagSpawns[1][0],z:this.flagSpawns[1][1],carrier:null}}:[];
 this.pickups=this.arena.pickups.map(([kind,x,z],id)=>({id,kind,x,z,y:floorAt(x,z,this.arena),wait:0}));
 this.pickups=this.pickups.filter(p=>this.config.mode!=='instagib'&&(modeWeapon(this.config)===null||p.kind==='health'||p.kind==='armor'));
  this.actors=[this.actor(0,character,harness),...Array.from({length:this.humanCount-1},(_,i)=>this.actor(i+1,CHARACTERS[(CHARACTERS.findIndex(c=>c.id===character)+i+1)%CHARACTERS.length].id,HARNESSES[Math.floor(this.random()*HARNESSES.length)].id)),...Array.from({length:this.config.botCount},(_,i)=>this.actor(this.humanCount+i,CHARACTERS[(CHARACTERS.findIndex(c=>c.id===character)+this.humanCount+i)%CHARACTERS.length].id,HARNESSES[Math.floor(this.random()*HARNESSES.length)].id))];this.actors[0].name=this.config.playerName||this.actors[0].name;
   for(const a of this.actors){const loadout=options.loadouts?.[a.id];if(a.id<this.humanCount&&loadout){Object.assign(a,resolveLoadout(loadout.character,loadout.harness));a.name=CHARACTERS.find(c=>c.id===a.character).name;}applyHarnessProfile(a);this.spawn(a);}}
    actor(id,character,harness){const l=resolveLoadout(character,harness),actor={id,...l,team:teamMode(this.config)?id%2:undefined,name:CHARACTERS.find(c=>c.id===l.character).name,frags:0,deaths:0,x:0,y:0,z:0,lastValid:null,vx:0,vy:0,vz:0,yaw:0,pitch:0,grounded:true,coyote:0,jumpBuffer:0,health:0,armor:0,dead:0,weapon:modeWeapon(this.config)??(this.config.mode==='arsenal'?0:this.config.startingWeapon),ammo:spawnInventory(this.config),cooldown:0,active:0,slow:0,slowMultiplier:.55,shotWait:0,protection:0,shots:0,traversalCooldown:0,traversalPad:null,traversalTarget:null,powerups:{},speedMultiplier:1,damageMultiplier:1,cooldownMultiplier:1,temporaryShield:0,activeSpeedMultiplier:1,harnessSpeedMultiplier:1,harnessResistance:0,bot:id<this.humanCount?null:{route:[],think:0,target:-1,memory:0,reaction:0,stuck:0,last:v(),state:'roam'}};applyHarnessProfile(actor);return actor;}
 emit(type,data={}){this.events.push({type,id:++this.serial,time:this.time,...data});if(this.events.length>300)this.events.shift();}
    spawn(a){const others=this.actors?.filter(b=>b!==a&&b.health>0)||[];const pool=teamMode(this.config)?this.teamSpawns[a.team]:this.spawns;let best=-Infinity,chosen=v();for(const s of pool){const sx=Array.isArray(s)?s[0]:s.x,sz=Array.isArray(s)?s[1]:s.z,pos=v(sx,floorAt(sx,sz,this.arena),sz);const score=(others.length?Math.min(...others.map(b=>dist(b,pos))):0)+this.random()*2;if(score>best){best=score;chosen=pos;}}
  const stats=CHARACTERS.find(c=>c.id===a.character).stats;
      Object.assign(a,{...chosen,lastValid:{...chosen},vx:0,vy:0,vz:0,health:stats.health,maxHealth:stats.health,armor:stats.armor,moveSpeed:stats.speed,dead:0,weapon:modeWeapon(this.config)??(this.config.mode==='arsenal'?0:this.config.startingWeapon),ammo:spawnInventory(this.config),cooldown:0,active:0,slow:0,slowMultiplier:.55,shotWait:.25,protection:RULES.protection,grounded:true,jumpBuffer:0,coyote:0,traversalFlight:false,traversalTarget:null,yaw:Math.atan2(chosen.x,chosen.z),pitch:0,powerups:{},speedMultiplier:1,damageMultiplier:1,cooldownMultiplier:1,temporaryShield:0,activeSpeedMultiplier:1});applyHarnessProfile(a);
    if(a.bot)a.bot={route:[],think:0,target:-1,memory:0,reaction:0,stuck:0,last:v(a.x,a.y,a.z),state:'roam'};this.stats.respawns++;this.emit('spawn',{actor:a.id,pos:v(a.x,a.y+1,a.z)});} damage(target,amount,source){if(this.over||target.health<=0||target.protection>0)return 0;const guardrail=target.active>0&&target.harness==='claudecode'?.5:0,mitigation=Math.min(.5,Math.max(target.harnessResistance||0,guardrail));let damage=(this.config.mode==='instagib'?10000:amount*this.config.damage)*(source?.damageMultiplier||1)*(1-mitigation);const shield=Math.min(target.temporaryShield||0,damage);target.temporaryShield-=shield;damage-=shield;const absorb=Math.min(target.armor,damage*.6);target.armor-=absorb;damage-=absorb;const actual=Math.min(target.health,damage);target.health=Math.max(0,target.health-damage);if(this.config.lifeSteal&&source&&source!==target&&source.health>0)source.health=Math.min(source.maxHealth,source.health+actual*.25);this.emit('damage',{actor:target.id,source:source?.id,amount:shield+absorb+actual,shield:shield});
   if(target.health<=0){target.deaths++;target.dead=this.config.respawn;target.active=0;target.cooldown=0;target.slow=0;target.vx=target.vy=target.vz=0;this.dropFlag(target);if(source)source.frags+=source.id===target.id?-1:1;this.stats.kills++;this.emit('death',{actor:target.id,pos:v(target.x,target.y+1,target.z),character:target.character});this.feed.unshift({killer:source?.name||'Arena',victim:target.name,self:source?.id===target.id,time:this.time});this.feed.length=Math.min(this.feed.length,5);if(this.config.mode==='teamdeathmatch'&&source&&source!==target){this.teamScores[source.team]++;if(this.teamScores[source.team]>=this.config.fragLimit)this.over=true;}if(!teamMode(this.config)&&source?.frags>=this.config.fragLimit)this.over=true;}return shield+absorb+actual;}
   dropFlag(a,pos=a){if(this.config.mode!=='ctf')return;for(const f of Object.values(this.flags))if(f.carrier===a.id){f.state='dropped';f.carrier=null;f.x=pos.x;f.z=pos.z;this.emit('flag-drop',{actor:a.id,team:f.team,pos:{x:f.x,z:f.z}});}}
    fall(a){if(a.health<=0)return;const pos=a.lastValid?{...a.lastValid}:{x:a.x,y:a.y,z:a.z};this.dropFlag(a,pos);a.health=0;a.deaths++;a.dead=this.config.respawn;a.active=0;a.cooldown=0;a.slow=0;a.vx=a.vy=a.vz=0;a.traversalFlight=false;a.traversalTarget=null;Object.assign(a,pos);this.stats.falls++;this.emit('fall',{actor:a.id,pos:{...pos},route:a.bot?.state});this.emit('death',{actor:a.id,pos:v(pos.x,pos.y+1,pos.z),character:a.character,fall:true});this.feed.unshift({killer:'The void',victim:a.name,self:true});this.feed.length=Math.min(this.feed.length,5);}
   objective(a){if(this.config.mode!=='ctf'||a.health<=0)return;const home=this.flags[a.team],homeWasHome=home.state==='at-base';for(const f of Object.values(this.flags)){if(f.carrier!==null){const carrier=this.actors.find(t=>t.id===f.carrier);if(carrier){f.x=carrier.x;f.z=carrier.z;}}if(Math.hypot(a.x-f.x,a.z-f.z)<1.15){if(f.team===a.team){if(f.state==='dropped'){f.state='at-base';const s=this.flagSpawns[f.team];f.x=s[0];f.z=s[1];this.emit('flag-return',{actor:a.id,team:f.team,pos:{x:f.x,z:f.z}});}}else if(f.state!=='carried'){f.state='carried';f.carrier=a.id;this.emit('flag-pickup',{actor:a.id,team:f.team});}}}
    const enemy=Object.values(this.flags).find(f=>f.carrier===a.id);if(enemy&&Math.hypot(a.x-home.x,a.z-home.z)<1.3&&homeWasHome){this.teamScores[a.team]++;enemy.state='at-base';enemy.carrier=null;const s=this.flagSpawns[enemy.team];enemy.x=s[0];enemy.z=s[1];this.emit('capture',{actor:a.id,team:a.team,score:this.teamScores[a.team]});if(this.teamScores[a.team]>=this.config.fragLimit)this.over=true;}
  }
   power(a){if(this.over||a.health<=0||a.cooldown>0||this.config.mode==='instagib')return false;const h=HARNESSES.find(h=>h.id===a.harness),ability=harnessAbility(a.harness)||h;a.protection=0;a.cooldown=(ability.cooldown??h.cooldown)*(this.config.fastPowers?.5:1)*a.cooldownMultiplier;a.active=ability.duration??h.duration;a.activeSpeedMultiplier=ability.speed??h.magnitude??1;this.stats.powers++;this.emit('power',{actor:a.id,harness:a.harness,pos:eye(a),duration:a.active});
   if(a.harness==='codex')a.health=Math.min(a.maxHealth,a.health+(ability.heal??h.magnitude));
   if(a.harness==='cline'){const dir=aim(a.yaw,0),from={...a},bounds=boundsOf(this.arena),distance=ability.distance??h.magnitude;for(let step=.12;step<=distance;step+=.12){const x=from.x+dir.x*step,z=from.z+dir.z*step,y=floorAt(x,z,this.arena);if(y===null||x<bounds.minX||x>bounds.maxX||z<bounds.minZ||z>bounds.maxZ||obstructed(x,Math.max(a.y,y),z,.48,this.arena)||y-a.y>.25)break;a.x=x;a.z=z;a.y=Math.max(a.y,y);}a.vx=a.vz=0;this.emit('dash',{from:eye(from),to:eye(a),actor:a.id});}
  if(a.harness==='roo'){const range=ability.radius??ability.range??h.range,slow=ability.slow??h.magnitude;for(const b of this.actors)if(b!==a&&b.health>0&&!b.protection&&dist(a,b)<range&&this.visible(eye(a),eye(b))){b.slow=ability.duration??h.duration;b.slowMultiplier=slow;this.emit('jam',{actor:b.id,pos:eye(b)});}}
   if(a.harness==='openclaw'){const range=ability.radius??h.range,damage=ability.damage??h.damage,knockback=ability.knockback??h.magnitude,lift=ability.lift??4;for(const b of this.actors){const d=dist(a,b);if(b!==a&&b.health>0&&(!teamMode(this.config)||b.team!==a.team)&&d<range&&this.visible(eye(a),eye(b))){this.damage(b,damage,a);const dir=norm(v(b.x-a.x,0,b.z-a.z));b.vx+=dir.x*knockback;b.vz+=dir.z*knockback;b.vy+=lift;}}}return true;}
  fire(a,direction=aim(a.yaw,a.pitch)){
   if(this.over||a.health<=0||a.shotWait>0)return false;const locked=modeWeapon(this.config);if(locked!==null)a.weapon=locked;const attempted=Number.isInteger(a.weapon)&&a.weapon>=0&&a.weapon<WEAPONS.length?a.weapon:0;if(a.ammo[attempted]<=0){if(attempted!==0)this.emit('dryfire',{actor:a.id,weapon:attempted});a.weapon=0;}const w=WEAPONS[a.weapon],weapon=a.weapon,handling=harnessWeaponHandling(a.harness,weapon)||{},affinityDamage=handling.favored?handling.damage:1,activeFireRate=a.active>0&&a.harness==='opencode'?(1/(handling.activeFireRate??(harnessAbility(a.harness)?.fireRate||1))):1;a.shotWait=w.interval*(handling.interval??1)*(a.cooldownMultiplier||1)*activeFireRate+(a.bot?this.difficulty.fireDelay:0);a.ammo[weapon]--;a.protection=0;this.stats.shots++;a.shots++;
 for(let pellet=0;pellet<(w.pellets||1);pellet++){
   const spread=(w.spread??0)*(handling.spread??1),o=eye(a),d=norm(w.pellets?add(direction,v((this.random()-.5)*spread,(this.random()-.5)*spread,(this.random()-.5)*spread)):direction);let range=this.rayWorld(o,d,w.range),target=null;for(const b of this.actors)if(b!==a&&b.health>0&&(!teamMode(this.config)||b.team!==a.team)){const t=hitActor(o,d,b,range);if(t!==null&&t<range){range=t;target=b;}}
 const goal=add(o,d,range),side=aim(a.yaw-Math.PI/2,0),muzzle=add(add(o,side,.24),d,.42);muzzle.y-=.24;
 const md=norm(v(muzzle.x-o.x,muzzle.y-o.y,muzzle.z-o.z)),ml=dist(o,muzzle),muzzleBlocked=this.rayWorld(o,md,ml)<ml-.01;
 if(muzzleBlocked){this.emit('shot',{actor:a.id,weapon,from:o,to:add(o,md,this.rayWorld(o,md,ml))});continue;}
 const trajectory=norm(v(goal.x-muzzle.x,goal.y-muzzle.y,goal.z-muzzle.z)),travel=dist(muzzle,goal),block=this.rayWorld(muzzle,trajectory,travel);
   if(w.speed){this.rockets.push({id:++this.serial,owner:a.id,weapon,pos:muzzle,dir:trajectory,vy:trajectory.y*w.speed,damageMultiplier:affinityDamage,life:w.life??4,bounces:0});this.emit('launch',{actor:a.id,weapon,pos:muzzle});}
  else{if(target&&block>=travel-.1)this.damage(target,w.damage*affinityDamage,a);this.emit('shot',{actor:a.id,weapon,from:muzzle,to:add(muzzle,trajectory,Math.min(block,travel)),hit:target&&block>=travel-.1});}
 }return true;}
   explode(r,hit){const source=this.actors[r.owner],w=WEAPONS[r.weapon??1],affinityDamage=r.damageMultiplier||1;if(hit)this.damage(hit,w.damage*affinityDamage,source);for(const a of this.actors){const p=eye(a),d=dist(r.pos,p);if(a.health>0&&(!teamMode(this.config)||a.team!==source?.team)&&d<w.radius&&this.visible(r.pos,p)){this.damage(a,w.splash*affinityDamage*(1-d/w.radius),source);const n=norm(v(a.x-r.pos.x,.5,a.z-r.pos.z));a.vx+=n.x*8;a.vz+=n.z*8;a.vy+=4;}}this.emit('explosion',{pos:{...r.pos},weapon:r.weapon??1});}
  useful(a,p){if(this.config.mode==='instagib'&&p.kind!=='health'&&p.kind!=='armor')return false;if(p.kind==='health')return a.health<a.maxHealth;if(p.kind==='armor')return a.armor<100;if(POWERUPS.some(x=>x.id===p.kind))return true;const n=pickupWeapon(p.kind);return n!==undefined&&a.ammo[n]<WEAPONS[n].cap;}
   collect(a,p){if(!this.useful(a,p))return false;const power=POWERUPS.find(x=>x.id===p.kind);if(p.kind==='health')a.health=Math.min(a.maxHealth,a.health+35);else if(p.kind==='armor')a.armor=Math.min(100,a.armor+40);else if(power){a.powerups[power.id]=power.duration;this.refreshPowerups(a);this.emit('powerup',{actor:a.id,kind:power.id,duration:a.powerups[power.id],effect:{...power.effect},pos:eye(a)});}else{const n=pickupWeapon(p.kind);a.ammo[n]=this.config.unlimitedAmmo?Infinity:Math.min(WEAPONS[n].cap,a.ammo[n]+WEAPONS[n].ammo);if(a.weapon===0)a.weapon=n;}p.wait=p.kind==='health'||p.kind==='armor'?12:15;this.stats.pickups++;this.emit('pickup',{actor:a.id,kind:p.kind,powerup:!!power});return true;}
  refreshPowerups(a){a.speedMultiplier=1;a.damageMultiplier=1;a.cooldownMultiplier=1;a.temporaryShield=0;for(const id of Object.keys(a.powerups)){const p=POWERUPS.find(x=>x.id===id);if(!p||a.powerups[id]<=0){delete a.powerups[id];continue;}const e=p.effect;if(e.speedMultiplier)a.speedMultiplier=Math.max(a.speedMultiplier,e.speedMultiplier);if(e.damageMultiplier)a.damageMultiplier=Math.max(a.damageMultiplier,e.damageMultiplier);if(e.cooldownMultiplier)a.cooldownMultiplier=Math.min(a.cooldownMultiplier,e.cooldownMultiplier);if(e.armor)a.temporaryShield=Math.max(a.temporaryShield,e.armor);}}
  botInput(a,dt){const b=a.bot,hints=harnessBotHints(a.harness)||{range:[6,16],retreatHealth:.4,power:'hurt'},operator=operatorProfile(a.character);b.think-=dt;b.memory=Math.max(0,b.memory-dt);b.reaction=Math.max(0,b.reaction-dt);
   if(b.think<=0){b.think=this.difficulty.think+this.random()*.15;const candidates=this.actors.filter(t=>t!==a&&t.health>0&&dist(a,t)<25&&this.visible(eye(a),eye(t))&&(!teamMode(this.config)||t.team!==a.team)).sort((c,d)=>dist(a,c)-dist(a,d));const target=candidates[0];if(target){if(b.target!==target.id)b.reaction=this.difficulty.reaction+this.random()*.25;b.target=target.id;b.memory=1.5;b.seen={x:target.x,y:target.y,z:target.z};}else if(!b.memory)b.target=-1;
  const supply=this.pickups.filter(p=>!p.wait&&this.useful(a,p)).sort((c,d)=>(dist(a,c)-(c.kind==='health'&&a.health<a.maxHealth*.55?20:0))-(dist(a,d)-(d.kind==='health'&&a.health<a.maxHealth*.55?20:0)))[0];
  const needs=supply&&(a.health<a.maxHealth*.55&&supply.kind==='health'||a.ammo.slice(1).every(n=>n===0)||b.target<0);
  if(this.config.mode==='ctf'){const carrying=Object.values(this.flags).some(f=>f.carrier===a.id),enemy=this.flags[1-a.team],own=this.flags[a.team];if(carrying){b.state='flag-return';b.destination={x:own.x,y:0,z:own.z};}else if(enemy.state!=='carried'){b.state='flag-attack';b.destination={x:enemy.x,y:0,z:enemy.z};}else{b.state='flag-defend';b.destination={x:own.x,y:0,z:own.z};}}else if(needs){b.state='seek';b.destination=supply;}else if(target){b.state='engage';b.destination={x:target.x,y:target.y,z:target.z};}else if(b.memory){b.state='pursue';b.destination=b.seen;}else{b.state='roam';if(!b.destination||dist(a,b.destination)<1.5)b.destination=this.nav[Math.floor(this.random()*this.nav.length)];}
 if(b.destination){b.route=path(a,b.destination,this.nav,this.edges);if(b.route.length>1&&dist(a,this.nav[b.route[0]])<2)b.route.shift();}
 }
 const t=this.actors[b.target],canSee=t&&t.health>0&&b.memory>0&&dist(a,t)<25&&this.visible(eye(a),eye(t));let dest=b.route.length?this.nav[b.route[0]]:b.destination||a;
 if(canSee&&!b.tracking)b.reaction=Math.max(b.reaction,this.difficulty.reaction+this.random()*.25);
 b.tracking=!!canSee;
 if(dist(a,dest)<.8&&b.route.length){b.route.shift();dest=b.route.length?this.nav[b.route[0]]:b.destination||a;}
 if(b.destination&&walkEdge(a,b.destination,this.arena))dest=b.destination;
 let delta=v(dest.x-a.x,0,dest.z-a.z),l=Math.hypot(delta.x,delta.z);let input=l>.4?{x:delta.x/l,z:delta.z/l}:{};
  if(canSee){const d=dist(a,t);if(b.state==='engage'&&d<17&&Math.abs(t.y-a.y)<1.5){const toward=norm(v(t.x-a.x,0,t.z-a.z)),side=Math.sin(this.time*1.8+a.id)>0?1:-1,strafe=.75*operator.strafe;input={x:toward.x*(d>10?.5:d<4?-.8:0)+toward.z*side*strafe,z:toward.z*(d>10?.5:d<4?-.8:0)-toward.x*side*strafe};}
   const available=WEAPONS.map((w,index)=>a.ammo[index]>0?index:-1).filter(index=>index>=0),preferred=preferredHarnessWeapon(a.harness,available),operatorWeapon=preferredOperatorWeapon(a.character,available),far=hints.range[1],rangeWeapon=d<8&&a.ammo[3]>0?3:d>14&&a.ammo[2]>0?2:d>5&&d<16&&a.ammo[1]>0?1:a.ammo[4]>0?4:0; a.weapon=modeWeapon(this.config)??(rangeWeapon||preferred||operatorWeapon||0);
 b.aimWait=(b.aimWait||0)-dt;
 if(b.aimWait<=0){const err=this.difficulty.error*(1+this.random()*.89);b.aimError=v((this.random()-.5)*err,(this.random()-.5)*err,(this.random()-.5)*err);b.aimWait=this.difficulty.think;}
 const lead=WEAPONS[a.weapon].speed?d/WEAPONS[a.weapon].speed:0,dir=norm(v(t.x+t.vx*lead-a.x+d*b.aimError.x,t.y+1.1-(a.y+1.45)+d*b.aimError.y,t.z+t.vz*lead-a.z+d*b.aimError.z));
 const turn=this.difficulty.id==='easy'?2.5:this.difficulty.id==='normal'?4:8,yaw=Math.atan2(-dir.x,-dir.z),pitch=Math.asin(dir.y),deltaYaw=Math.atan2(Math.sin(yaw-a.yaw),Math.cos(yaw-a.yaw));
 a.yaw+=clamp(deltaYaw,-turn*dt,turn*dt);a.pitch+=clamp(pitch-a.pitch,-turn*dt,turn*dt);
 if(!b.reaction&&Math.abs(deltaYaw)<.2&&Math.abs(pitch-a.pitch)<.2)this.fire(a);
   const nearby=this.actors.filter(enemy=>enemy!==a&&enemy.health>0&&(!teamMode(this.config)||enemy.team!==a.team)&&dist(a,enemy)<(hints.range[1]||16)).length,shouldPower=hints.power==='close'?d<4.5:hints.power==='escape'?d>8:hints.power==='visible'?d<far&&a.ammo[a.weapon]>2:hints.power==='hurt'?a.health<a.maxHealth*hints.retreatHealth:hints.power==='approach'?d>9:hints.power==='cluster'?(d<7||nearby>1):d<far;
   if(!a.cooldown&&shouldPower)this.power(a);
 }else if(l>.2)a.yaw=Math.atan2(-delta.x,-delta.z);
 b.stuck+=dt;if(b.stuck>1.3){if(dist(a,b.last)<.35){b.route=[];b.destination=this.nav[Math.floor(this.random()*this.nav.length)];b.recover=.6;b.think=0;}b.last=v(a.x,a.y,a.z);b.stuck=0;}
 if(b.recover>0){b.recover-=dt;input={x:Math.sin(a.id*2+this.time),z:Math.cos(a.id*2+this.time),jump:true};}
 return input;}
  step(dt,inputs={}){if(this.over)return;this.time+=dt;
 const given=inputs.inputs||{0:inputs};
 for(const p of this.pickups)p.wait=Math.max(0,p.wait-dt);
 for(const a of this.actors){if(this.over)break;if(a.health<=0){a.dead-=dt;if(a.dead<=0)this.spawn(a);continue;}
  a.slow=Math.max(0,(a.slow||0)-dt);a.cooldown=Math.max(0,a.cooldown-dt);a.active=Math.max(0,a.active-dt);a.shotWait=Math.max(0,a.shotWait-dt);a.protection=Math.max(0,a.protection-dt);let expired=false;for(const id of Object.keys(a.powerups)){a.powerups[id]-=dt;if(a.powerups[id]<=0){delete a.powerups[id];expired=true;}}if(expired)this.refreshPowerups(a);
 const ext=given[a.id];
  if(ext){if(Number.isFinite(ext.yaw))a.yaw=ext.yaw;if(Number.isFinite(ext.pitch))a.pitch=Math.max(-1.45,Math.min(1.45,ext.pitch));if(Number.isInteger(ext.weapon)&&ext.weapon>=0&&ext.weapon<WEAPONS.length&&a.ammo[ext.weapon]>0)a.weapon=ext.weapon;}
 const controls=ext||(a.bot?this.botInput(a,dt):{});
   moveActor(a,controls,dt,this.arena,this.config);if(this.arena.voidY!==undefined&&a.y<this.arena.voidY){this.fall(a);continue;}this.objective(a);if(ext){if(ext.power)this.power(a);if(ext.fire)this.fire(a);}
 for(const p of this.pickups)if(!p.wait&&dist(a,p)<1.05)this.collect(a,p);
 }
  const alive=[];for(const r of this.rockets){const w=WEAPONS[r.weapon??1];r.life-=dt;const velocity=w.gravity?v(r.dir.x*w.speed,(r.vy??r.dir.y*w.speed)-RULES.gravity*w.gravity*dt,r.dir.z*w.speed):v(r.dir.x*w.speed,r.dir.y*w.speed,r.dir.z*w.speed);if(w.gravity)r.vy=velocity.y;const travel=Math.hypot(velocity.x,velocity.y,velocity.z)*dt,direction=norm(velocity);let range=this.rayWorld(r.pos,direction,travel),hit=null;for(const a of this.actors)if(a.id!==r.owner&&a.health>0&&(!teamMode(this.config)||a.team!==this.actors[r.owner]?.team)){const t=hitActor(r.pos,direction,a,range);if(t!==null&&t<range){range=t;hit=a;}}
   const impact=add(r.pos,direction,Math.max(0,range-.025)),floor=floorAt(impact.x,impact.z,this.arena);r.pos=impact;if(range<travel&&!hit&&w.bounce>0&&r.bounces<3&&floor!==null&&impact.y<=floor+.08){r.vy=Math.abs(r.vy)*w.bounce;r.bounces++;alive.push(r);}else if(range<travel||r.life<=0)this.explode(r,hit);else alive.push(r);}
 this.rockets=alive;if(this.time>=this.config.timeLimit)this.over=true;}
 leaders(){const max=Math.max(...this.actors.map(a=>a.frags));return this.actors.filter(a=>a.frags===max);}
  snapshot(){return {config:{...this.config},modeName:GAME_MODES.find(m=>m.id===this.config.mode).name,mapId:this.arena.id,mapName:this.arena.name,time:this.time,over:this.over,feed:this.feed,actors:this.actors.map(a=>({...a,bot:a.bot?{state:a.bot.state,route:[...a.bot.route]}:null,ammo:a.ammo.map(n=>Number.isFinite(n)?n:'∞')})),pickups:this.pickups.map(p=>({...p})),flags:Object.values(this.flags).map(f=>({...f})),teamScores:{...this.teamScores},objectives:this.config.mode==='ctf'?{nodes:this.arena.objectiveNodes||[],flags:Object.values(this.flags).map(f=>({...f}))}:null,projectiles:this.rockets.length,rockets:this.rockets.map(r=>({...r,pos:{...r.pos}})),stats:{...this.stats},leaders:this.leaders().map(a=>a.name)};}
}
