const HEX_RE=/^#[0-9a-f]{6}$/i;
const SHAPES=['cross','dot','ring','chevron','split'];

function parseHex(value){
 const text=String(value??'').trim();
 if(!HEX_RE.test(text))return null;
 const n=parseInt(text.slice(1),16);
 return [(n>>16)&255,(n>>8)&255,n&255];
}
function hexToRgb(hex){const [r,g,b]=parseHex(hex);return [r/255,g/255,b/255];}
const clamp255=value=>Math.max(0,Math.min(255,Math.round(value)));
const toHex=channels=>`#${channels.map(value=>clamp255(value).toString(16).padStart(2,'0')).join('')}`;
const finish=(id,name,description,level,primary,secondary,accent,emissive)=>Object.freeze({id,name,description,level,colors:Object.freeze({primary,secondary,accent,emissive,rgb:Object.freeze(hexToRgb(primary))})});
const crosshair=(id,name,description,shape,level,gap,thickness,dot)=>Object.freeze({id,name,description,shape,level,gap,thickness,dot});

export const WEAPON_FINISHES=Object.freeze([
 finish('finish-ion','Ion Finish','A charged cyan finish that hums along the barrel. Do not lick the gun.',4,'#22d3ee','#0e7490','#a5f3fc','#67e8f9'),
 finish('finish-ember','Ember Finish','A banked-coal orange with a steady glow. Warm to the touch, allegedly.',10,'#ff7a18','#7c2d06','#ffc48a','#ff9d4d'),
 finish('finish-void','Void Finish','A deep violet finish that swallows the light and the concept of retreat.',18,'#8b5cf6','#4c1d95','#c4b5fd','#a78bfa'),
 finish('finish-toxic','Toxic Finish','An acid green finish that drips with menace. Environmentally concerning.',6,'#7cff3a','#2f6b18','#d9ff9e','#a3ff5e'),
 finish('finish-solar','Solar Finish','A burnished gold finish polished to a flare. Tacky in the best possible way.',14,'#ffd24a','#8a6a12','#fff0b0','#ffe28a'),
 finish('finish-crimson','Crimson Finish','A blood red finish for close-range conversations.',22,'#ff3b5c','#7f1d2d','#ffb3c0','#ff7a91'),
]);

export const CROSSHAIR_STYLES=Object.freeze([
 crosshair('cross','Crosshair','The classic four-line reticle. Tried, true, on every box art.','cross',1,6,2,0),
 crosshair('dot','Dot','A minimal single-pixel dot for precision flicks. For people who trust their mouse.','dot',1,0,0,3),
 crosshair('ring','Ring','An open ring that frames the target without clutter. Minimal, mean.','ring',1,10,2,0),
 crosshair('chevron','Chevron','A downward chevron tuned for burst control. Peek responsibly.','chevron',8,8,2,0),
 crosshair('split','Split','A split reticle that reads gaps at long range. For the patient.','split',16,12,2,1),
]);

export const FINISH_IDS=Object.freeze(WEAPON_FINISHES.map(item=>item.id));
export const CROSSHAIR_IDS=Object.freeze(CROSSHAIR_STYLES.map(item=>item.id));

export function finishById(id){return WEAPON_FINISHES.find(item=>item.id===id)||null;}
export function crosshairById(id){return CROSSHAIR_STYLES.find(item=>item.id===id)||null;}

function levelOf(value){const n=Number(value);return Number.isFinite(n)?Math.max(1,Math.round(n)):1;}
export function unlockedFinishes(level){const l=levelOf(level);return WEAPON_FINISHES.filter(item=>item.level<=l);}
export function unlockedCrosshairs(level){const l=levelOf(level);return CROSSHAIR_STYLES.filter(item=>item.level<=l);}

export function resolveFinish(id,fallbackColors){const item=finishById(id);return item?item.colors:fallbackColors;}
export function finishRgb(id){const item=finishById(id);return item?item.colors.rgb.slice():null;}

export function applyFinishToColor(finishId,baseHex){
 const item=finishById(finishId),base=parseHex(baseHex);
 if(!item||!base)return baseHex;
 const mix=item.colors.rgb,weight=.5;
 return toHex(base.map((channel,index)=>channel*(1-weight)+mix[index]*255*weight));
}
