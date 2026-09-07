import {getMap} from './maps.mjs';
import {Match} from './core.mjs';
import {RULES} from './data.mjs';

export const DEFAULT_SERVER_URL = 'ws://localhost:4000';
const RENDER_DELAY = 120;
const MAX_BUFFER = 12;
const lerp = (a, b, t) => a + (b - a) * t;
const turn = (a, b) => ((((b - a) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;

export class NetClient {
 constructor(url = DEFAULT_SERVER_URL, options = {}) {
  this.url = url;
  this.storage = options.storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  this.storageKey = `token-arena-net:${url}`;
  this.roomKey = `token-arena-room:${url}`;
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
  this.events = [];
  this.state = null;
  this.shadow = null;
  this.resynced = false;
  this.lastError = '';
  this.chatLog = [];
  this.onStart = null;
  this.onResults = null;
  this.onLobby = null;
  this.onRooms = null;
  this.onHistory = null;
  this.onChat = null;
  this.onError = null;
  this.onClose = null;
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
  input(input) { this.send({ type: 'input', input }); }
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
    this.events = [];
    this.state = null;
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
  msg.recvAt = performance.now();
  this.buffer.push(msg);
  if (this.buffer.length > MAX_BUFFER) this.buffer.shift();
  this.state = msg.state;
  if (this.shadow && this.actorId !== null) {
   const own = msg.state.actors.find(a => a.id === this.actorId);
   if (own) { this.resync(own); this.resynced = true; }
  }
 }
 createShadow(mapId, config) {
  this.shadow = new Match('chatgpt', 'openclaw', Math.random, getMap(mapId).id, { ...(config || {}), humanCount: 1, botCount: 0 });
  this.resynced = false;
 }
 resync(actor) {
  const p = this.shadow.actors[0];
  Object.assign(p, actor);
  p.ammo = actor.ammo.map(n => Number.isFinite(n) ? n : Infinity);
 }
 predict(input) {
  if (this.shadow) this.shadow.step(RULES.dt, { inputs: { 0: input } });
 }
 viewMatch() {
  const st = this.state;
  const mapId = st?.mapId || this.mapId;
  return { arena: getMap(mapId), actors: st ? st.actors : [], pickups: st ? st.pickups : [], rockets: [], events: [], serial: 0 };
 }
 renderState(now = performance.now()) {
  const b = this.buffer;
  let base, actors, rockets;
  if (!b.length) {
   if (!this.state) return null;
   base = this.state;
   actors = base.actors;
   rockets = base.rockets ?? [];
  } else {
   const target = now - RENDER_DELAY;
   let hi = b.findIndex(m => m.recvAt >= target);
   if (hi < 0) hi = b.length - 1;
   const lo = Math.max(0, hi - 1);
   const s2 = b[hi], s1 = b[lo];
   const alpha = hi === lo ? 1 : Math.max(0, Math.min(1, (target - s1.recvAt) / (s2.recvAt - s1.recvAt)));
   base = s2.state;
   const prev = s1.state;
   actors = base.actors.map(actor => {
    const before = (prev.actors ?? []).find(x => x.id === actor.id);
    if (!before) return actor;
    return { ...actor, x: lerp(before.x, actor.x, alpha), y: lerp(before.y, actor.y, alpha), z: lerp(before.z, actor.z, alpha),
     yaw: before.yaw + turn(before.yaw, actor.yaw) * alpha, pitch: lerp(before.pitch, actor.pitch, alpha) };
   });
   rockets = (base.rockets ?? []).map(r => {
    const before = (prev.rockets ?? []).find(x => x.id === r.id);
    if (!before) return r;
    return { ...r, pos: { x: lerp(before.pos.x, r.pos.x, alpha), y: lerp(before.pos.y, r.pos.y, alpha), z: lerp(before.pos.z, r.pos.z, alpha) } };
   });
  }
  if (this.shadow && this.resynced) {
   const own = this.shadow.actors[0];
   const idx = actors.findIndex(a => a.id === this.actorId);
   if (idx >= 0) actors = actors.slice(0, idx).concat(own, actors.slice(idx + 1));
  }
  return { ...base, actors, rockets, events: this.events };
 }
}
