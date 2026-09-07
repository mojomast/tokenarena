import test from 'node:test';
import assert from 'node:assert/strict';
import {Room} from './room.mjs';
function rng(){let n=11;return()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);}
const find=(msgs,type,to)=>msgs.find(m=>m.msg.type===type&&(to===undefined||m.to===to))?.msg;
const chatCount=msgs=>msgs.filter(m=>m.msg.type==='chat').length;
test('chat sanitizes control characters, trims and caps at 200 chars',()=>{
 const room=new Room('r',rng());
 room.join(1,'Alice');
 const long='x'.repeat(500);
 room.chat(1,`\u0000 hi\u001b \u007f there ${long}`);
 const msg=find(room.drain(),'chat');
 assert.ok(msg,'chat broadcast emitted');
 assert.equal(msg.name,'Alice');
 assert.ok(msg.text.startsWith('hi')&&msg.text.includes('there'));
 assert.equal(msg.text.length,200);
 assert.ok(msg.time>0);
 assert.ok(!/[\u0000-\u001f\u007f]/.test(msg.text));
});
test('empty chat is dropped',()=>{
 const room=new Room('r',rng());
 room.join(1,'Alice');
 room.chat(1,'');
 room.chat(1,'   \u0000\t ');
 assert.equal(chatCount(room.drain()),0,'no broadcast for empty text');
});
test('chat is rate-limited to one message per 300ms per peer',()=>{
 const room=new Room('r',rng());
 room.join(1,'Alice');
 room.chat(1,'one',1000);
 room.chat(1,'two',1100);
 room.chat(1,'three',1300);
 room.chat(1,'four',1400);
 const msgs=room.drain();
 assert.equal(chatCount(msgs),2,'messages inside the window are dropped');
 assert.deepEqual(msgs.filter(m=>m.msg.type==='chat').map(m=>m.msg.text),['one','three']);
});
test('unknown peers are ignored',()=>{
 const room=new Room('r',rng());
 room.join(1,'Alice');
 room.chat(99,'hello');
 assert.equal(chatCount(room.drain()),0);
});
test('spectators chat like any peer and every peer receives the broadcast',()=>{
 const room=new Room('r',rng());
 room.join(1,'Alice');
 room.join(2,'Bob');
 room.join(3,'Snoop','','','',true);
 room.drain();
 room.chat(3,'watching',1000);
 const msgs=room.drain();
 const msg=find(msgs,'chat');
 const envelope=msgs.find(m=>m.msg.type==='chat');
 assert.equal(msg.name,'Snoop','spectator name attached');
 assert.equal(msg.peerId,3);
 assert.equal(envelope.to,null,'delivered as a room broadcast');
 room.chat(1,'hello',2000);
 const msgs2=room.drain();
 assert.equal(find(msgs2,'chat').text,'hello');
 assert.equal(find(msgs2,'chat').name,'Alice');
});
