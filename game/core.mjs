import {CHARACTERS,HARNESSES,WEAPONS,RULES,resolveLoadout} from './data.mjs';
import {MAPS,getMap,pickupWeapon} from './maps.mjs';
import {normalizeConfig,DIFFICULTIES,GAME_MODES,spawnInventory,modeWeapon} from './config.mjs';
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const v=(x=0,y=0,z=0)=>({x,y,z});
const add=(a,b,s=1)=>v(a.x+b.x*s,a.y+b.y*s,a.z+b.z*s);
const norm=a=>{const l=Math.hypot(a.x,a.y,a.z)||1;return v(a.x/l,a.y/l,a.z/l)};
export const eye=a=>v(a.x,a.y+1.45,a.z);
export const aim=(yaw,pitch=0)=>v(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
export const BLOCKS=MAPS[0].blocks;
export function floorAt(x,z,arena=MAPS[0]){if(!arena.raised)return 0;if(z<=-9)return 3.8;if(Math.abs(x)>8.2&&Math.abs(x)<14&&z<3&&z>-9)return (3-z)/12*3.8;return 0;}
export function obstructed(x,y,z,r=RULES.radius,arena=MAPS[0]){return arena.blocks.some(b=>Math.abs(x-b.x)<b.w/2+r&&Math.abs(z-b.z)<b.d/2+r&&y<b.h-.15&&y+RULES.height>0);}
export function moveActor(a,input,dt,arena=MAPS[0],config={speed:1,gravity:1}){
 const speed=RULES.speed*config.speed*(a.active>0&&a.harness==='hermes'?1.6:1)*(a.slow>0?.55:1),len=Math.hypot(input.x||0,input.z||0)||1;
 let ix=(input.x||0)/Math.max(1,len),iz=(input.z||0)/Math.max(1,len);
 if(a.grounded){if(!ix&&!iz){const f=Math.max(0,1-10*dt);a.vx*=f;a.vz*=f;}a.coyote=.1;}else a.coyote=Math.max(0,a.coyote-dt);
 const accel=a.grounded?55:16;a.vx+=clamp(ix*speed-a.vx,-accel*dt,accel*dt);a.vz+=clamp(iz*speed-a.vz,-accel*dt,accel*dt);
 const horizontal=Math.hypot(a.vx,a.vz);if(horizontal>speed){const damping=Math.max(speed,horizontal-45*dt)/horizontal;a.vx*=damping;a.vz*=damping;}
 a.jumpBuffer=input.jump?.12:Math.max(0,a.jumpBuffer-dt);
 if(a.jumpBuffer>0&&a.coyote>0){a.vy=RULES.jump;a.grounded=false;a.jumpBuffer=0;a.coyote=0;}
 // Small axis moves preserve sliding and prevent fast knockback tunneling.
 const steps=Math.max(1,Math.ceil(Math.max(Math.abs(a.vx*dt),Math.abs(a.vz*dt))/.18));
 for(let i=0;i<steps;i++)for(const axis of ['x','z']){
  const value=a[axis]+a[axis==='x'?'vx':'vz']*dt/steps;
  const nx=axis==='x'?value:a.x,nz=axis==='z'?value:a.z;
  const f=floorAt(nx,nz,arena),ny=f>a.y&&f-a.y<.25&&a.vy<=0?f:a.y;
  if(!obstructed(nx,ny,nz,RULES.radius,arena)&&f-a.y<.3){a[axis]=value;if(ny>a.y)a.y=ny;}else a[axis==='x'?'vx':'vz']=0;
 }
 a.vy-=RULES.gravity*config.gravity*dt;const nextY=a.y+a.vy*dt,f=floorAt(a.x,a.z,arena);
 if(nextY<=f){a.y=f;a.vy=0;a.grounded=true;}else{a.y=nextY;a.grounded=false;}
 a.x=clamp(a.x,-13.55,13.55);a.z=clamp(a.z,-13.55,13.55);
}
function boxHit(o,d,b,max){let lo=0,hi=max;for(const k of ['x','y','z']){const c=k==='y'?b.h/2:b[k],s=k==='x'?b.w/2:k==='z'?b.d/2:b.h/2;if(Math.abs(d[k])<1e-8){if(o[k]<c-s||o[k]>c+s)return null;}else{let t1=(c-s-o[k])/d[k],t2=(c+s-o[k])/d[k];if(t1>t2)[t1,t2]=[t2,t1];lo=Math.max(lo,t1);hi=Math.min(hi,t2);if(lo>hi)return null;}}return lo;}
export function rayWorld(o,d,max=100,arena=MAPS[0]){let best=max;for(const b of arena.blocks){const t=boxHit(o,d,b,best);if(t!==null&&t<best)best=t;}
 // Analytic floor/ramp intersection by bounded ray marching, refined at first crossing.
 for(let t=.12;t<best;t+=.16){const p=add(o,d,t);if(p.y<floorAt(p.x,p.z,arena)){let lo=Math.max(0,t-.16),hi=t;for(let i=0;i<7;i++){const m=(lo+hi)/2,q=add(o,d,m);if(q.y<floorAt(q.x,q.z,arena))hi=m;else lo=m;}best=hi;break;}}
 return best;}
export function visible(a,b,arena=MAPS[0]){const delta=v(b.x-a.x,b.y-a.y,b.z-a.z),l=Math.hypot(delta.x,delta.y,delta.z);return rayWorld(a,norm(delta),l,arena)>=l-.08;}
function actorHit(o,d,a,max){return boxHit(o,d,{x:a.x,z:a.z,w:.85,d:.85,h:1.8},max);}
function hitActor(o,d,a,max){const local=v(o.x,o.y-a.y,o.z);return actorHit(local,d,a,max);}
export function walkEdge(a,b,arena=MAPS[0]){const l=dist(a,b);if(l>6.5)return false;const n=Math.max(1,Math.ceil(l/.2));let prev=a.y;for(let i=0;i<=n;i++){const x=a.x+(b.x-a.x)*i/n,z=a.z+(b.z-a.z)*i/n,y=floorAt(x,z,arena);if(Math.abs(y-prev)>.3||obstructed(x,y,z,.52,arena))return false;prev=y;}return true;}
export function navigation(arena=MAPS[0]){const nodes=[];const addNode=(x,z)=>{const y=floorAt(x,z,arena);if(!obstructed(x,y,z,.65,arena)&&!nodes.some(p=>Math.hypot(p.x-x,p.z-z)<.1))nodes.push(v(x,y,z));};for(const x of [-12,-9,-6,-3,0,3,6,9,12])for(const z of [-12,-9,-6,-3,0,3,6,9,12])addNode(x,z);if(arena.raised)for(const [x,z]of [[-1.8,-3.6],[1.8,-3.6],[-1.8,-6],[1.8,-6],[0,-7.5],[-6,-7.5],[6,-7.5]])addNode(x,z);for(const [,x,z]of arena.pickups)addNode(x,z);for(const [x,z]of arena.spawns)addNode(x,z);const edges=nodes.map((a,i)=>nodes.map((b,j)=>j!==i&&walkEdge(a,b,arena)?j:-1).filter(j=>j>=0));return {nodes,edges};}
const defaultNavigation=navigation();
export const NAV=defaultNavigation.nodes,EDGES=defaultNavigation.edges;
function nearest(p,nodes){let id=0,best=Infinity;nodes.forEach((n,i)=>{const d=dist(p,n);if(d<best){id=i;best=d;}});return id;}
function path(a,b,nodes,edges){const from=nearest(a,nodes),to=nearest(b,nodes),queue=[from],prev=new Map([[from,-1]]);while(queue.length){const n=queue.shift();if(n===to)break;for(const j of edges[n])if(!prev.has(j)){prev.set(j,n);queue.push(j);}}if(!prev.has(to))return [from];const route=[];for(let n=to;n!==-1;n=prev.get(n))route.unshift(n);return route;}
export class Match{
 visible(a,b){return visible(a,b,this.arena);}
 rayWorld(o,d,max){return rayWorld(o,d,max,this.arena);}
 constructor(character='chatgpt',harness='openclaw',random=Math.random,mapId='exchange',options={}){this.config=normalizeConfig(options);this.humanCount=Math.max(1,Math.min(Math.round(options.humanCount??1),8));this.difficulty=DIFFICULTIES.find(d=>d.id===this.config.difficulty);this.arena=getMap(mapId);const nav=navigation(this.arena);this.nav=nav.nodes;this.edges=nav.edges;this.spawns=this.arena.spawns.map(([x,z])=>v(x,floorAt(x,z,this.arena),z));this.random=random;this.time=0;this.over=false;this.events=[];this.feed=[];this.rockets=[];this.stats={shots:0,kills:0,pickups:0,powers:0,respawns:0};this.serial=0;
 this.pickups=this.arena.pickups.map(([kind,x,z],id)=>({id,kind,x,z,y:floorAt(x,z,this.arena),wait:0}));
 this.pickups=this.pickups.filter(p=>this.config.mode!=='instagib'&&(modeWeapon(this.config)===null||p.kind==='health'||p.kind==='armor'));
 this.actors=[this.actor(0,character,harness),...Array.from({length:this.humanCount-1},(_,i)=>this.actor(i+1,CHARACTERS[(CHARACTERS.findIndex(c=>c.id===character)+i+1)%CHARACTERS.length].id,HARNESSES[Math.floor(this.random()*HARNESSES.length)].id)),...Array.from({length:this.config.botCount},(_,i)=>this.actor(this.humanCount+i,CHARACTERS[(CHARACTERS.findIndex(c=>c.id===character)+this.humanCount+i)%CHARACTERS.length].id,HARNESSES[Math.floor(this.random()*HARNESSES.length)].id))];this.actors[0].name=this.config.playerName||this.actors[0].name;this.actors.forEach(a=>this.spawn(a));}
 actor(id,character,harness){const l=resolveLoadout(character,harness);return {id,...l,name:CHARACTERS.find(c=>c.id===l.character).name,frags:0,deaths:0,x:0,y:0,z:0,vx:0,vy:0,vz:0,yaw:0,pitch:0,grounded:true,coyote:0,jumpBuffer:0,health:0,armor:0,dead:0,weapon:modeWeapon(this.config)??(this.config.mode==='arsenal'?0:this.config.startingWeapon),ammo:spawnInventory(this.config),cooldown:0,active:0,slow:0,shotWait:0,protection:0,shots:0,bot:id<this.humanCount?null:{route:[],think:0,target:-1,memory:0,reaction:0,stuck:0,last:v(),state:'roam'}};}
 emit(type,data={}){this.events.push({type,id:++this.serial,time:this.time,...data});if(this.events.length>300)this.events.shift();}
 spawn(a){const others=this.actors?.filter(b=>b!==a&&b.health>0)||[];let best=-Infinity,chosen=this.spawns[0];for(const s of this.spawns){const score=(others.length?Math.min(...others.map(b=>dist(b,s))):0)+this.random()*2;if(score>best){best=score;chosen=s;}}
 Object.assign(a,{...chosen,vx:0,vy:0,vz:0,health:100,armor:0,dead:0,weapon:modeWeapon(this.config)??(this.config.mode==='arsenal'?0:this.config.startingWeapon),ammo:spawnInventory(this.config),cooldown:0,active:0,slow:0,shotWait:.25,protection:RULES.protection,grounded:true,jumpBuffer:0,coyote:0,yaw:Math.atan2(chosen.x,chosen.z),pitch:0});
 if(a.bot)a.bot={route:[],think:0,target:-1,memory:0,reaction:0,stuck:0,last:v(a.x,a.y,a.z),state:'roam'};this.stats.respawns++;this.emit('spawn',{actor:a.id,pos:v(a.x,a.y+1,a.z)});} damage(target,amount,source){if(this.over||target.health<=0||target.protection>0)return 0;let damage=(this.config.mode==='instagib'?10000:amount*this.config.damage)*(target.active>0&&target.harness==='claudecode'?.5:1);const absorb=Math.min(target.armor,damage*.6);target.armor-=absorb;damage-=absorb;const actual=Math.min(target.health,damage);target.health=Math.max(0,target.health-damage);if(this.config.lifeSteal&&source&&source!==target&&source.health>0)source.health=Math.min(100,source.health+actual*.25);this.emit('damage',{actor:target.id,source:source?.id,amount:damage});
 if(target.health<=0){target.deaths++;target.dead=this.config.respawn;target.active=0;target.cooldown=0;target.slow=0;target.vx=target.vy=target.vz=0;if(source)source.frags+=source.id===target.id?-1:1;this.stats.kills++;this.emit('death',{actor:target.id,pos:v(target.x,target.y+1,target.z),character:target.character});this.feed.unshift({killer:source?.name||'Arena',victim:target.name,self:source?.id===target.id,time:this.time});this.feed.length=Math.min(this.feed.length,5);if(source?.frags>=this.config.fragLimit)this.over=true;}return damage;}
 power(a){if(this.over||a.health<=0||a.cooldown>0||this.config.mode==='instagib')return false;const h=HARNESSES.find(h=>h.id===a.harness);a.protection=0;a.cooldown=h.cooldown*(this.config.fastPowers?.5:1);a.active=h.duration;this.stats.powers++;this.emit('power',{actor:a.id,harness:a.harness,pos:eye(a)});
 if(a.harness==='codex')a.health=Math.min(100,a.health+h.magnitude);
 if(a.harness==='cline'){const dir=aim(a.yaw,0),from={...a};for(let step=.12;step<=h.magnitude;step+=.12){const x=from.x+dir.x*step,z=from.z+dir.z*step,y=floorAt(x,z,this.arena);if(Math.abs(x)>13.5||Math.abs(z)>13.5||obstructed(x,Math.max(a.y,y),z,.48,this.arena)||y-a.y>.25)break;a.x=x;a.z=z;a.y=Math.max(a.y,y);}a.vx=a.vz=0;this.emit('dash',{from:eye(from),to:eye(a),actor:a.id});}
 if(a.harness==='roo')for(const b of this.actors)if(b!==a&&b.health>0&&!b.protection&&dist(a,b)<h.range&&this.visible(eye(a),eye(b))){b.slow=h.duration;this.emit('jam',{actor:b.id,pos:eye(b)});}
 if(a.harness==='openclaw')for(const b of this.actors){const d=dist(a,b);if(b!==a&&b.health>0&&d<h.range&&this.visible(eye(a),eye(b))){this.damage(b,h.damage,a);const dir=norm(v(b.x-a.x,0,b.z-a.z));b.vx+=dir.x*h.magnitude;b.vz+=dir.z*h.magnitude;b.vy+=4;}}return true;}
 fire(a,direction=aim(a.yaw,a.pitch)){
 if(this.over||a.health<=0||a.shotWait>0)return false;const locked=modeWeapon(this.config);if(locked!==null)a.weapon=locked;if(a.ammo[a.weapon]<=0)a.weapon=0;const w=WEAPONS[a.weapon],weapon=a.weapon;a.shotWait=w.interval*(a.active>0&&a.harness==='opencode'?.6:1)+(a.bot?this.difficulty.fireDelay:0);a.ammo[weapon]--;a.protection=0;this.stats.shots++;a.shots++;
 for(let pellet=0;pellet<(w.pellets||1);pellet++){
 const o=eye(a),d=norm(w.pellets?add(direction,v((this.random()-.5)*w.spread,(this.random()-.5)*w.spread,(this.random()-.5)*w.spread)):direction);let range=this.rayWorld(o,d,w.range),target=null;for(const b of this.actors)if(b!==a&&b.health>0){const t=hitActor(o,d,b,range);if(t!==null&&t<range){range=t;target=b;}}
 const goal=add(o,d,range),side=aim(a.yaw-Math.PI/2,0),muzzle=add(add(o,side,.24),d,.42);muzzle.y-=.24;
 const md=norm(v(muzzle.x-o.x,muzzle.y-o.y,muzzle.z-o.z)),ml=dist(o,muzzle),muzzleBlocked=this.rayWorld(o,md,ml)<ml-.01;
 if(muzzleBlocked){this.emit('shot',{actor:a.id,weapon,from:o,to:add(o,md,this.rayWorld(o,md,ml))});continue;}
 const trajectory=norm(v(goal.x-muzzle.x,goal.y-muzzle.y,goal.z-muzzle.z)),travel=dist(muzzle,goal),block=this.rayWorld(muzzle,trajectory,travel);
 if(w.speed){this.rockets.push({id:++this.serial,owner:a.id,weapon,pos:muzzle,dir:trajectory,life:4});this.emit('launch',{actor:a.id,weapon,pos:muzzle});}
 else{if(target&&block>=travel-.1)this.damage(target,w.damage,a);this.emit('shot',{actor:a.id,weapon,from:muzzle,to:add(muzzle,trajectory,Math.min(block,travel)),hit:target&&block>=travel-.1});}
 }return true;}
 explode(r,hit){const source=this.actors[r.owner],w=WEAPONS[r.weapon??1];if(hit)this.damage(hit,w.damage,source);for(const a of this.actors){const p=eye(a),d=dist(r.pos,p);if(a.health>0&&d<w.radius&&this.visible(r.pos,p)){this.damage(a,w.splash*(1-d/w.radius),source);const n=norm(v(a.x-r.pos.x,.5,a.z-r.pos.z));a.vx+=n.x*8;a.vz+=n.z*8;a.vy+=4;}}this.emit('explosion',{pos:{...r.pos},weapon:r.weapon??1});}
 useful(a,p){if(this.config.mode==='instagib'||modeWeapon(this.config)!==null&&pickupWeapon(p.kind)!==undefined)return false;return p.kind==='health'?a.health<100:p.kind==='armor'?a.armor<100:a.ammo[pickupWeapon(p.kind)]<WEAPONS[pickupWeapon(p.kind)].cap;}
 collect(a,p){if(!this.useful(a,p))return false;if(p.kind==='health')a.health=Math.min(100,a.health+35);else if(p.kind==='armor')a.armor=Math.min(100,a.armor+40);else{const n=pickupWeapon(p.kind);a.ammo[n]=this.config.unlimitedAmmo?Infinity:Math.min(WEAPONS[n].cap,a.ammo[n]+WEAPONS[n].ammo);if(a.weapon===0)a.weapon=n;}p.wait=p.kind==='health'||p.kind==='armor'?12:15;this.stats.pickups++;this.emit('pickup',{actor:a.id,kind:p.kind});return true;}
 botInput(a,dt){const b=a.bot;b.think-=dt;b.memory=Math.max(0,b.memory-dt);b.reaction=Math.max(0,b.reaction-dt);
 if(b.think<=0){b.think=this.difficulty.think+this.random()*.15;const candidates=this.actors.filter(t=>t!==a&&t.health>0&&dist(a,t)<25&&this.visible(eye(a),eye(t))).sort((c,d)=>dist(a,c)-dist(a,d));const target=candidates[0];if(target){if(b.target!==target.id)b.reaction=this.difficulty.reaction+this.random()*.25;b.target=target.id;b.memory=1.5;b.seen={x:target.x,y:target.y,z:target.z};}else if(!b.memory)b.target=-1;
 const supply=this.pickups.filter(p=>!p.wait&&this.useful(a,p)).sort((c,d)=>(dist(a,c)-(c.kind==='health'&&a.health<55?20:0))-(dist(a,d)-(d.kind==='health'&&a.health<55?20:0)))[0];
 const needs=supply&&(a.health<55&&supply.kind==='health'||a.ammo.slice(1).every(n=>n===0)||b.target<0);
 if(needs){b.state='seek';b.destination=supply;}else if(target){b.state='engage';b.destination={x:target.x,y:target.y,z:target.z};}else if(b.memory){b.state='pursue';b.destination=b.seen;}else{b.state='roam';if(!b.destination||dist(a,b.destination)<1.5)b.destination=this.nav[Math.floor(this.random()*this.nav.length)];}
 if(b.destination){b.route=path(a,b.destination,this.nav,this.edges);if(b.route.length>1&&dist(a,this.nav[b.route[0]])<2)b.route.shift();}
 }
 const t=this.actors[b.target],canSee=t&&t.health>0&&b.memory>0&&dist(a,t)<25&&this.visible(eye(a),eye(t));let dest=b.route.length?this.nav[b.route[0]]:b.destination||a;
 if(dist(a,dest)<.8&&b.route.length){b.route.shift();dest=b.route.length?this.nav[b.route[0]]:b.destination||a;}
 if(b.destination&&walkEdge(a,b.destination,this.arena))dest=b.destination;
 let delta=v(dest.x-a.x,0,dest.z-a.z),l=Math.hypot(delta.x,delta.z);let input=l>.4?{x:delta.x/l,z:delta.z/l}:{};
 if(canSee){const d=dist(a,t);if(b.state==='engage'&&d<17&&Math.abs(t.y-a.y)<1.5){const toward=norm(v(t.x-a.x,0,t.z-a.z)),side=Math.sin(this.time*1.8+a.id)>0?1:-1;input={x:toward.x*(d>10?.5:d<4?-.8:0)+toward.z*side*.75,z:toward.z*(d>10?.5:d<4?-.8:0)-toward.x*side*.75};}
 a.weapon=modeWeapon(this.config)??(d<8&&a.ammo[3]>0?3:d>14&&a.ammo[2]>0?2:d>5&&d<16&&a.ammo[1]>0?1:a.ammo[4]>0?4:0);
 const lead=WEAPONS[a.weapon].speed?d/WEAPONS[a.weapon].speed:0,err=this.difficulty.error*(1+this.random()*.89);const dir=norm(v(t.x+t.vx*lead-a.x+(this.random()-.5)*d*err,t.y+1.1-(a.y+1.45)+(this.random()-.5)*d*err,t.z+t.vz*lead-a.z+(this.random()-.5)*d*err));a.yaw=Math.atan2(-dir.x,-dir.z);a.pitch=Math.asin(dir.y);
 if(!b.reaction)this.fire(a,dir);
 if(!a.cooldown&&(a.harness==='openclaw'?d<4.5:a.harness==='claudecode'?a.health<70:a.harness==='hermes'?d>8:a.harness==='codex'?a.health<65:a.harness==='roo'?d<7:a.harness==='cline'?d>9:true))this.power(a);
 }else if(l>.2)a.yaw=Math.atan2(-delta.x,-delta.z);
 b.stuck+=dt;if(b.stuck>1.3){if(dist(a,b.last)<.35){b.route=[];b.destination=this.nav[Math.floor(this.random()*this.nav.length)];b.recover=.6;b.think=0;}b.last=v(a.x,a.y,a.z);b.stuck=0;}
 if(b.recover>0){b.recover-=dt;input={x:Math.sin(a.id*2+this.time),z:Math.cos(a.id*2+this.time),jump:true};}
 return input;}
 step(dt,inputs={}){if(this.over)return;this.time+=dt;
 const given=inputs.inputs||{0:inputs};
 for(const p of this.pickups)p.wait=Math.max(0,p.wait-dt);
 for(const a of this.actors){if(this.over)break;if(a.health<=0){a.dead-=dt;if(a.dead<=0)this.spawn(a);continue;}
 a.slow=Math.max(0,(a.slow||0)-dt);a.cooldown=Math.max(0,a.cooldown-dt);a.active=Math.max(0,a.active-dt);a.shotWait=Math.max(0,a.shotWait-dt);a.protection=Math.max(0,a.protection-dt);
 const ext=given[a.id];
 if(ext){if(Number.isFinite(ext.yaw))a.yaw=ext.yaw;if(Number.isFinite(ext.pitch))a.pitch=Math.max(-1.45,Math.min(1.45,ext.pitch));if(Number.isInteger(ext.weapon)&&ext.weapon>=0&&ext.weapon<WEAPONS.length&&a.ammo[ext.weapon]>0)a.weapon=ext.weapon;}
 const controls=ext||(a.bot?this.botInput(a,dt):{});
 moveActor(a,controls,dt,this.arena,this.config);if(ext){if(ext.power)this.power(a);if(ext.fire)this.fire(a);}
 for(const p of this.pickups)if(!p.wait&&dist(a,p)<1.05)this.collect(a,p);
 }
 const alive=[];for(const r of this.rockets){r.life-=dt;const len=WEAPONS[r.weapon??1].speed*dt;let range=this.rayWorld(r.pos,r.dir,len),hit=null;for(const a of this.actors)if(a.id!==r.owner&&a.health>0){const t=hitActor(r.pos,r.dir,a,range);if(t!==null&&t<range){range=t;hit=a;}}
 r.pos=add(r.pos,r.dir,Math.max(0,range-.025));if(range<len||r.life<=0)this.explode(r,hit);else alive.push(r);}
 this.rockets=alive;if(this.time>=this.config.timeLimit)this.over=true;}
 leaders(){const max=Math.max(...this.actors.map(a=>a.frags));return this.actors.filter(a=>a.frags===max);}
 snapshot(){return {config:{...this.config},modeName:GAME_MODES.find(m=>m.id===this.config.mode).name,mapId:this.arena.id,mapName:this.arena.name,time:this.time,over:this.over,feed:this.feed, actors:this.actors.map(a=>({...a,bot:a.bot?{state:a.bot.state,route:[...a.bot.route]}:null,ammo:a.ammo.map(n=>Number.isFinite(n)?n:'∞')})),pickups:this.pickups.map(p=>({...p})),projectiles:this.rockets.length,rockets:this.rockets.map(r=>({...r,pos:{...r.pos}})),stats:{...this.stats},leaders:this.leaders().map(a=>a.name)};}
}
