import {Match} from '../game/core.mjs';
import {normalizeConfig} from '../game/config.mjs';
import {getMap} from '../game/maps.mjs';
import {CHARACTERS,resolveLoadout,RULES} from '../game/data.mjs';
import {randomUUID} from 'node:crypto';

export const PLAYER_LIMIT = 8;
const clean = name => String(name ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 20);

export class Room {
 constructor(id = 'local', random = Math.random, options = {}) {
  this.id = id;
  this.name = String(options.name ?? id);
  this.random = random;
  this.graceMs = Math.max(1000, options.graceMs ?? 20000);
  this.history = options.history ?? null;
  this.peers = new Map();
  this.nextPeerId = 1;
  this.hostId = null;
  this.config = null;
  this.mapId = 'exchange';
  this.match = null;
  this.started = false;
  this.roundOver = true;
  this.tickAcc = 0;
  this.broadcastAt = 0;
  this.seq = 0;
  this.out = [];
 }
 send(peerId, msg) { this.out.push({ to: peerId, msg }); }
 broadcast(msg) { this.out.push({ to: null, msg }); }
 drain() { const msgs = this.out; this.out = []; return msgs; }
 summary() {
  return { roomId: this.id, name: this.name, players: [...this.peers.values()].filter(p => p.disconnectedAt === null).length, started: this.started, mapId: this.mapId, config: this.config ? { ...this.config } : null };
 }
 lobby() {
  return { type: 'lobby', roomId: this.id, name: this.name, hostId: this.hostId, started: this.started,
   config: this.config ? { ...this.config } : null, mapId: this.mapId,
   players: [...this.peers.values()].map(p => ({ peerId: p.id, name: p.name, character: p.character, harness: p.harness, actorId: p.actorId, ready: p.ready, connected: p.disconnectedAt === null, spectate: p.spectate === true })) };
 }
 nextConnectedHost() { for (const p of this.peers.values()) if (p.spectate !== true && p.disconnectedAt === null) return p.id; return null; }
 join(peerId, name = '', character = 'chatgpt', harness = 'openclaw', token = '', spectate = false) {
  if (this.peers.has(peerId)) return;
  if (token) {
   const existing = [...this.peers.values()].find(p => p.token === token);
   if (existing) {
    if (existing.disconnectedAt === null) { this.send(peerId, { type: 'error', message: 'session is already connected' }); return; }
    const oldId = existing.id;
    this.peers.delete(oldId);
    existing.id = peerId;
    existing.disconnectedAt = null;
     existing.latest = null;
     existing.receivedSeq = existing.appliedSeq = existing.latestSeq = 0;
     existing.edgeJump = existing.edgePower = existing.edgeInteract = false;
     existing.lastJump = existing.lastPower = existing.lastInteract = false;
    this.peers.set(peerId, existing);
    if (this.hostId === oldId) this.hostId = peerId;
    else if (!this.hostId && existing.spectate !== true) this.hostId = peerId;
    this.send(peerId, { type: 'welcome', peerId, roomId: this.id, host: peerId === this.hostId, reconnected: true, token: existing.token, spectate: existing.spectate === true });
    this.broadcast(this.lobby());
    if (this.started && !this.roundOver && this.match) {
     this.send(peerId, { type: 'start', config: { ...this.match.config }, mapId: this.match.arena.id });
      this.send(peerId, { type: 'snapshot', seq: ++this.seq, acks: { [existing.actorId]: existing.appliedSeq }, state: this.match.snapshot() });
    }
    return;
   }
  }
  const isSpectator = spectate === true;
  const playerCount = [...this.peers.values()].filter(p => p.spectate !== true).length;
  if (!isSpectator && playerCount >= PLAYER_LIMIT) { this.send(peerId, { type: 'error', message: 'room is full' }); return; }
  const l = resolveLoadout(character, harness) || { character: 'chatgpt', harness: 'openclaw' };
  const peer = { id: peerId, name: clean(name) || CHARACTERS.find(c => c.id === l.character).name,
    character: l.character, harness: l.harness, actorId: null, ready: false, latest: null, receivedSeq: 0, latestSeq: 0, appliedSeq: 0, lastSerial: 0,
    lastJump: false, lastPower: false, lastInteract: false, edgeJump: false, edgePower: false, edgeInteract: false,
   token: randomUUID(), disconnectedAt: null, spectate: isSpectator };
  this.peers.set(peerId, peer);
  if (!this.hostId && !isSpectator) this.hostId = peerId;
  this.send(peerId, { type: 'welcome', peerId, roomId: this.id, host: peerId === this.hostId, token: peer.token, spectate: isSpectator });
  this.broadcast(this.lobby());
  if (isSpectator && this.started && !this.roundOver && this.match) {
   this.send(peerId, { type: 'start', config: { ...this.match.config }, mapId: this.match.arena.id });
    this.send(peerId, { type: 'snapshot', seq: ++this.seq, acks: { [this.peers.get(peerId)?.actorId ?? -1]: 0 }, state: this.match.snapshot() });
  }
 }
 disconnect(peerId) {
  const peer = this.peers.get(peerId);
  if (!peer) return;
  peer.disconnectedAt = Date.now();
  peer.latest = null;
   peer.edgeJump = peer.edgePower = peer.edgeInteract = false;
   peer.lastJump = peer.lastPower = peer.lastInteract = false;
  this.broadcast(this.lobby());
 }
 expireGrace(now = Date.now()) {
  for (const [id, peer] of this.peers) if (peer.disconnectedAt && now - peer.disconnectedAt > this.graceMs) this.leave(id);
 }
 host(peerId, config, mapId) {
  const peer = this.peers.get(peerId);
  if (!peer) return;
  if (peer.spectate) { this.send(peerId, { type: 'error', message: 'spectators cannot change match settings' }); return; }
  if (peerId !== this.hostId) { this.send(peerId, { type: 'error', message: 'only the host can change match settings' }); return; }
  this.config = normalizeConfig(config);
  this.mapId = getMap(mapId).id;
  this.broadcast(this.lobby());
 }
 start(peerId) {
  const peer = this.peers.get(peerId);
  if (!peer) return;
  if (peer.spectate) { this.send(peerId, { type: 'error', message: 'spectators cannot start the match' }); return; }
  if (peerId !== this.hostId) { this.send(peerId, { type: 'error', message: 'only the host can start' }); return; }
  if (this.peers.size === 0) { this.send(peerId, { type: 'error', message: 'no players in the room' }); return; }
  const players = [...this.peers.values()].filter(p => p.spectate !== true);
  if (players.length === 0) { this.send(peerId, { type: 'error', message: 'no players in the room' }); return; }
  const humanCount = Math.min(PLAYER_LIMIT, players.length);
   this.match = new Match('chatgpt', 'openclaw', this.random, this.mapId, { ...this.config ?? {}, humanCount, loadouts: players.map(p => ({ character: p.character, harness: p.harness })) });
  let i = 0;
   for (const p of players) { p.actorId = i; this.match.actors[i].name = p.name; p.latest = null; p.receivedSeq = p.latestSeq = p.appliedSeq = 0; p.lastSerial = 0; p.edgeJump = p.edgePower = p.edgeInteract = false; p.lastJump = p.lastPower = p.lastInteract = false; i++; }
  for (const p of this.peers.values()) if (p.spectate) p.lastSerial = 0;
  this.started = true;
  this.roundOver = false;
  this.tickAcc = 0;
  this.broadcastAt = 0;
  this.broadcast(this.lobby());
  this.broadcast({ type: 'start', config: { ...this.config }, mapId: this.mapId });
 }
 input(peerId, input) {
  const peer = this.peers.get(peerId);
  if (!peer || peer.spectate || peer.actorId === null || !this.match || this.roundOver) return;
  const i = input && typeof input === 'object' ? input : {};
   const seq = Number.isInteger(i.seq) && i.seq > 0 ? i.seq : peer.receivedSeq + 1;
   if (seq <= peer.receivedSeq) return;
   peer.receivedSeq = seq;
   const ext = { x: Number(i.x) || 0, z: Number(i.z) || 0, fire: i.fire === true };
  if (Number.isFinite(i.yaw)) ext.yaw = i.yaw;
  if (Number.isFinite(i.pitch)) ext.pitch = Math.max(-1.45, Math.min(1.45, i.pitch));
  if (Number.isInteger(i.weapon)) ext.weapon = i.weapon;
    peer.latest = ext;
   peer.latestSeq = seq;
  if (i.jump === true && !peer.lastJump) peer.edgeJump = true;
  peer.lastJump = i.jump === true;
   if (i.power === true && !peer.lastPower) peer.edgePower = true;
   peer.lastPower = i.power === true;
   if (i.interact === true && !peer.lastInteract) peer.edgeInteract = true;
   peer.lastInteract = i.interact === true;
 }
 chat(peerId, text, now = Date.now()) {
  const peer = this.peers.get(peerId);
  if (!peer) return;
  const clean = String(text ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200);
  if (!clean) return;
  if (peer.lastChatAt && now - peer.lastChatAt < 300) return;
  peer.lastChatAt = now;
  this.broadcast({ type: 'chat', peerId, name: peer.name, text: clean, time: now });
 }
 leave(peerId) {
  const peer = this.peers.get(peerId);
  if (!peer) return;
  if (peer.actorId !== null && this.match && this.started && !this.roundOver) {
   const a = this.match.actors[peer.actorId];
   a.name = `${a.name} · BOT`;
   a.bot = { route: [], think: 0, target: -1, memory: 0, reaction: 0, stuck: 0, last: { x: a.x, y: a.y, z: a.z }, state: 'roam' };
  }
  peer.latest = null;
   peer.edgeJump = peer.edgePower = peer.edgeInteract = false;
   peer.lastJump = peer.lastPower = peer.lastInteract = false;
  peer.actorId = null;
  this.peers.delete(peerId);
  if (this.hostId === peerId) this.hostId = this.nextConnectedHost();
  this.broadcast(this.lobby());
 }
 tick(dt) {
  if (!this.match || this.roundOver) return;
  this.tickAcc += Math.min(dt, .25);
  let steps = 0;
  while (this.tickAcc >= RULES.dt && steps < 5) {
     const inputs = {};
    for (const p of this.peers.values()) if (p.actorId !== null && (p.latest || p.edgeJump || p.edgePower || p.edgeInteract)) {
    const ext = { ...(p.latest ?? {}) };
    if (p.edgeJump) { ext.jump = true; p.edgeJump = false; }
     if (p.edgePower) { ext.power = true; p.edgePower = false; }
     if (p.edgeInteract) { ext.interact = true; p.edgeInteract = false; }
    inputs[p.actorId] = ext;
   }
     this.match.step(RULES.dt, { inputs });
    for (const p of this.peers.values()) if (p.actorId !== null && p.latest) p.appliedSeq = p.latestSeq;
   this.tickAcc -= RULES.dt;
   steps++;
    for (const p of this.peers.values()) if (p.actorId !== null || p.spectate) {
     const items = this.match.events.filter(e => e.id > p.lastSerial);
     if (items.length) { p.lastSerial = items[items.length - 1].id; this.send(p.id, { type: 'events', items }); }
    }
    this.broadcastAt += RULES.dt;
     if (this.broadcastAt >= .05) { this.broadcastAt = 0; const acks = {}; for (const p of this.peers.values()) if (p.actorId !== null) acks[p.actorId] = p.appliedSeq; this.broadcast({ type: 'snapshot', seq: ++this.seq, acks, state: this.match.snapshot() }); }
    if (this.match.over) {
     this.roundOver = true;
     this.history?.record({ roomId: this.id, mapId: this.mapId, config: this.match.config, time: this.match.time, actors: this.match.actors });
     this.broadcast({ type: 'results', state: this.match.snapshot() }); break;
    }
  }
 }
}
