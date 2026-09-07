import {Room} from './room.mjs';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class RoomRegistry {
 constructor(options = {}) {
  this.random = options.random ?? Math.random;
  this.graceMs = options.graceMs;
  this.history = options.history ?? null;
  this.rooms = new Map();
  this.defaultRoom = this.add(new Room('local', this.random, { name: 'Local', graceMs: this.graceMs, history: this.history }));
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
  const id = this.generateCode();
  return this.add(new Room(id, this.random, { name: String(name ?? '').trim() || id, graceMs: this.graceMs, history: this.history }));
 }
 get(roomId) { return this.rooms.get(roomId) ?? null; }
 has(roomId) { return this.rooms.has(roomId); }
 list() {
  return [...this.rooms.values()].map(r => r.summary());
 }
 tickAll(dt) {
  for (const room of this.rooms.values()) room.tick(dt);
 }
 expireAll(now = Date.now()) {
  for (const room of this.rooms.values()) room.expireGrace(now);
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
