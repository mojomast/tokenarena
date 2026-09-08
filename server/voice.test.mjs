import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHmac } from 'node:crypto';
import WebSocket from 'ws';
import { Room } from './room.mjs';
import { createGameServer, voiceConfig } from './game-server.mjs';

function setup() {
 const room = new Room('voice');
 room.join(1); room.join(2); room.join(3, '', 'chatgpt', 'openclaw', '', true);
 room.voiceState(1, true); room.voiceState(2, true); room.drain();
 const signal = { type: 'voice-signal', roomId: room.id, to: 2, session: room.peers.get(1).voiceSession,
  targetSession: room.peers.get(2).voiceSession, description: { type: 'offer', sdp: 'v=0' } };
 return { room, signal };
}

test('sessions are server issued, idempotent, private to players, and cleared throughout lifecycle', () => {
 const { room } = setup();
 const first = room.peers.get(1).voiceSession;
 assert.match(first, /^[0-9a-f-]{36}$/);
 room.voiceState(1, true); room.voiceState(3, true); room.voiceState(1, 'false');
 assert.equal(room.drain().length, 0);
 assert.equal(room.lobby().players.find(p => p.peerId === 3).voiceSession, null);
 room.voiceState(1, false);
 assert.equal(room.peers.get(1).voiceSession, null);
 room.drain(); room.voiceState(1, true);
 const messages = room.drain();
 assert.equal(messages[0].msg.type, 'voice-config');
 assert.equal(messages[0].to, 1);
 assert.equal(messages[1].msg.type, 'lobby');
 assert.notEqual(room.peers.get(1).voiceSession, first);
 const token = room.peers.get(1).token;
 room.disconnect(1);
 assert.equal(room.peers.get(1).voiceSession, null);
 room.voiceState(1, true);
 assert.equal(room.peers.get(1).voiceSession, null);
 room.join(4, '', 'chatgpt', 'openclaw', token);
 assert.equal(room.peers.get(4).voiceSession, null);
 room.voiceState(4, true);
 const peer = room.peers.get(4);
 room.leave(4);
 assert.equal(peer.voiceSession, null);
 assert.equal(room.peers.has(4), false);
});

test('relay canonicalizes identity and accepts answers, ICE and end-of-candidates', () => {
 const { room, signal } = setup();
 for (const payload of [signal.description, { type: 'answer', sdp: 'v=0' }]) {
  room.voiceSignal(1, { ...signal, from: 999, description: payload });
  assert.deepEqual(room.drain(), [{ to: 2, msg: { type: 'voice-signal', roomId: room.id, from: 1,
   session: signal.session, targetSession: signal.targetSession, description: payload } }]);
 }
 const { description, ...ice } = signal;
 for (const candidate of [null, { candidate: '', sdpMid: null, sdpMLineIndex: null },
  { candidate: 'candidate:1', sdpMid: 'audio', sdpMLineIndex: 0, usernameFragment: 'ufrag' }]) {
  room.voiceSignal(1, { ...ice, candidate });
  assert.deepEqual(room.drain()[0].msg.candidate, candidate);
 }
});

test('rejects cross-room, self, spectators, spoofed sessions, malformed and oversized payloads', () => {
 const { room, signal } = setup();
 const { description, ...ice } = signal;
 const bad = [null, [], {}, { ...signal, roomId: 'elsewhere' }, { ...signal, to: 1 }, { ...signal, to: 3 },
  { ...signal, to: 99 }, { ...signal, session: 'forged' }, { ...signal, targetSession: 'forged' },
  { ...signal, candidate: null }, ice, { ...signal, description: null }, { ...signal, description: [] },
  { ...signal, description: { type: 'rollback', sdp: '' } },
  { ...signal, description: { type: 'offer', sdp: 'x'.repeat(32769) } },
  ...[[], {}, { candidate: 'x'.repeat(4097), sdpMid: null, sdpMLineIndex: null },
   { candidate: '', sdpMid: [], sdpMLineIndex: 0 }, { candidate: '', sdpMid: null, sdpMLineIndex: -1 },
   { candidate: '', sdpMid: null, sdpMLineIndex: 0.5 },
   { candidate: '', sdpMid: null, sdpMLineIndex: 0, usernameFragment: 'x'.repeat(257) }].map(candidate => ({ ...ice, candidate }))];
 for (const msg of bad) { room.voiceSignal(1, msg); assert.equal(room.drain().length, 0, JSON.stringify(msg)); }
 room.voiceSignal(3, signal); assert.equal(room.drain().length, 0);
 room.voiceState(2, false); room.voiceState(2, true); room.drain();
 room.voiceSignal(1, signal); assert.equal(room.drain().length, 0);
 room.disconnect(1); room.drain(); room.voiceSignal(1, signal); assert.equal(room.drain().length, 0);
});

test('message and byte budgets bound signaling; toggling does not reset rate', () => {
 const { room, signal } = setup();
 room.peers.get(1).voiceRate = null;
 for (let i = 0; i < 200; i++) room.voiceSignal(1, signal);
 assert.equal(room.drain().length, 128);
 room.voiceState(1, false); room.voiceState(1, true);
 assert.equal(room.peers.get(1).voiceSession, null);
 room.peers.get(1).voiceRate.at -= 10000;
 room.voiceState(1, true); room.drain();
 signal.session = room.peers.get(1).voiceSession;
 signal.description.sdp = 'x'.repeat(32768);
 for (let i = 0; i < 20; i++) room.voiceSignal(1, signal);
 assert.equal(room.drain().length, 7);
});

