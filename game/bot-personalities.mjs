import {operatorProfile} from './operator-profiles.mjs';
import {harnessBotHints} from './harness-profiles.mjs';

const clamp=(v,lo,hi)=>v<lo?lo:v>hi?hi:v;
const freeze=value=>Object.freeze(value);
const blend=(a,b,w=.55)=>a*w+b*(1-w);

const ROLE_ARCHETYPES=freeze({
 adaptive:  {label:'ADAPTIVE', aggression:.52, hold:.35, flank:.4,  objective:.55, supply:.5,  vehicle:.4,  strafe:.8,  range:[6,18], spacing:2.4},
 anchor:    {label:'ANCHOR',   aggression:.28, hold:.85, flank:.15, objective:.78, supply:.55, vehicle:.3,  strafe:.6,  range:[5,14], spacing:2.1},
 disruptor: {label:'DISRUPTOR',aggression:.88, hold:.18, flank:.5,  objective:.5,  supply:.4,  vehicle:.5,  strafe:.98, range:[4,12], spacing:2.8},
 connector: {label:'CONNECTOR',aggression:.45, hold:.55, flank:.35, objective:.62, supply:.72, vehicle:.42, strafe:.7,  range:[7,18], spacing:1.9},
 duelist:   {label:'DUELIST',  aggression:.72, hold:.25, flank:.45, objective:.32, supply:.35, vehicle:.4,  strafe:1,   range:[5,15], spacing:2.5},
 ambusher:  {label:'AMBUSHER', aggression:.55, hold:.5,  flank:.72, objective:.38, supply:.45, vehicle:.3,  strafe:.55, range:[3,11], spacing:3},
 flanker:   {label:'FLANKER',  aggression:.72, hold:.22, flank:.92, objective:.45, supply:.4,  vehicle:.5,  strafe:1.05,range:[5,14], spacing:2.7},
 orbiter:   {label:'ORBITER',  aggression:.5,  hold:.45, flank:.5,  objective:.42, supply:.5,  vehicle:.35, strafe:1.15,range:[9,20], spacing:3.2},
 optimizer: {label:'OPTIMIZER',aggression:.55, hold:.5,  flank:.4,  objective:.62, supply:.8,  vehicle:.55, strafe:.75, range:[7,19], spacing:2.6},
});

const PERSONALITY_ARCHETYPES=freeze({
 brawler:    {label:'BRAWLER',    aggression:.9,  hold:.2,  flank:.35, objective:.45, supply:.3,  vehicle:.35, strafe:.85, range:[3,9],  spacing:2.6},
 skirmisher: {label:'SKIRMISHER', aggression:.6,  hold:.4,  flank:.45, objective:.5,  supply:.45, vehicle:.45, strafe:.95, range:[8,18], spacing:2.6},
 suppressor: {label:'SUPPRESSOR', aggression:.35, hold:.75, flank:.3,  objective:.55, supply:.5,  vehicle:.3,  strafe:.7,  range:[9,22], spacing:3},
 sentinel:   {label:'SENTINEL',   aggression:.25, hold:.9,  flank:.2,  objective:.7,  supply:.55, vehicle:.25, strafe:.6,  range:[7,18], spacing:2.4},
 opportunist:{label:'OPPORTUNIST',aggression:.5,  hold:.55, flank:.5,  objective:.5,  supply:.6,  vehicle:.35, strafe:.7,  range:[10,24],spacing:3},
 flanker:    {label:'FLANKER',    aggression:.75, hold:.25, flank:.9,  objective:.45, supply:.4,  vehicle:.5,  strafe:1.05,range:[5,14], spacing:2.8},
 controller: {label:'CONTROLLER', aggression:.5,  hold:.6,  flank:.35, objective:.6,  supply:.5,  vehicle:.4,  strafe:.8,  range:[6,15], spacing:3.2},
});

const DEFAULT=ROLE_ARCHETYPES.adaptive;
const TAU=Math.PI*2;

export function botNoise(id,salt=0){
 const seed=Math.imul((Number.isFinite(id)?id|0:0)+1,2654435761)+Math.imul(salt|0,40503);
 let n=seed>>>0;
 n=Math.imul(n^(n>>>15),2246822519)>>>0;
 n=Math.imul(n^(n>>>13),3266489917)>>>0;
 return (n>>>0)/4294967296;
}

export function botBehavior(actor){
 const character=actor?.character,harness=actor?.harness,id=Number.isFinite(actor?.id)?actor.id:0;
 const role=operatorProfile(character)?.role;
 const hints=harnessBotHints(harness);
 const personality=hints?.personality;
 const r=ROLE_ARCHETYPES[role]||DEFAULT;
 const p=PERSONALITY_ARCHETYPES[personality]||DEFAULT;
 const jitter=(salt,amount)=>1+(botNoise(id,salt)-.5)*amount;
 const lo=blend(r.range[0],p.range[0])*jitter(1,.24);
 const hi=blend(r.range[1],p.range[1])*jitter(2,.18);
 return freeze({
  id,
  role:role||'adaptive',
  personality:personality||'adaptive',
  label:r.label,
  suffix:p.label,
  aggression:clamp(blend(r.aggression,p.aggression)+(botNoise(id,3)-.5)*.18,0,1),
  hold:clamp(blend(r.hold,p.hold)+(botNoise(id,4)-.5)*.18,0,1),
  flank:clamp(blend(r.flank,p.flank)+(botNoise(id,5)-.5)*.2,0,1),
  objective:clamp(blend(r.objective,p.objective)+(botNoise(id,6)-.5)*.16,0,1),
  supply:clamp(blend(r.supply,p.supply)+(botNoise(id,7)-.5)*.16,0,1),
  vehicle:clamp(blend(r.vehicle,p.vehicle)+(botNoise(id,8)-.5)*.2,0,1),
  strafe:clamp(blend(r.strafe,p.strafe,1)*(.86+botNoise(id,9)*.28),.3,1.4),
  range:[Math.max(2,Math.min(lo,hi-.5)),Math.max(lo+.5,hi)],
  spacing:clamp(blend(r.spacing,p.spacing)+(botNoise(id,10)-.5)*.7,1.6,4.2),
  retreat:clamp((hints?.retreatHealth??.4)+(botNoise(id,11)-.5)*.22,.12,.8),
 });
}

export function botBehaviorKey(actor){
 const behavior=botBehavior(actor);
 return `${behavior.role}/${behavior.personality}`;
}

export function botBehaviorSummary(actor){
 const behavior=botBehavior(actor);
 return `${behavior.label}·${behavior.suffix}`;
}

export const BOT_ROLE_COUNT=Object.keys(ROLE_ARCHETYPES).length;
export const BOT_PERSONALITY_COUNT=Object.keys(PERSONALITY_ARCHETYPES).length;
export {TAU as BOT_TAU};
