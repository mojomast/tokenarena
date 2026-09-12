import fs from 'node:fs';
import path from 'node:path';
import {awardMatch,defaultProgression,normalizeGear,normalizeProgression} from '../game/progression.mjs';
import {normalizeAttachments} from '../game/attachments.mjs';

export const PLAYER_CAP=500;
export const validPlayerId=id=>typeof id==='string'&&/^[A-Za-z0-9-]{8,64}$/.test(id);

export class ProgressionStore{
 constructor(file=null,options={}){
  this.file=file?path.resolve(file):null;
  this.max=Math.max(1,options.max??PLAYER_CAP);
  this.players=new Map();
  if(this.file)this.load();
 }
 load(){
  try{
   const raw=JSON.parse(fs.readFileSync(this.file,'utf8'));
   const entries=Array.isArray(raw)?raw:Array.isArray(raw?.players)?raw.players:[];
   for(const entry of entries){
    const id=entry?.id;
    if(!validPlayerId(id))continue;
    this.players.set(id,{...normalizeProgression(entry),id});
   }
  }catch{this.players=new Map();}
 }
 touch(id){const profile=this.players.get(id);if(profile){this.players.delete(id);this.players.set(id,profile);}return profile;}
 get(id){if(!validPlayerId(id)||!this.players.has(id))return null;const profile=this.touch(id);return {...profile,gear:{...profile.gear},attachments:{...profile.attachments},unlocks:{...profile.unlocks}};}
 ensure(id){
  if(!validPlayerId(id))return null;
  if(!this.players.has(id)){this.players.set(id,{...defaultProgression(),id});this.trim();}
  return this.touch(id);
 }
 setGear(id,gear,attachments){
  const profile=this.ensure(id);
  if(!profile)return null;
  profile.gear=normalizeGear(gear&&typeof gear==='object'?gear:{},profile.level);
  if(attachments!==undefined)profile.attachments=normalizeAttachments(attachments&&typeof attachments==='object'?attachments:{},profile.level);
  this.persist();
  return this.get(id);
 }
 award(id,result={}){
  const profile=this.ensure(id);
  if(!profile)return null;
  const awarded=awardMatch(profile,result);
  awarded.profile.id=id;
  this.players.set(id,awarded.profile);
  this.trim();
  this.persist();
  return {profile:this.get(id),gained:awarded.gained,levelUp:awarded.levelUp,unlocked:awarded.unlocked,progress:awarded.progress,toNext:awarded.toNext};
 }
 trim(){while(this.players.size>this.max)this.players.delete(this.players.keys().next().value);}
 persist(){
  if(!this.file)return true;
  const tmp=`${this.file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  try{
   fs.mkdirSync(path.dirname(this.file),{recursive:true});
   fs.writeFileSync(tmp,JSON.stringify([...this.players.values()],null,1));
   fs.renameSync(tmp,this.file);
   this._dirty=false;this._retryAt=0;this._failures=0;this.lastPersistError=null;
   return true;
  }catch(error){
   // Keep the award in memory and retry later; a disk error must not abort the
   // room tick or block the results broadcast.
   this._dirty=true;this.lastPersistError=error;
   this._failures=(this._failures??0)+1;
   this._retryAt=Date.now()+Math.min(30000,1000*2**Math.min(this._failures-1,5));
   try{fs.unlinkSync(tmp);}catch{}
   return false;
  }
 }
 flush(){
  if(!this.file||!this._dirty)return true;
  if(this._retryAt&&Date.now()<this._retryAt)return false;
  return this.persist();
 }
 all(){return [...this.players.values()].map(profile=>({...profile,gear:{...profile.gear},attachments:{...profile.attachments},unlocks:{...profile.unlocks}}));}
}
