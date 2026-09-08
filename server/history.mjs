import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

export const HISTORY_CAP = 50;

export class MatchHistory {
 constructor(file = null, options = {}) {
  this.file = file ? path.resolve(file) : null;
  this.max = Math.max(1, options.max ?? HISTORY_CAP);
  this.matches = [];
  if (this.file) this.load();
 }
 load() {
  try {
   const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    if (Array.isArray(raw)) this.matches = raw.filter(m => m && typeof m === 'object' && Array.isArray(m.players)).slice(0, this.max);
  } catch { this.matches = []; }
 }
 record({ roomId = 'local', mapId = 'exchange', config = {}, time = 0, actors = [], teamScores = null, winner = null, endingReason = null, result = null } = {}) {
   const fragLimit = Number.isFinite(config.fragLimit) ? config.fragLimit : 0;
   const mode = config.mode ?? 'deathmatch';
   const teamMode = ['ctf', 'teamdeathmatch', 'koth', 'domination'].includes(mode);
   const scores = teamScores ?? result?.teamScores;
    let normalizedScores = scores && typeof scores === 'object' ? { 0: Number(scores[0]), 1: Number(scores[1]) } : null;
    if (normalizedScores) {
     normalizedScores[0] = Number.isFinite(normalizedScores[0]) ? normalizedScores[0] : 0;
     normalizedScores[1] = Number.isFinite(normalizedScores[1]) ? normalizedScores[1] : 0;
    }
   if (teamMode && !normalizedScores && mode === 'teamdeathmatch') {
    normalizedScores = { 0: 0, 1: 0 };
    for (const actor of actors) if (actor.team === 0 || actor.team === 1) normalizedScores[actor.team] += Number(actor.frags) || 0;
   }
   const scoreWinner = normalizedScores && normalizedScores[0] !== normalizedScores[1]
    ? (normalizedScores[0] > normalizedScores[1] ? 0 : 1) : null;
   const scoreReached = normalizedScores && fragLimit > 0 && [0, 1].some(team => normalizedScores[team] >= fragLimit);
   const reason = endingReason ?? result?.endingReason ?? (teamMode
    ? (scoreReached ? (mode === 'ctf' ? 'capture' : mode === 'teamdeathmatch' ? 'frag' : 'objective') : 'time')
    : (fragLimit > 0 && actors.some(a => a.frags >= fragLimit) ? 'frag' : 'time'));
   const entry = {
   id: randomUUID(),
   roomId,
   mapId,
    mode,
   fragLimit,
   timeLimit: Number.isFinite(config.timeLimit) ? config.timeLimit : 0,
    endedBy: reason,
   duration: Math.round(time * 10) / 10,
   leader: actors.filter(a => a.frags === Math.max(0, ...actors.map(a => a.frags))).map(a => a.name).join(' & ') || 'Arena',
   players: actors.map(a => ({ name: a.name, character: a.character, harness: a.harness, frags: a.frags, deaths: a.deaths }))
   };
   if (teamMode && normalizedScores) {
    entry.teamScores = normalizedScores;
    entry.winner = winner ?? result?.winner ?? scoreWinner;
   }
  this.matches.unshift(entry);
  this.matches = this.matches.slice(0, this.max);
  this.persist();
  return entry;
 }
 persist() {
  if (!this.file) return;
  const dir = path.dirname(this.file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${this.file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(this.matches, null, 1));
  fs.renameSync(tmp, this.file);
 }
 all() { return this.matches.map(m => ({ ...m, players: m.players.map(p => ({ ...p })) })); }
}
