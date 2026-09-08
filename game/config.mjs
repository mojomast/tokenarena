export const GAME_MODES = [
 {id:'deathmatch',name:'Deathmatch',description:'Start with a Pulse Rifle. Collect weapons and supplies.'},
 {id:'instagib',name:'Instagib',description:'Rail only, unlimited ammo. One unprotected hit eliminates. No supplies or harness powers.'},
 {id:'rockets',name:'Rocket Arena',description:'Unlimited rockets for everyone. Health and armor remain available.'},
 {id:'arsenal',name:'Full Arsenal',description:'Every weapon unlocked with unlimited ammo from every spawn.'},
];
export const DIFFICULTIES = [
 {id:'easy',name:'Easy',description:'Longer reactions and loose aim.',reaction:.85,think:.45,error:.19,fireDelay:.2},
 {id:'normal',name:'Normal',description:'The original balanced bots.',reaction:.3,think:.2,error:.045,fireDelay:0},
 {id:'hard',name:'Hard',description:'Quicker reactions and tighter aim.',reaction:.16,think:.14,error:.023,fireDelay:0},
 {id:'nightmare',name:'Nightmare',description:'Very fast reactions and precise aim.',reaction:.08,think:.1,error:.01,fireDelay:0},
];
export const DEFAULT_CONFIG = Object.freeze({mode:'deathmatch',botCount:4,difficulty:'normal',fragLimit:15,timeLimit:300,respawn:2,speed:1,gravity:1,damage:1,fastPowers:false,lifeSteal:false,unlimitedAmmo:false,startingWeapon:0,playerName:''});
export const DEFAULT_DISPLAY = Object.freeze({fov:82,crosshair:'cross',color:'#c2ffea',size:1,showFps:false,showWeapon:true,resolutionScale:1});
const number=(v,fallback,min,max)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback;
const choice=(v,values,fallback)=>values.includes(v)?v:fallback;
export function normalizeConfig(value={}){
 const c=value&&typeof value==='object'?value:{};
 return {mode:choice(c.mode,GAME_MODES.map(m=>m.id),'deathmatch'),botCount:Math.round(number(c.botCount,4,0,8)),difficulty:choice(c.difficulty,DIFFICULTIES.map(d=>d.id),'normal'),fragLimit:Math.round(number(c.fragLimit,15,5,50)),timeLimit:Math.round(number(c.timeLimit,300,60,900)),respawn:number(c.respawn,2,1,5),speed:choice(c.speed,[.75,1,1.25,1.5],1),gravity:choice(c.gravity,[.4,.7,1],1),damage:choice(c.damage,[.5,1,1.5,2],1),fastPowers:c.fastPowers===true,lifeSteal:c.lifeSteal===true,unlimitedAmmo:c.unlimitedAmmo===true,startingWeapon:Math.round(number(c.startingWeapon,0,0,4)),playerName:typeof c.playerName==='string'?c.playerName.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,20):''};
}
export function normalizeDisplay(value={}){
 const c=value&&typeof value==='object'?value:{};
 return {fov:Math.round(number(c.fov,82,65,110)),crosshair:choice(c.crosshair,['cross','dot','ring'],'cross'),color:typeof c.color==='string'&&/^#[0-9a-f]{6}$/i.test(c.color)?c.color:'#c2ffea',size:number(c.size,1,.6,1.8),showFps:c.showFps===true,showWeapon:c.showWeapon!==false,resolutionScale:number(c.resolutionScale,1,.5,1.5)};
}
export const modeWeapon=c=>c.mode==='instagib'?2:c.mode==='rockets'?1:null;
export function spawnInventory(c){const locked=modeWeapon(c);return [0,1,2,3,4].map(i=>locked!==null?(i===locked?Infinity:0):c.mode==='arsenal'||i===0||c.unlimitedAmmo&&i===c.startingWeapon?Infinity:i===c.startingWeapon?[0,6,5,10,24][i]:0);}
