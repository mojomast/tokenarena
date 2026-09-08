import * as T from 'three';
import {WEAPONS} from './data.mjs';

// Presentation only: these offsets must never be applied to the aiming camera.
const KICKS=WEAPONS.map(w=>w.feel?.kick||[.04,.04,16]);
export class WeaponFeedback{
 constructor(){this.reset();}
 reset(){this.kick=0;this.landing=0;this.phase=0;this.bob=0;this.sway=0;this.grounded=undefined;this.vy=0;this.weapon=-1;this.lastShot=null;}
 shot(weapon,stamp){if(stamp!=null&&stamp===this.lastShot&&weapon===this.weapon)return;this.lastShot=stamp;this.weapon=weapon;this.kick=Math.min(1.4,this.kick+1);}
 update(player,dt,reduced=false,visible=true){dt=Math.max(0,Math.min(dt||0,.1));const profile=KICKS[player.weapon]||KICKS[0];
  if(this.weapon!==player.weapon){this.kick=0;this.weapon=player.weapon;}
  if(this.grounded===false&&player.grounded)this.landing=Math.min(.035,Math.max(0,-this.vy)*.003);
  this.grounded=player.grounded;this.vy=player.vy||0;
  this.kick*=Math.exp(-profile[2]*dt);this.landing*=Math.exp(-14*dt);
  const speed=Math.min(1,Math.hypot(player.vx||0,player.vz||0)/7),blend=1-Math.exp(-12*dt);
  this.phase+=dt*10*speed;this.bob+=((player.grounded?speed:0)-this.bob)*blend;
  const lateral=(player.vx||0)*Math.cos(player.yaw||0)-(player.vz||0)*Math.sin(player.yaw||0);
  this.sway+=(Math.max(-.012,Math.min(.012,-lateral*.002))-this.sway)*blend;
  if(reduced||!visible){this.kick=0;this.landing=0;this.bob=0;this.sway=0;return {x:0,y:0,z:0,pitch:0,roll:0};}
  return {x:Math.sin(this.phase)*.007*this.bob+this.sway,y:Math.cos(this.phase*2)*.006*this.bob-this.landing,z:this.kick*profile[0],pitch:this.kick*profile[1],roll:this.sway*.7};
 }
}

// Fixed-size reusable slots: bursts and pellets cannot grow GPU resources.
export class EffectPool{
  constructor(scene,limit=96){this.scene=scene;this.limit=limit;this.slots=[];this.serial=0;this.line=new T.CylinderGeometry(.5,.5,1,6).rotateX(Math.PI/2).translate(0,0,.5);this.sphere=new T.IcosahedronGeometry(1,0);this.axis=new T.Vector3(0,0,1);this.direction=new T.Vector3();}
 add({from,to,pos,color,life=.15,size=.08,expand=0,velocity=null,wireframe=false}){
  const line=!!from;let slot=this.slots.find(s=>!s.active&&s.line===line);
   if(!slot&&this.slots.length<this.limit){const mat=new T.MeshBasicMaterial({transparent:true,depthWrite:false});const obj=new T.Mesh(line?this.line:this.sphere,mat);slot={obj,line};this.slots.push(slot);this.scene.add(obj);}
  if(!slot){slot=this.slots.filter(s=>s.line===line).sort((a,b)=>a.serial-b.serial)[0];if(!slot)return;}
  const obj=slot.obj;obj.visible=true;obj.material.color.set(color);obj.material.opacity=.8;obj.material.wireframe=wireframe;obj.rotation.set(0,0,0);
   if(line){obj.position.copy(from);this.direction.subVectors(to,from);obj.scale.set(size,size,this.direction.length());obj.quaternion.setFromUnitVectors(this.axis,this.direction.normalize());}
  else{obj.position.copy(pos);obj.scale.setScalar(size);}
  Object.assign(slot,{active:true,serial:++this.serial,life,total:life,expand,velocity});return obj;
 }
 update(dt){for(const s of this.slots){if(!s.active)continue;s.life-=dt;if(s.life<=0){s.active=false;s.obj.visible=false;continue;}s.obj.material.opacity=.8*s.life/s.total;if(s.expand)s.obj.scale.addScalar(dt*s.expand);if(s.velocity){s.obj.position.addScaledVector(s.velocity,dt);s.velocity.y-=15*dt;}}}
 clear(){for(const s of this.slots){s.active=false;s.obj.visible=false;}}
 dispose(){for(const s of this.slots){this.scene.remove(s.obj);s.obj.material.dispose();}this.slots=[];this.line.dispose();this.sphere.dispose();}
}

