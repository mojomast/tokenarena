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
// Per-weapon synthesis family: rifle snap, heavy thump, electric zap, wide burst.
const GUN_STYLES=['rifle','heavy','zap','burst','plasma','heavy','zap','burst'];
const cl=(n,a,b)=>Math.max(a,Math.min(b,n));

// Layered Web Audio synth: filtered noise transients + tonal bodies, distance
// falloff and stereo panning, plus footsteps, landing thuds and a Warthog engine.
export class SynthAudio{
 constructor(){this.ctx=null;this.muted=false;this.voices=new Set();this.noiseBuffer=null;this.master=null;this.lastDamage=null;this.lastReport=null;this.lastHit=-Infinity;this.footPhase=0;this.wasGrounded=undefined;this.lastVy=0;this.engine=null;}
  start(){try{const Context=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Context)return;this.ctx??=new Context();if(this.ctx.state==='suspended')this.ctx.resume();if(!this.master){this.master=this.ctx.createGain();this.master.gain.value=.9;this.master.connect(this.ctx.destination);}this.noiseBuffer??=this._makeNoise();}catch{}}
  _makeNoise(){const ctx=this.ctx,length=Math.max(1,Math.floor(ctx.sampleRate)),buffer=ctx.createBuffer(1,length,ctx.sampleRate),data=buffer.getChannelData(0);let last=0;for(let i=0;i<length;i++){const white=Math.random()*2-1;last=(last+.02*white)/1.02;data[i]=white*.75+last*.5;}return buffer;}
  _dest(pan){const out=this.ctx.createStereoPanner?this.ctx.createStereoPanner():this.ctx.createGain();if(out.pan)out.pan.value=cl(pan||0,-1,1);out.connect(this.master);return out;}
  _play(duration,pan,build){if(!this.ctx||this.muted||this.voices.size>=30)return;const t=this.ctx.currentTime,out=this._dest(pan),nodes=[out],token={nodes};build(t,out,nodes);this.voices.add(token);token.timer=setTimeout(()=>{for(const n of nodes){try{n.disconnect();}catch{}}this.voices.delete(token);},Math.max(30,(duration+.15)*1000));}
  _noise(t,out,nodes,{duration=.08,gain=.1,type='bandpass',freq=800,q=1,sweep=null,attack=.002}){const src=this.ctx.createBufferSource();src.buffer=this.noiseBuffer;src.loop=true;const f=this.ctx.createBiquadFilter();f.type=type;f.frequency.setValueAtTime(Math.max(30,freq),t);f.Q.value=q;if(sweep)f.frequency.exponentialRampToValueAtTime(Math.max(30,sweep),t+duration);const g=this.ctx.createGain();g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(Math.max(.0002,gain),t+attack);g.gain.exponentialRampToValueAtTime(.0001,t+duration);src.connect(f);f.connect(g);g.connect(out);src.start(t);src.stop(t+duration+.03);nodes.push(src,f,g);}
  _tone(t,out,nodes,{freq,duration=.08,type='sine',gain=.05,end=0,attack=.003}){const o=this.ctx.createOscillator();o.type=type;o.frequency.setValueAtTime(Math.max(20,freq),t);if(end)o.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+duration);const g=this.ctx.createGain();g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(Math.max(.0002,gain),t+attack);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(out);o.start(t);o.stop(t+duration+.03);nodes.push(o,g);}
 tone(freq,duration=.08,type='sine',gain=.04,end=0){this._play(duration,0,(t,out,nodes)=>this._tone(t,out,nodes,{freq,duration,type,gain,end,attack:.006}));}
  _panFor(pos,player){if(!pos||!player||!Number.isFinite(pos.x)||!Number.isFinite(player.x))return 0;const dx=pos.x-(player.x||0),dz=pos.z-(player.z||0),dist=Math.hypot(dx,dz)||1,rx=Math.cos(player.yaw||0),rz=-Math.sin(player.yaw||0);return cl((dx*rx+dz*rz)/dist*.9,-1,1);}
  _falloff(pos,player,max=36){if(!pos||!Number.isFinite(pos.x))return 0;if(!player||!Number.isFinite(player.x))return 1;return Math.max(0,1-Math.hypot(pos.x-(player.x||0),pos.z-(player.z||0))/max);}
  _click(pan,vol=1,gain=.06,freq=1600){this._play(.09,pan,(t,out,nodes)=>{this._noise(t,out,nodes,{duration:.03,gain:gain*vol,type:'highpass',freq:900,sweep:freq});this._tone(t,out,nodes,{freq:freq*.8,duration:.03,type:'square',gain:.02*vol,end:200});});}
  _gunshot(e,local,pan,vol){const feel=WEAPONS[e.weapon]?.feel||{},s=e.type==='launch'?feel.launch:feel.shot,style=GUN_STYLES[e.weapon]||'rifle',[freq,duration,type,gain]=s||REPORTS[e.weapon]||REPORTS[0],d=cl((duration||.08)*1.5,.06,.3);this._play(d+.05,pan,(t,out,nodes)=>{this._noise(t,out,nodes,{duration:.05,gain:.55*vol,type:style==='heavy'?'lowpass':'highpass',freq:style==='heavy'?Math.max(80,(freq||300)*.9):(freq||320)*1.5,sweep:style==='heavy'?160:(freq||320)*.6});this._tone(t,out,nodes,{freq:freq||320,duration:Math.min(.14,d*.8),type:type||'square',gain:Math.min(.3,(gain||.05)*vol*3.2),end:style==='zap'?(freq||320)*2.2:Math.max(40,(freq||320)*.55)});this._tone(t,out,nodes,{freq:Math.max(60,(freq||320)*.45),duration:Math.min(.2,d),type:'sine',gain:.16*vol,end:50});if(style==='burst')this._noise(t,out,nodes,{duration:.12,gain:.3*vol,type:'lowpass',freq:1200,sweep:500,q:.6});if(style==='plasma')this._tone(t,out,nodes,{freq:260,duration:.16,type:'triangle',gain:.14*vol,end:1200});});}
  // Mounted chaingun: a heavier, layered thump so it reads differently from the
  // pulse rifle. Slight per-shot pitch wobble gives the spinning-barrel texture.
  _chaingun(pan,vol=1){if(!this.ctx)return;const now=this.ctx.currentTime;if(now-(this.lastChain||0)<.03)return;this.lastChain=now;const pitch=.92+Math.random()*.18;this._play(.11,pan,(t,out,nodes)=>{this._noise(t,out,nodes,{duration:.05,gain:.62*vol,type:'lowpass',freq:1500*pitch,sweep:320,q:.85,attack:.001});this._noise(t,out,nodes,{duration:.028,gain:.34*vol,type:'highpass',freq:2600*pitch,sweep:5600,q:.6,attack:.001});this._tone(t,out,nodes,{freq:150*pitch,duration:.06,type:'square',gain:.22*vol,end:58});this._tone(t,out,nodes,{freq:66*pitch,duration:.11,type:'sine',gain:.26*vol,end:34});});}
 event(e,player){if(!this.ctx||!e||!player)return;const local=e.actor===player.id,pos=e.from??e.pos,pan=this._panFor(pos,player);
  if(e.type==='shot'||e.type==='vehicle-shot'||e.type==='launch'){const same=this.lastReport&&e.time!=null&&this.lastReport.time===e.time&&this.lastReport.actor===e.actor&&this.lastReport.weapon===e.weapon&&this.lastReport.type===e.type;this.lastReport=e;if(same)return;const vehicle=e.type==='vehicle-shot',vol=local?1:this._falloff(pos,player,vehicle?42:34)*(vehicle?.95:.9);if(vol>.01){if(vehicle)this._chaingun(pan,vol);else this._gunshot(e,local,pan,vol);}return;}
  if(e.type==='dryfire'){if(local)this._click(0,1,.08,1500);return;}
  if(e.type==='explosion'){const vol=this._falloff(pos,player,42);if(vol>.02)this._play(.7,pan,(t,out,nodes)=>{this._noise(t,out,nodes,{duration:.5,gain:.8*vol,type:'lowpass',freq:900,sweep:60,q:.8});this._tone(t,out,nodes,{freq:120,duration:.5,type:'sine',gain:.35*vol,end:34});this._tone(t,out,nodes,{freq:60,duration:.7,type:'sine',gain:.3*vol,end:28});});return;}
  if(e.type==='damage'){const previous=this.lastDamage;this.lastDamage=e;if(e.actor===player.id){this._play(.18,0,(t,out,nodes)=>{this._noise(t,out,nodes,{duration:.14,gain:.4,type:'lowpass',freq:700,sweep:200,q:.7});this._tone(t,out,nodes,{freq:150,duration:.14,type:'triangle',gain:.18,end:60});});}else if(e.source===player.id&&e.amount>0){const stamp=this.ctx.currentTime;if(stamp-this.lastHit>=.045){this.lastHit=stamp;this._play(.12,0,(t,out,nodes)=>{this._noise(t,out,nodes,{duration:.05,gain:.26,type:'highpass',freq:1600,sweep:2600});this._tone(t,out,nodes,{freq:1250,duration:.07,type:'sine',gain:.11,end:1800});});}}return;}
  if(e.type==='death'){const vol=local?1:this._falloff(pos,player,32);if(vol>.02)this._play(.55,pan,(t,out,nodes)=>{this._noise(t,out,nodes,{duration:.4,gain:.35*vol,type:'lowpass',freq:1200,sweep:120,q:.7});this._tone(t,out,nodes,{freq:local?220:180,duration:.45,type:'sawtooth',gain:.12*vol,end:40});});return;}
  if(e.type==='reload'){if(e.actor===player.id){this._click(0,1,.06,1200);if(e.state==='start')setTimeout(()=>{if(this.ctx&&!this.muted)this._click(0,1,.05,1750);},230);}return;}
  if(e.type==='weapon-switch'){if(e.actor===player.id)this._click(0,1,.05,1900);return;}
  if(e.type==='vehicle-splatter'){const vol=local?1:this._falloff(pos,player,26);if(vol>.02)this._play(.2,pan,(t,out,nodes)=>{this._noise(t,out,nodes,{duration:.16,gain:.5*vol,type:'lowpass',freq:600,sweep:180,q:.8});this._tone(t,out,nodes,{freq:95,duration:.16,type:'sine',gain:.2*vol,end:40});});return;}
  if(e.type==='pickup'||e.type==='powerup'||e.type==='power'||e.type==='spawn'||e.type.startsWith('flag')||e.type==='capture'||e.type.startsWith('zone')){if(!local&&e.type!=='capture'&&e.type!=='flag-pickup'&&e.type!=='flag-drop'&&e.type!=='flag-return')return;const pair=e.type==='pickup'?[520,780]:e.type==='powerup'?[440,880]:e.type==='spawn'?[300,300]:[300,660];this._play(.34,pan,(t,out,nodes)=>{this._tone(t,out,nodes,{freq:pair[0],duration:.2,type:'sine',gain:.08,end:pair[1]});this._tone(t+.06,out,nodes,{freq:pair[1]*1.5,duration:.18,type:'triangle',gain:.05,end:pair[1]});});return;}
 }
  update(player,vehicles=[],dt=0){if(!this.ctx||!player)return;if(this.muted){this._engine(0,false);return;}
  if(player.grounded&&this.wasGrounded===false&&player.vehicleId==null){const impact=cl(Math.abs(this.lastVy||0)/13,0,1);if(impact>.12)this._play(.14,0,(t,out,nodes)=>{this._noise(t,out,nodes,{duration:.1,gain:.05+.16*impact,type:'lowpass',freq:420,sweep:160,q:.8});this._tone(t,out,nodes,{freq:90,duration:.12,type:'sine',gain:.05+.1*impact,end:45});});}
  this.wasGrounded=player.grounded;this.lastVy=player.vy||0;
  const speed=Math.hypot(player.vx||0,player.vz||0),walking=player.health>0&&player.vehicleId==null&&player.grounded===true&&speed>1.4;
  if(walking){this.footPhase=(this.footPhase||0)+dt*speed*.62;if(this.footPhase>=1){this.footPhase-=1;const vol=Math.min(.13,.03+speed*.012);this._play(.09,0,(t,out,nodes)=>{this._noise(t,out,nodes,{duration:.06,gain:vol,type:'lowpass',freq:800+Math.min(700,speed*45),sweep:360,q:.9});this._tone(t,out,nodes,{freq:110,duration:.05,type:'sine',gain:vol*.5,end:60});});}}else this.footPhase=0;
  const vehicle=(vehicles||[]).find(v=>v.id===player.vehicleId||v.driver===player.id),vx=vehicle?(vehicle.vx??vehicle.velocity?.x??0):0,vz=vehicle?(vehicle.vz??vehicle.velocity?.z??0):0;
  this._engine(vehicle?Math.hypot(vx,vz):0,Boolean(vehicle));}
 _engine(speed,active){if(!this.ctx)return;if(active&&!this.muted){if(!this.engine){const osc=this.ctx.createOscillator(),sub=this.ctx.createOscillator(),f=this.ctx.createBiquadFilter(),g=this.ctx.createGain();osc.type='sawtooth';sub.type='triangle';f.type='lowpass';f.frequency.value=700;g.gain.value=.0001;osc.connect(f);sub.connect(f);f.connect(g);g.connect(this.master);osc.start();sub.start();this.engine={osc,sub,f,g};}const s=cl(speed/20,0,1),t=this.ctx.currentTime;this.engine.osc.frequency.setTargetAtTime(55+s*120,t,.1);this.engine.sub.frequency.setTargetAtTime(28+s*40,t,.1);this.engine.g.gain.setTargetAtTime(.022+s*.05,t,.12);this.engine.f.frequency.setTargetAtTime(500+s*1200,t,.15);}else if(this.engine){const {osc,sub,g}=this.engine,t=this.ctx.currentTime;g.gain.setTargetAtTime(.0001,t,.08);this.engine=null;setTimeout(()=>{try{osc.stop();sub.stop();}catch{}},300);}}
 dispose(){if(this.engine){try{this.engine.osc.stop();this.engine.sub.stop();}catch{}this.engine=null;}for(const token of this.voices){clearTimeout(token.timer);for(const n of token.nodes){try{n.disconnect();}catch{}}}this.voices.clear();try{this.master?.disconnect();}catch{}this.master=null;this.ctx?.close();this.ctx=null;}
}
