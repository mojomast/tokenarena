import {getMap} from './maps.mjs';
import {Match} from './core.mjs';
import {RULES} from './data.mjs';

export const DEFAULT_SERVER_URL = 'ws://localhost:4000';
const RENDER_DELAY = 160;
const MAX_BUFFER = 16;
const lerp = (a, b, t) => a + (b - a) * t;
const turn = (a, b) => ((((b - a) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;

export class NetClient {
 constructor(url = DEFAULT_SERVER_URL, options = {}) {
  this.url = url;
  this.storage = options.storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  this.storageKey = `token-arena-net:${url}`;
  this.roomKey = `token-arena-room:${url}`;
  this.onStart = null;
  this.onResults = null;
  this.onLobby = null;
  this.onRooms = null;
  this.onHistory = null;
  this.onChat = null;
  this.onError = null;
  this.onClose = null;
  this.reset();
 }
 reset() {
  this.ws = null;
  this.connected = false;
  this.closedByUser = false;
  this.peerId = null;
  this.hostId = null;
  this.isHost = false;
  this.spectate = false;
  this.players = [];
  this.rooms = [];
  this.matches = [];
  this.config = null;
  this.mapId = 'exchange';
  this.started = false;
  this.roundOver = true;
  this.actorId = null;
  this.token = this.storage ? this.storage.getItem(this.storageKey) : null;
  this.roomId = this.storage ? this.storage.getItem(this.roomKey) : null;
   this.buffer = [];
   this.snapshotSeq = 0;
   this.events = [];
  this.state = null;
  this.shadow = null;
   this.resynced = false;
   this.inputSeq = 0;
   this.pendingInputs = [];
   this.clockOffset = null;
  this.lastError = '';
  this.chatLog = [];
 }
 connect(url = this.url) {
  if (url) this.url = url;
  this.reset();
  this.closedByUser = false;
  return new Promise((resolve, reject) => {
   let ws;
   try { ws = new WebSocket(this.url); } catch (e) { reject(e); return; }
   this.ws = ws;
   ws.onopen = () => { this.connected = true; resolve(); };
   ws.onerror = () => { if (!this.connected) reject(new Error('connection failed')); };
   ws.onclose = () => { this.connected = false; if (this.onClose && !this.closedByUser) this.onClose(); };
   ws.onmessage = e => this.onMessage(e.data);
  });
 }
 close() { this.closedByUser = true; try { this.ws?.close(); } catch {} this.ws = null; this.connected = false; }
 send(msg) { if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg)); }
 join(name, character, harness, opts = {}) { this.send({ type: 'join', name, character, harness, token: this.token ?? '', roomId: opts.roomId || this.roomId || 'local', spectate: opts.spectate === true }); }
  create(name, character, harness, playerName = '') { this.send({ type: 'create', name, playerName, character, harness, token: this.token ?? '', roomId: '' }); }
 list() { this.send({ type: 'list' }); }
 history() { this.send({ type: 'history' }); }
 host(config, mapId) { this.send({ type: 'host', config, mapId }); }
 start() { this.send({ type: 'start' }); }
 leave() {
  this.send({ type: 'leave' });
  this.token = null;
  this.roomId = null;
  if (this.storage) { this.storage.removeItem(this.storageKey); this.storage.removeItem(this.roomKey); }
 }
   input(input) { const seq=++this.inputSeq,value={...(input||{})};this.pendingInputs.push({seq,input:value});if(this.pendingInputs.length>240)this.pendingInputs.splice(0,this.pendingInputs.length-240);this.send({type:'input',seq,input:value});return seq; }
  chat(text) { this.send({ type: 'chat', text }); }
 onMessage(data) {
  let msg;
  try { msg = JSON.parse(data); } catch { return; }
  switch (msg.type) {
   case 'welcome':
    this.peerId = msg.peerId;
    this.isHost = msg.host;
    this.spectate = msg.spectate === true;
    if (msg.roomId) { this.roomId = msg.roomId; if (this.storage) this.storage.setItem(this.roomKey, msg.roomId); }
    if (msg.token) { this.token = msg.token; if (this.storage) this.storage.setItem(this.storageKey, msg.token); }
    break;
   case 'lobby':
    this.players = msg.players;
    this.hostId = msg.hostId;
    this.isHost = this.peerId === msg.hostId;
    this.config = msg.config;
    this.mapId = msg.mapId;
    this.started = msg.started;
    this.spectate = this.players.find(p => p.peerId === this.peerId)?.spectate === true;
    this.actorId = this.players.find(p => p.peerId === this.peerId)?.actorId ?? null;
    this.onLobby?.(msg);
    break;
   case 'rooms': this.rooms = msg.rooms ?? []; this.onRooms?.(msg); break;
   case 'history': this.matches = msg.matches ?? []; this.onHistory?.(msg); break;
   case 'start':
    this.started = true;
    this.roundOver = false;
     this.buffer = [];
     this.snapshotSeq = 0;
     this.events = [];
     this.state = null;
     this.inputSeq = 0;
     this.pendingInputs = [];
     this.clockOffset = null;
    this.createShadow(msg.mapId, msg.config);
    this.onStart?.(msg);
    break;
   case 'events':
    for (const item of msg.items) this.events.push(item);
    if (this.events.length > 300) this.events.splice(0, this.events.length - 300);
    break;
   case 'snapshot': this.push(msg); break;
    case 'results': this.roundOver = true; this.state = msg.state; this.onResults?.(msg); break;
    case 'chat':
     this.chatLog.push(msg);
     if (this.chatLog.length > 100) this.chatLog.splice(0, this.chatLog.length - 100);
     this.onChat?.(msg);
     break;
   case 'error': this.lastError = msg.message; this.onError?.(msg); break;
  }
  }
  push(msg) {
   if (Number.isInteger(msg.seq) && msg.seq > 0 && msg.seq <= this.snapshotSeq) return;
   if (Number.isInteger(msg.seq) && msg.seq > 0) this.snapshotSeq = msg.seq;
   msg.recvAt = performance.now();
   msg.serverTime = Number.isFinite(msg.state?.time) ? msg.state.time : null;
   if (msg.serverTime !== null) { const sample=msg.recvAt-msg.serverTime*1000;this.clockOffset=this.clockOffset===null?sample:lerp(this.clockOffset,sample,.08); }
   this.buffer.push(msg);
  if (this.buffer.length > MAX_BUFFER) this.buffer.shift();
  this.state = msg.state;
  if (this.shadow && this.actorId !== null) {
   const own = msg.state.actors.find(a => a.id === this.actorId);
     if (own) {
      this.resync(own);
      this.resyncVehicles(msg.state.vehicles);
      const ack=Number.isInteger(msg.acks?.[this.actorId])?msg.acks[this.actorId]:null;
     if(ack!==null){this.pendingInputs=this.pendingInputs.filter(item=>item.seq>ack);for(const item of this.pendingInputs)this.shadow.step(RULES.dt,{inputs:{[this.shadow.actors[0].id]:item.input}});}
     this.resynced = true;
    }
  }
 }
 createShadow(mapId, config) {
   this.shadow = new Match('chatgpt', 'openclaw', Math.random, getMap(mapId).id, { ...(config || {}), humanCount: 1, botCount: 0 });
   this.resynced = false;
   this.inputSeq = 0;
   this.pendingInputs = [];
   this.clockOffset = null;
 }
  resync(actor) {
  const p = this.shadow.actors[0];
  Object.assign(p, actor);
   p.ammo = actor.ammo.map(n => Number.isFinite(n) ? n : Infinity);
  }
   resyncVehicles(vehicles = []) {
   if (!this.shadow) return;
    for (const state of Array.isArray(vehicles) ? vehicles : []) {
     const vehicle = this.shadow.vehicles.find(item => item.id === state.id);
     if (!vehicle) continue;
     vehicle.position = { x: Number.isFinite(state.x) ? state.x : vehicle.position.x, y: Number.isFinite(state.y) ? state.y : vehicle.position.y, z: Number.isFinite(state.z) ? state.z : vehicle.position.z };
     vehicle.velocity = { x: Number.isFinite(state.vx) ? state.vx : vehicle.velocity.x, z: Number.isFinite(state.vz) ? state.vz : vehicle.velocity.z };
     vehicle.heading = Number.isFinite(state.yaw) ? state.yaw : vehicle.heading;
     vehicle.health = Number.isFinite(state.health) ? state.health : vehicle.health;
     vehicle.maxHealth = Number.isFinite(state.maxHealth) ? state.maxHealth : vehicle.maxHealth;
    vehicle.driver = state.driver;
    vehicle.heat = state.heat;
    vehicle.overheated = state.overheated;
    vehicle.respawnTimer = state.respawnTimer;
   }
  }
 predict(input) {
  if (this.shadow) this.shadow.step(RULES.dt, { inputs: { [this.shadow.actors[0].id]: input } });
 }
 viewMatch() {
  const st = this.state;
  const mapId = st?.mapId || this.mapId;
   return { arena: getMap(mapId), actors: st ? st.actors : [], vehicles: st ? st.vehicles ?? [] : [], pickups: st ? st.pickups : [], rockets: [], events: [], serial: 0 };
  }
 renderState(now = performance.now()) {
  const b = this.buffer;
   let base, actors, rockets, vehicles;
  if (!b.length) {
   if (!this.state) return null;
   base = this.state;
    actors = base.actors;
    vehicles = base.vehicles ?? [];
    rockets = base.rockets ?? [];
  } else {
    const useServerClock=this.clockOffset!==null&&b.length>1&&b.every(m=>m.serverTime!==null),target=useServerClock?(now-this.clockOffset)/1000-RENDER_DELAY/1000:now-RENDER_DELAY;
    let hi = b.findIndex(m => useServerClock?m.serverTime>=target:m.recvAt>=target);
   if (hi < 0) hi = b.length - 1;
   const lo = Math.max(0, hi - 1);
   const s2 = b[hi], s1 = b[lo];
    const t1=useServerClock?s1.serverTime:s1.recvAt,t2=useServerClock?s2.serverTime:s2.recvAt;
    const alpha = hi === lo ? 1 : Math.max(0, Math.min(1, (target-t1)/(t2-t1||1)));
   base = s2.state;
   const prev = s1.state;
   actors = base.actors.map(actor => {
    const before = (prev.actors ?? []).find(x => x.id === actor.id);
     if (!before||actor.id===this.actorId) return actor;
    return { ...actor, x: lerp(before.x, actor.x, alpha), y: lerp(before.y, actor.y, alpha), z: lerp(before.z, actor.z, alpha),
     yaw: before.yaw + turn(before.yaw, actor.yaw) * alpha, pitch: lerp(before.pitch, actor.pitch, alpha) };
   });
    rockets = (base.rockets ?? []).map(r => {
    const before = (prev.rockets ?? []).find(x => x.id === r.id);
    if (!before) return r;
     return { ...r, pos: { x: lerp(before.pos.x, r.pos.x, alpha), y: lerp(before.pos.y, r.pos.y, alpha), z: lerp(before.pos.z, r.pos.z, alpha) } };
    });
    vehicles = (base.vehicles ?? []).map(vehicle => {
     const before = (prev.vehicles ?? []).find(item => item.id === vehicle.id);
     if (!before) return vehicle;
     return { ...vehicle, x: lerp(before.x, vehicle.x, alpha), y: lerp(before.y, vehicle.y, alpha), z: lerp(before.z, vehicle.z, alpha), yaw: before.yaw + turn(before.yaw, vehicle.yaw) * alpha };
    });
   }
   if (this.shadow && this.resynced) {
   const own = this.shadow.actors[0];
   const idx = actors.findIndex(a => a.id === this.actorId);
    if (idx >= 0) actors = actors.slice(0, idx).concat(own, actors.slice(idx + 1));
    if (own.vehicleId !== null) {
     const local = this.shadow.vehicles.find(vehicle => vehicle.id === own.vehicleId);
     const idx = vehicles.findIndex(vehicle => vehicle.id === own.vehicleId);
     if (local && idx >= 0) { const state = { id: local.id, kind: local.kind, x: local.position.x, y: local.position.y, z: local.position.z, vx: local.velocity.x, vz: local.velocity.z, yaw: local.heading, health: local.health, maxHealth: local.maxHealth, driver: local.driver, heat: local.heat, overheated: local.overheated, respawnTimer: local.respawnTimer }; vehicles = vehicles.slice(0, idx).concat(state, vehicles.slice(idx + 1)); }
    }
   }
   return { ...base, actors, vehicles, rockets, events: this.events };
 }
}
