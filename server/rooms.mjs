import {Room} from './room.mjs';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class RoomRegistry {
 constructor(options = {}) {
  this.random = options.random ?? Math.random;
  this.graceMs = options.graceMs;
  this.history = options.history ?? null;
  this.progression = options.progression ?? null;
  this.snapshotHz = options.snapshotHz;
  this.onError = options.onError ?? null;
  this.maxRooms = Math.max(2, Math.min(4096, Number(options.maxRooms) || 64));
  this.rooms = new Map();
  this.defaultRoom = this.add(new Room('local', this.random, { name: 'Local', graceMs: this.graceMs, history: this.history, progression: this.progression, snapshotHz: this.snapshotHz }));
 }
 add(room) {
  this.rooms.set(room.id, room);
  return room;
 }
 generateCode() {
  for (let attempt = 0; attempt < 100; attempt++) {
   let code = '';
   for (let i = 0; i < 4; i++) code += CODE_ALPHABET[Math.floor(this.random() * CODE_ALPHABET.length)];
   if (!this.rooms.has(code)) return code;
  }
  throw new Error('no room codes available');
 }
 create(name = '') {
  if (this.rooms.size >= this.maxRooms) {
   const idle = [...this.rooms.values()].find(room => room !== this.defaultRoom && room.peers.size === 0);
   if (!idle) return null;
   this.rooms.delete(idle.id);
  }
  const id = this.generateCode();
  const safeName = String(name ?? '').replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim().slice(0, 32) || id;
  return this.add(new Room(id, this.random, { name: safeName, graceMs: this.graceMs, history: this.history, progression: this.progression, snapshotHz: this.snapshotHz }));
 }
 get(roomId) { return this.rooms.get(roomId) ?? null; }
 has(roomId) { return this.rooms.has(roomId); }
 list() {
  return [...this.rooms.values()].map(r => r.summary());
 }
 tickAll(dt) {
  for (const room of this.rooms.values()) {
   try { room.tick(dt); }
   catch (error) { this.lastTickError = error; this.onError?.(error, room); }
  }
 }
 expireAll(now = Date.now()) {
  for (const room of this.rooms.values()) {
   try { room.expireGrace(now); }
   catch (error) { this.lastExpireError = error; this.onError?.(error, room); }
  }
  for (const room of [...this.rooms.values()]) this.removeIfEmpty(room);
 }
 drainAll() {
  const messages = [];
  for (const room of this.rooms.values()) messages.push(...room.drain());
  return messages;
 }
 removeIfEmpty(room) {
  if (room === this.defaultRoom || room.peers.size > 0) return false;
  this.rooms.delete(room.id);
  return true;
 }
}