test('TURN uses expiring HMAC credentials and falls back to STUN without both settings', () => {
 const stun = { type: 'voice-config', iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
 assert.deepEqual(voiceConfig(1, {}), stun);
 assert.deepEqual(voiceConfig(1, { TURN_URLS: 'turn:example.com' }), stun);
 assert.deepEqual(voiceConfig(1, { TURN_SECRET: 'secret' }), stun);
 const config = voiceConfig(7, { TURN_URLS: ' turn:example.com:3478,turns:example.com:5349?transport=tcp,https://invalid', TURN_SECRET: 'secret' }, 100000);
 assert.deepEqual(config.iceServers[1], { urls: ['turn:example.com:3478', 'turns:example.com:5349?transport=tcp'],
  username: '3700:7', credential: createHmac('sha1', 'secret').update('3700:7').digest('base64') });
 assert.ok(!JSON.stringify(config).includes('secret'));
});

async function connect(t, server) {
 const ws = new WebSocket(`ws://127.0.0.1:${server.address().port}`);
 t.after(() => ws.terminate());
 const messages = [];
 ws.on('message', data => messages.push(JSON.parse(data.toString())));
 await once(ws, 'open');
 const send = msg => ws.send(JSON.stringify(msg));
 const fence = async () => {
  const pong = new Promise(resolve => {
   const handler = data => { if (JSON.parse(data.toString()).type === 'pong') { ws.off('message', handler); resolve(); } };
   ws.on('message', handler);
  });
  send({ type: 'ping' }); await pong;
 };
 return { ws, messages, send, fence };
}

test('websocket routing derives identity, revalidates queued sessions, bounds buffers and payloads', { timeout: 10000 }, async t => {
 const game = createGameServer({ tickMs: 100000 });
 t.after(() => game.close());
 game.server.listen(0, '127.0.0.1'); await once(game.server, 'listening');
 assert.equal(game.wss.options.maxPayload, 65536);
 const a = await connect(t, game.server), b = await connect(t, game.server), c = await connect(t, game.server);
 for (const client of [a, b]) { client.send({ type: 'join' }); client.send({ type: 'voice-state', enabled: true }); await client.fence(); }
 c.send({ type: 'create', name: 'other' }); c.send({ type: 'voice-state', enabled: true }); await c.fence();
 const id = client => client.messages.find(m => m.type === 'welcome').peerId;
 const room = game.registry.get('local');
 const signal = { type: 'voice-signal', roomId: 'local', to: id(b), session: room.peers.get(id(a)).voiceSession,
  targetSession: room.peers.get(id(b)).voiceSession, description: { type: 'offer', sdp: 'v=0' }, from: id(c), peerId: id(c) };
 assert.ok(a.messages.findIndex(m => m.type === 'voice-config') < a.messages.findIndex(m => m.type === 'lobby' && m.players.some(p => p.peerId === id(a) && p.voiceSession)));
 a.send(signal); await a.fence(); await b.fence();
 assert.equal(b.messages.filter(m => m.type === 'voice-signal').length, 1);
 assert.equal(b.messages.find(m => m.type === 'voice-signal').from, id(a));
 const other = game.registry.get(c.messages.find(m => m.type === 'welcome').roomId);
 c.send({ ...signal, session: other.peers.get(id(c)).voiceSession });
 a.send({ ...signal, to: id(c), targetSession: other.peers.get(id(c)).voiceSession });
 for (const malformed of [null, [], 1]) a.send(malformed);
 await c.fence(); await a.fence(); await b.fence();
 assert.equal(b.messages.filter(m => m.type === 'voice-signal').length, 1);
 assert.equal(c.messages.filter(m => m.type === 'voice-signal').length, 0);
 room.voiceSignal(id(a), signal); room.voiceState(id(b), false); room.voiceState(id(b), true);
 await a.fence(); await b.fence();
 assert.equal(b.messages.filter(m => m.type === 'voice-signal').length, 1);
 signal.targetSession = room.peers.get(id(b)).voiceSession;
 room.voiceSignal(id(a), signal); room.voiceState(id(a), false); room.voiceState(id(a), true);
 await a.fence(); await b.fence();
 assert.equal(b.messages.filter(m => m.type === 'voice-signal').length, 1);
 signal.session = room.peers.get(id(a)).voiceSession;
 const receiver = [...game.wss.clients][1];
 Object.defineProperty(receiver, 'bufferedAmount', { configurable: true, value: 65536 });
 a.send(signal); await a.fence(); await b.fence();
 assert.equal(b.messages.filter(m => m.type === 'voice-signal').length, 1);
 delete receiver.bufferedAmount;
 const token = room.peers.get(id(a)).token;
 room.voiceSignal(id(a), signal);
 const sourceClosed = once([...game.wss.clients][0], 'close');
 a.ws.terminate(); await sourceClosed;
 await b.fence();
 assert.equal(b.messages.filter(m => m.type === 'voice-signal').length, 1);
 const reconnected = await connect(t, game.server);
 reconnected.send({ type: 'join', token }); await reconnected.fence();
 assert.equal(room.peers.get(id(reconnected)).voiceSession, null);
 reconnected.send({ ...signal, from: id(a) }); await reconnected.fence(); await b.fence();
 assert.equal(b.messages.filter(m => m.type === 'voice-signal').length, 1);
 room.voiceState(id(reconnected), true);
 signal.session = room.peers.get(id(reconnected)).voiceSession;
 room.voiceSignal(id(reconnected), signal);
 b.send({ type: 'create', name: 'moved' }); await b.fence();
 assert.equal(b.messages.filter(m => m.type === 'voice-signal').length, 1);
 const closed = once(c.ws, 'close');
 c.ws.send('x'.repeat(65537));
 assert.equal((await closed)[0], 1009);
});