const REPORTS=[[320,.075,'square',65],[110,.2,'sawtooth',28],[1500,.16,'sine',180],[180,.13,'triangle',35],[620,.09,'triangle',250],[210,.18,'sawtooth',45],[480,.1,'square',1100],[95,.22,'triangle',30]];
export class SynthAudio{
 constructor(){this.ctx=null;this.muted=false;this.voices=new Set();this.lastDamage=null;this.lastReport=null;this.lastHit=-Infinity;}
  start(){try{const Context=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Context)return;this.ctx??=new Context();if(this.ctx.state==='suspended')this.ctx.resume();}catch{}}
 tone(freq,duration=.08,type='sine',gain=.04,end=0){if(!this.ctx||this.muted||this.voices.size>=24)return;const now=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain(),voice={o,g};this.voices.add(voice);o.type=type;o.frequency.setValueAtTime(freq,now);if(end)o.frequency.exponentialRampToValueAtTime(end,now+duration);g.gain.setValueAtTime(.001,now);g.gain.linearRampToValueAtTime(gain,now+.004);g.gain.exponentialRampToValueAtTime(.001,now+duration);o.connect(g);g.connect(this.ctx.destination);o.onended=()=>{o.disconnect();g.disconnect();this.voices.delete(voice);};o.start(now);o.stop(now+duration);}
 event(e,player){if(!player)return;const local=e.actor===player.id,previous=this.lastDamage;this.lastDamage=e.type==='damage'?e:null;
    if(e.type==='shot'||e.type==='vehicle-shot'||e.type==='launch'){
    const same=this.lastReport&&e.time!=null&&this.lastReport.time===e.time&&this.lastReport.actor===e.actor&&this.lastReport.weapon===e.weapon&&this.lastReport.type===e.type;this.lastReport=e;
   const p=e.from??e.pos,distance=p?Math.hypot(p.x-player.x,p.z-player.z):Infinity;
    const feel=WEAPONS[e.weapon]?.feel||{};const [freq,duration,type,end]=(e.type==='launch'?feel.launch:feel.shot)||REPORTS[e.weapon]||REPORTS[0];
    if(!same&&(local||distance<20)){this.tone(freq,duration,type,local?.032:.012*(1-distance/20),end);}
   }
   if(e.type==='dryfire'&&local)this.tone(170,.055,'square',.018,95);
   if(e.type==='explosion'){const p=e.pos,d=p?Math.hypot(p.x-player.x,p.z-player.z):Infinity;const [freq,duration,type,end]=WEAPONS[e.weapon]?.feel?.impact||[80,.25,'sawtooth',25];if(d<24)this.tone(freq,duration,type,.025*(1-d/24),end);}
  if(e.type==='damage'&&e.source===player.id&&!local&&e.amount>0){const now=this.ctx?.currentTime??0;if(now-this.lastHit>=.045){this.tone(1050,.055,'sine',.022,1500);this.lastHit=now;}}
  // Core emits lethal damage immediately before death; do not infer kills from shots.
  if(e.type==='death'&&!local&&previous?.actor===e.actor&&previous.source===player.id&&previous.amount>0&&previous.time===e.time&&(e.id==null||previous.id===e.id-1))this.tone(1500,.16,'sine',.03,2200);
  if(local){if(e.type==='pickup'){const pickup={rocket:1,rail:2,scatter:3,plasma:4,grenade:5,shock:6,flak:7}[e.kind],cue=WEAPONS[pickup]?.feel?.shot;this.tone(cue?.[0]||700,.14,'sine',.035,cue?.[3]||1300);}if(e.type==='damage')this.tone(120,.1,'triangle',.045,40);if(e.type==='power')this.tone(250,.3,'sine',.04,1000);if(e.type==='death')this.tone(200,.45,'sawtooth',.03,30);}
 }
 dispose(){for(const {o,g} of this.voices){o.onended=null;try{o.stop();}catch{}o.disconnect();g.disconnect();}this.voices.clear();this.ctx?.close();this.ctx=null;}
}
