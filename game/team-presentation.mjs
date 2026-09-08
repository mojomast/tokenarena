import * as T from 'three';

export const TEAM_PALETTE=Object.freeze([
 Object.freeze({id:0,key:'red',label:'RED / I',color:'#ed514b',bars:1}),
 Object.freeze({id:1,key:'blue',label:'BLUE / II',color:'#438eff',bars:2}),
]);
export function teamPresentation(team){return team===0||team==='0'||team==='red'?TEAM_PALETTE[0]:team===1||team==='1'||team==='blue'?TEAM_PALETTE[1]:null;}

// Raised ivory bars stay legible without hue or canvas text, on both renderers.
export function teamMark(){const g=new T.Group(),mat=new T.MeshBasicMaterial({color:'#fff4dc'}),geo=new T.BoxGeometry(.045,.18,.012);for(const x of [-.05,.05]){const bar=new T.Mesh(geo,mat);bar.position.x=x;g.add(bar);}return g;}
export function updateTeamMark(mark,team){const p=teamPresentation(team);mark.visible=!!p;mark.userData.teamLabel=p?.label??null;mark.children[0].position.x=p?.bars===1?0:-.05;mark.children[1].visible=p?.bars===2;}
export function applyActorTeam(model,team){const p=teamPresentation(team),data=model.userData;if(data.team===p?.id&&data.teamApplied)return;data.teamApplied=true;data.team=p?.id;data.teamLabel=p?.label??null;data.armor.color.set(p?.color??data.armorColor);data.base.material.color.set(p?.color??data.color);for(const mark of data.teamMarks)updateTeamMark(mark,team);}
