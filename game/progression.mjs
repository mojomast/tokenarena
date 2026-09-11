export const PROGRESSION_VERSION=1;
export const MAX_LEVEL=60;
export const GEAR_SLOTS=[{id:'primary',name:'Weapon Kit'},{id:'armor',name:'Armour'},{id:'utility',name:'Utility'}];
export const GEAR=[
 {id:'scope',slot:'primary',name:'Precision Scope',level:2,description:'Tighter spread and a small damage lift for ranged duels.',modifiers:{spread:.85,damage:1.06}},
 {id:'heavy-barrel',slot:'primary',name:'Heavy Barrel',level:5,description:'More damage and punch at the cost of mobility and accuracy.',modifiers:{damage:1.12,spread:1.1,speed:.97}},
 {id:'light-frame',slot:'primary',name:'Light Frame',level:8,description:'Fast handling weapon build with reduced armour.',modifiers:{damage:1.08,spread:.9,armor:-5}},
 {id:'plating',slot:'armor',name:'Composite Plating',level:3,description:'A slab of extra spawn armour.',modifiers:{armor:25,speed:.98}},
 {id:'reactive',slot:'armor',name:'Reactive Weave',level:6,description:'Balanced armour and health for sustained fights.',modifiers:{armor:15,health:10}},
 {id:'stim',slot:'utility',name:'Combat Stim',level:4,description:'Extra health and a sliver of speed on every spawn.',modifiers:{health:20,speed:1.04}},
 {id:'servo',slot:'utility',name:'Servo Assist',level:7,description:'A movement-focused rig for objective runs.',modifiers:{speed:1.08}},
 {id:'mag',slot:'utility',name:'Stabiliser Mag',level:9,description:'Steadies the muzzle with a small speed trade.',modifiers:{spread:.92,speed:.99}},
];
export const COSMETICS=[
 {id:'finish-ion',kind:'cosmetic',name:'Ion Finish',level:4,description:'A cyan weapon finish applied to your loadout.'},
 {id:'finish-ember',kind:'cosmetic',name:'Ember Finish',level:10,description:'A hot orange weapon finish.'},
 {id:'finish-void',kind:'cosmetic',name:'Void Finish',level:18,description:'A deep violet weapon finish.'},
];
export const UNLOCKS=[...GEAR.map(item=>({id:`gear-${item.id}`,kind:'gear',ref:item.id,name:item.name,level:item.level,description:item.description})),...COSMETICS];
export const RANK_TITLES=[{level:1,name:'Recruit'},{level:5,name:'Operator'},{level:10,name:'Veteran'},{level:20,name:'Elite'},{level:35,name:'Legend'},{level:50,name:'Mythic'}];

export function xpForLevel(level){const l=Math.max(1,Math.min(MAX_LEVEL-1,Math.round(level)));return 500+(l-1)*250;}
export function levelFromXp(xp){
 let remaining=Math.max(0,Math.floor(Number.isFinite(Number(xp))?Number(xp):0)),level=1;
 while(level<MAX_LEVEL&&remaining>=xpForLevel(level)){remaining-=xpForLevel(level);level++;}
 const needed=xpForLevel(level),capped=level>=MAX_LEVEL;
 return {level,into:remaining,needed,total:Math.max(0,Math.floor(Number.isFinite(Number(xp))?Number(xp):0)),progress:capped?1:Math.min(1,remaining/needed),toNext:capped?0:Math.max(0,needed-remaining)};
}
export function rankTitle(level){let title='Recruit';for(const rank of RANK_TITLES)if(level>=rank.level)title=rank.name;return title;}
export function gearById(id){return GEAR.find(item=>item.id===id)||null;}
export function unlockedItems(level){const l=Math.max(1,Math.round(level));return UNLOCKS.filter(item=>item.level<=l);}
export function resolveGear(ids){
 const list=(Array.isArray(ids)?ids:Object.values(ids||{})).map(gearById).filter(Boolean),modifiers={health:0,armor:0,speed:1,damage:1,spread:1};
 for(const item of list)for(const [key,value] of Object.entries(item.modifiers)){if(key==='health'||key==='armor')modifiers[key]+=value;else modifiers[key]*=value;}
 modifiers.speed=Math.max(.5,Math.min(1.6,modifiers.speed));modifiers.damage=Math.max(.5,Math.min(2,modifiers.damage));modifiers.spread=Math.max(.5,Math.min(1.6,modifiers.spread));
 return {items:list,modifiers};
}
export function normalizeGear(value,level=MAX_LEVEL){
 const source=value&&typeof value==='object'?value:{},out={};
 for(const slot of GEAR_SLOTS){
  const requested=source[slot.id],item=gearById(requested);
  if(!item||item.slot!==slot.id||item.level>level)continue;
  out[slot.id]=item.id;
 }
 return out;
}
export function matchXp({win=false,actor=null}={}){
 const stats=actor?.scoreStats||{},frags=Number(actor?.frags)||0;
 const objective=(Number(stats.objectiveTime)||0)*1.5+(Number(stats.objectiveCaptures)||0)*30+(Number(stats.captures)||0)*120+(Number(stats.flagPickups)||0)*15+(Number(stats.flagReturns)||0)*10;
 return Math.max(10,Math.round(40+frags*12+objective+(win?80:0)));
}
export function defaultProgression(){return {version:PROGRESSION_VERSION,xp:0,level:1,matches:0,wins:0,kills:0,gear:{},unlocks:{}};}
export function normalizeProgression(value){
 const source=value&&typeof value==='object'?value:{},xp=Math.max(0,Math.floor(Number.isFinite(Number(source.xp))?Number(source.xp):0)),calculated=levelFromXp(xp),rawUnlocks=source.unlocks&&typeof source.unlocks==='object'?source.unlocks:{},unlocks={};
 for(const item of UNLOCKS)if(rawUnlocks[item.id]===true||item.level<=calculated.level)unlocks[item.id]=true;
 return {version:PROGRESSION_VERSION,xp,level:calculated.level,matches:Math.max(0,Math.floor(Number(source.matches)||0)),wins:Math.max(0,Math.floor(Number(source.wins)||0)),kills:Math.max(0,Math.floor(Number(source.kills)||0)),gear:normalizeGear(source.gear,calculated.level),unlocks};
}
export function awardMatch(profile,result={}){
 const next=normalizeProgression(profile),before=next.level,gained=matchXp(result);
 next.xp+=gained;const level=levelFromXp(next.xp);
 next.level=level.level;next.matches+=1;if(result.win===true)next.wins+=1;next.kills+=Number(result.actor?.frags)||0;
 const unlocked=[];
 for(const item of unlockedItems(level.level))if(!next.unlocks[item.id]){next.unlocks[item.id]=true;unlocked.push(item);}
 return {profile:next,gained,levelUp:level.level>before,unlocked,progress:level.progress,toNext:level.toNext};
}
