import {activeMaps,maxBotsFor} from './arenas.mjs';
import {vehicleSeatFor,vehicleMounted} from './vehicles.mjs';

// The title screen cycles a reel of action-packed scenarios so the menu shows off
// the game's range: objective modes, vehicle battles, explosive modes and the
// signature rail beam. Scenarios stay short so the reel rotates.
export const SHOWCASES=[
 {id:'combined',label:'Combined Arms',mode:'combined-arms',maps:['skyfall-basin','trenchline','signal-ridge','warfront'],bots:16,difficulty:'normal',timeLimit:120,fragLimit:200,seatVehicles:.7},
 {id:'rail',label:'Instagib Rails',mode:'instagib',maps:['catacombs','neon-vertical','substation','atrium'],bots:12,difficulty:'hard',timeLimit:120,fragLimit:25,seatVehicles:0},
 {id:'rockets',label:'Rocket Arena',mode:'rockets',maps:['slagworks','catacombs','colosseum','atrium'],bots:12,difficulty:'normal',timeLimit:120,fragLimit:40,seatVehicles:.3},
 {id:'ctf',label:'Capture the Flag',mode:'ctf',maps:['frost-gate','sunken-hill','skybreak','aether','frostline'],bots:12,difficulty:'normal',timeLimit:150,fragLimit:3,seatVehicles:.35},
 {id:'payload',label:'Payload',mode:'payload',maps:['convoy-line','riverbend','titan-valley'],bots:12,difficulty:'normal',timeLimit:150,fragLimit:3,seatVehicles:.35},
 {id:'assault',label:'Assault',mode:'assault',maps:['rampart','catwalk-breach','fortress','trenchline'],bots:10,difficulty:'normal',timeLimit:150,fragLimit:3,seatVehicles:.3},
];

export function pickShowcase(index,random=Math.random,{legacy=false}={}){
 const n=SHOWCASES.length;
 const scenario=SHOWCASES[((Math.round(index)%n)+n)%n];
 const available=new Set(activeMaps({legacy}).map(map=>map.id));
 const preferred=scenario.maps.filter(id=>available.has(id));
 const pool=preferred.length?preferred:[...available];
 const mapId=pool.length?pool[Math.min(pool.length-1,Math.floor(random()*pool.length))]:'exchange';
 const botCount=Math.max(4,Math.min(maxBotsFor(scenario.mode),Math.round(scenario.bots)));
 return {id:scenario.id,label:scenario.label,mode:scenario.mode,mapId,botCount,difficulty:scenario.difficulty,timeLimit:scenario.timeLimit,fragLimit:scenario.fragLimit,seatVehicles:scenario.seatVehicles};
}

// Move a share of bots straight into seats so the demo opens with rolling
// armour and aircraft instead of waiting for pathfinding to find the garage.
export function seatShowcaseVehicles(match,fraction=.7){
 if(!match?.vehicles?.length||!match.actors?.length)return 0;
 const limit=Math.max(1,Math.round(match.actors.length*Math.max(0,Math.min(1,fraction))));
 let seated=0;
 for(const actor of match.actors){
  if(seated>=limit)break;
  if(!actor.bot||actor.health<=0||actor.vehicleId!=null)continue;
  const vehicle=match.vehicles.find(candidate=>vehicleSeatFor(candidate)&&!vehicleMounted(candidate,actor.id));
  if(!vehicle)break;
  Object.assign(actor,{x:vehicle.position.x,y:vehicle.position.y,z:vehicle.position.z,grounded:true});
  if(match.enterVehicle(actor))seated++;
 }
 return seated;
}
