// Map definitions are immutable templates. Each Match owns its own collision and navigation context.
const wall=(x,z,w,d,h=9,kind='wall')=>({x,z,w,d,h,kind});
const shell=[wall(-14.5,0,1,30),wall(14.5,0,1,30),wall(0,14.5,30,1),wall(0,-14.5,30,1)];
const deck=[wall(0,-12,28,6,3.8,'deck'),wall(-8.05,-3,.25,12,4.4,'rampwall'),wall(8.05,-3,.25,12,4.4,'rampwall')];
const cover=(x,z,w=3,d=1.4,h=1.9)=>wall(x,z,w,d,h,'cover');
const upperSpawns=[[-11,10],[11,10],[0,12],[-11,-12],[11,-12],[0,-12],[-4,9],[4,9]];
export const MAPS=[
 {id:'exchange',name:'The Exchange',tag:'REACTOR / VERTICAL',description:'Twin ramps, a raised gantry, and a central reactor. Control the high ground.',color:'#5dcbbc',background:'#090f17',raised:true,blocks:[wall(0,0,4,4,5.4,'reactor'),cover(-6,5),cover(6,5),cover(-5,-5,2.2,1.4,2.1),cover(5,-5,2.2,1.4,2.1),...deck,...shell],spawns:upperSpawns,pickups:[['health',-11,7],['health',11,7],['armor',0,7],['rocket',-4,0],['plasma',4,0],['rail',0,-12],['health',-6,-12],['armor',6,-12],['scatter',0,11]]},
 {id:'crosswire',name:'Crosswire',tag:'CROSSROADS / CLOSE QUARTERS',description:'Four staggered bunkers split an open crossroads. Cut corners and ambush with the scattergun.',color:'#a998ff',background:'#101020',raised:false,blocks:[cover(-5,-5,5,3,3.3),cover(5,5,5,3,3.3),cover(-5,5,3,5,3.3),cover(5,-5,3,5,3.3),cover(0,0,1.4,1.4,1.7),...shell],spawns:[[-11,11],[11,11],[-11,-11],[11,-11],[0,12],[0,-12],[-12,0],[12,0]],pickups:[['health',-11,0],['health',11,0],['armor',0,10],['rocket',-10,-10],['rail',0,-11],['scatter',0,4],['plasma',10,10],['health',-10,10],['armor',10,-10]]},
 {id:'foundry',name:'The Foundry',tag:'TWIN CORES / LONG SIGHTLINES',description:'Orange furnace towers divide three firing lanes. Take the gantry or push through the center.',color:'#ffab65',background:'#1b1210',raised:true,blocks:[wall(-4,0,2.8,5,5.7,'reactor'),wall(4,0,2.8,5,5.7,'reactor'),cover(-4,7,3,1.3,1.8),cover(4,7,3,1.3,1.8),cover(0,-5,2,1.3,1.8),...deck,...shell],spawns:upperSpawns,pickups:[['health',-11,7],['health',11,7],['armor',0,5],['rocket',0,0],['rail',-5,-12],['plasma',5,-12],['scatter',0,11],['health',0,-12],['armor',-6,-5]]},
];
export const getMap=id=>MAPS.find(m=>m.id===id)||MAPS[0];
export const pickupWeapon=kind=>({rocket:1,rail:2,scatter:3,plasma:4})[kind];
