// Payload: one team escorts a cart along an authored route while the other
// stalls and rolls it back. Pure and engine-free, like assault.mjs, so the sim,
// replay, network and tests share the same rules.
export const PAYLOAD_MODE_ID='payload';
const boundsOf=arena=>arena.bounds||{minX:-13.55,maxX:13.55,minZ:-13.55,maxZ:13.55};
const insideBlock=(arena,x,z,y=0)=>(arena.blocks||[]).some(block=>Math.abs(x-block.x)<=block.w/2&&Math.abs(z-block.z)<=block.d/2&&y<block.h-1e-6);
const inBounds=(arena,x,z)=>{const b=boundsOf(arena);return x>=b.minX&&x<=b.maxX&&z>=b.minZ&&z<=b.maxZ;};
const pair=value=>Array.isArray(value)?(Number.isFinite(value[0])&&Number.isFinite(value[1])?{x:value[0],z:value[1]}:null):value&&Number.isFinite(value.x)&&Number.isFinite(value.z)?{x:value.x,z:value.z}:null;
const teamList=(teams,key,alt)=>{const source=teams?.[key]??teams?.[alt];return Array.isArray(source)?source.map(pair).filter(Boolean):[];};
// Pick roughly even waypoints across the map on walkable ground, anchored to the
// attacker and defender spawns so the route reads as a push across the arena.
export function payloadPath(arena,segments=3){
 const b=boundsOf(arena),teams=arena.teamSpawns||{};
 const red=teamList(teams,0,'red'),blue=teamList(teams,1,'blue'),spawns=(arena.spawns||[]).map(pair).filter(Boolean);
 let start=red[0]||spawns[0]||{x:b.minX+(b.maxX-b.minX)*.12,y:0,z:(b.minZ+b.maxZ)/2};
 let end=blue[0]||spawns[spawns.length-1]||{x:b.maxX-(b.maxX-b.minX)*.12,y:0,z:(b.minZ+b.maxZ)/2};
 if(!Number.isFinite(start.x)||!Number.isFinite(start.z))start={x:b.minX+(b.maxX-b.minX)*.12,y:0,z:(b.minZ+b.maxZ)/2};
 if(!Number.isFinite(end.x)||!Number.isFinite(end.z)||Math.hypot(end.x-start.x,end.z-start.z)<1){const centreX=(b.minX+b.maxX)/2;end={x:start.x<=centreX?b.maxX-(b.maxX-b.minX)*.12:b.minX+(b.maxX-b.minX)*.12,y:0,z:(b.minZ+b.maxZ)/2};}
 const push=(candidate,used)=>{const point=candidate?pair(candidate):null;if(!point)return;const x=point.x,z=point.z,y=Number.isFinite(candidate.y)?candidate.y:0;if(!Number.isFinite(x)||!Number.isFinite(z)||!inBounds(arena,x,z)||insideBlock(arena,x,z,y))return;if(used.some(other=>Math.hypot(other.x-x,other.z-z)<1.5))return;used.push({x,y,z});};
 const candidates=[];
 for(const zone of arena.objectiveZones||[])push(zone,candidates);
 for(const node of arena.navNodes||[])push({x:node.x,z:node.z,y:node.y},candidates);
 for(const spawn of arena.spawns||[])push({x:spawn[0],z:spawn[1],y:0},candidates);
 for(const pickup of arena.pickups||[])push({x:pickup[1],z:pickup[2],y:0},candidates);
 for(const platform of arena.platforms||[])push({x:platform.x,z:platform.z,y:platform.y??platform.topY??0},candidates);
 const count=Math.max(1,Math.min(6,Math.round(segments)||1))+1;
 const anchors=[{x:start.x,y:Number.isFinite(start.y)?start.y:0,z:start.z},{x:end.x,y:Number.isFinite(end.y)?end.y:0,z:end.z}];
 const path=[anchors[0]];
 const used=[];
 for(let i=1;i<count-1;i++){
  const t=i/(count-1),lx=anchors[0].x+(anchors[1].x-anchors[0].x)*t,lz=anchors[0].z+(anchors[1].z-anchors[0].z)*t,ly=anchors[0].y+(anchors[1].y-anchors[0].y)*t;
  let best=null,bestDistance=Infinity;
  for(const candidate of candidates){
   if(used.includes(candidate))continue;
   const distance=(candidate.x-lx)**2+(candidate.z-lz)**2;
   if(distance<bestDistance){bestDistance=distance;best=candidate;}
  }
  if(best){used.push(best);path.push({x:best.x,y:best.y,z:best.z});}else path.push({x:lx,y:ly,z:lz});
 }
 path.push(anchors[1]);
 return path;
}
export function payloadTemplate(arena,{segments=3,radius=4.5,speed:requestedSpeed}={}){
 const path=payloadPath(arena,segments),waypointDistance=[0];
 for(let i=1;i<path.length;i++){const previous=path[i-1],point=path[i];waypointDistance.push(waypointDistance[i-1]+Math.hypot(point.x-previous.x,(point.y??0)-(previous.y??0),point.z-previous.z));}
 const total=waypointDistance[waypointDistance.length-1]||0;
 const requested=Number(requestedSpeed);
 const speed=Number.isFinite(requested)&&requested>0?requested:Math.max(3,Math.min(14,total/30));
 const checkpoints=path.slice(1).map((point,index)=>({id:`cp${index+1}`,x:point.x,z:point.z,y:point.y??0,radius,owner:null,captureTeam:null,progress:0,distance:waypointDistance[index+1]}));
 const state={kind:'payload',attacker:0,defender:1,path,waypointDistance,distance:0,total,speed,radius,position:{...path[0]},pushing:null,contested:false,delivered:false,winner:null,checkpointsReached:0,checkpoints,active:0};
 state.zones=checkpoints;
 return state;
}
export function payloadPosition(state){
 const path=state?.path;
 if(!Array.isArray(path)||!path.length)return {x:0,y:0,z:0};
 if(path.length===1)return {x:path[0].x,y:path[0].y??0,z:path[0].z};
 const distances=state.waypointDistance||[];
 let index=0;
 while(index<distances.length-1&&state.distance>distances[index+1])index++;
 const segment=Math.max(0,(distances[index+1]??0)-distances[index]);
 const t=segment>0?Math.max(0,Math.min(1,(state.distance-distances[index])/segment)):0;
 const from=path[index],to=path[index+1]||from;
 return {x:from.x+(to.x-from.x)*t,y:(from.y??0)+((to.y??0)-(from.y??0))*t,z:from.z+(to.z-from.z)*t};
}
export const payloadProgress=state=>state&&state.total>0?Math.max(0,Math.min(100,state.distance/state.total*100)):0;
function standing(actors,position,radius){return (actors||[]).filter(actor=>actor&&actor.health>0&&Math.hypot(actor.x-position.x,actor.z-position.z)<=radius&&Math.abs((actor.y??0)-position.y)<=5);}
export function stepPayload(state,actors,dt,options={}){
 const {emit,teamScores,scoreLimit}=options;
 if(!state||state.delivered)return {moved:0,checkpoint:null,delivered:state?.delivered??false};
 const attacker=state.attacker??0,defender=state.defender??1,position=payloadPosition(state);
 state.position=position;
 const nearby=standing(actors,position,state.radius),attackers=nearby.filter(actor=>actor.team===attacker).length,defenders=nearby.filter(actor=>actor.team===defender).length;
 let moved=0;
 if(attackers>0&&defenders>0){state.contested=true;state.pushing=null;}
 else if(attackers>0){
  state.contested=false;state.pushing=attacker;
  const advance=state.speed*dt;
  state.distance=Math.min(state.total,state.distance+advance);moved=advance;
 }else if(defenders>0){
  state.contested=false;state.pushing=defender;
  const floor=state.checkpointsReached>0?(state.checkpoints[state.checkpointsReached-1].distance??0):0;
  const rollback=state.speed*.5*dt,next=Math.max(floor,state.distance-rollback);
  moved=next-state.distance;state.distance=next;
 }else{state.contested=false;state.pushing=null;}
 state.position=payloadPosition(state);
 let checkpoint=null;
 while(state.checkpointsReached<state.checkpoints.length&&state.distance>=state.checkpoints[state.checkpointsReached].distance-1e-6){
  checkpoint=state.checkpoints[state.checkpointsReached];
  checkpoint.owner=attacker;checkpoint.progress=100;state.checkpointsReached++;state.active=state.checkpointsReached;
  if(teamScores)teamScores[attacker]=(teamScores[attacker]||0)+1;
  emit?.('payload-checkpoint',{checkpoint:checkpoint.id,index:state.checkpointsReached,team:attacker,distance:state.distance,total:state.total});
 }
 if(state.distance>=state.total-1e-6&&!state.delivered){
  state.delivered=true;state.winner=attacker;state.distance=state.total;
  emit?.('payload-delivered',{team:attacker,total:state.total});
 }
 if(scoreLimit&&teamScores&&(teamScores[attacker]||0)>=scoreLimit)state.winner=attacker;
 return {moved,checkpoint,delivered:state.delivered};
}
