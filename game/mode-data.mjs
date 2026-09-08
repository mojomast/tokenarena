import {modeRule} from './config.mjs';
const point=(x,z,id,rules)=>({id,x,z,radius:3.5,owner:null,captureTeam:null,progress:0,captureSeconds:rules.objective?.captureSeconds??5});
const boundsOf=arena=>arena.bounds||{minX:-13.55,maxX:13.55,minZ:-13.55,maxZ:13.55};
const authoredPoints=(arena,ids,rules)=>Array.isArray(arena.objectiveZones)&&arena.objectiveZones.length>=ids.length?ids.map((id,i)=>{const source=arena.objectiveZones[i];return {...point(source.x,source.z,id,rules),y:source.y??0};}):null;
export function objectiveTemplate(mode,arena){
  const b=boundsOf(arena),cx=(b.minX+b.maxX)/2,cz=(b.minZ+b.maxZ)/2;
  const rules=modeRule(mode);
  const authored=authoredPoints(arena,['alpha','bravo','charlie'],rules);
  if(mode==='koth'){const source=authored?.[1]||point(cx,cz,'hill',rules);return {kind:'koth',zones:[{...source,id:'hill',captureSeconds:rules.objective.captureSeconds}],winner:null};}
  if(mode==='domination'){const dx=(b.maxX-b.minX)*.28;return {kind:'domination',zones:authored||[point(cx-dx,cz,'alpha',rules),point(cx,cz,'bravo',rules),point(cx+dx,cz,'charlie',rules)],winner:null};}
  return null;
}
