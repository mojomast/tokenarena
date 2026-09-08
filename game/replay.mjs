import {DEFAULT_CONFIG,normalizeConfig} from './config.mjs';
import {CHARACTERS,HARNESSES,validLoadout,resolveLoadout} from './data.mjs';
import {MAPS} from './maps.mjs';

export const QUICK_MATCH_PRESETS = [
 {id:'warmup',name:'Warmup',detail:'0 bots / explore',rules:{mode:'deathmatch',botCount:0,difficulty:'easy'}},
 {id:'casual',name:'Casual Skirmish',detail:'2 bots / easy',rules:{mode:'deathmatch',botCount:2,difficulty:'easy'}},
 {id:'duel',name:'Duel',detail:'1 bot / normal',rules:{mode:'deathmatch',botCount:1,difficulty:'normal'}},
 {id:'rockets',name:'Rocket Party',detail:'3 bots / easy',rules:{mode:'rockets',botCount:3,difficulty:'easy'}},
];

export function presetConfig(id,config={}){
 const preset=QUICK_MATCH_PRESETS.find(p=>p.id===id);
 return normalizeConfig(preset?{...DEFAULT_CONFIG,...preset.rules,playerName:config.playerName}:config);
}

export function shuffleSelection(random=Math.random){
 const character=CHARACTERS[Math.floor(random()*CHARACTERS.length)].id;
 const compatible=HARNESSES.filter(h=>validLoadout(character,h.id));
 const harness=compatible[Math.floor(random()*compatible.length)].id;
 return {...resolveLoadout(character,harness),mapId:MAPS[Math.floor(random()*MAPS.length)].id};
}

export function nextArenaSelection(mapId,random=Math.random){
 const next=(MAPS.findIndex(m=>m.id===mapId)+1)%MAPS.length;
 return {...shuffleSelection(random),mapId:MAPS[next].id};
}
