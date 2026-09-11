import test from 'node:test';
import assert from 'node:assert/strict';
import {quantizeNumbers} from './quantize.mjs';

test('quantizeNumbers rounds finite numbers at the requested precision',()=>{
 const value={a:1.23456,b:1.23456,c:[1.9999,{d:0.0004}],e:'∞',f:Infinity,g:null,h:true};
 quantizeNumbers(value,3);
 assert.equal(value.a,1.235);
 assert.equal(value.b,1.235);
 assert.equal(value.c[0],2);
 assert.equal(value.c[1].d,0);
 assert.equal(value.e,'∞');
 assert.equal(value.f,Infinity);
 assert.equal(value.g,null);
 assert.equal(value.h,true);
});

test('quantizeNumbers supports a custom precision and preserves object identity',()=>{
 const value={x:1.23456,nested:{y:-9.87654}};
 const same=quantizeNumbers(value,2);
 assert.equal(same,value);
 assert.equal(value.x,1.23);
 assert.equal(value.nested.y,-9.88);
});

test('quantized snapshots serialize smaller than raw physics floats',()=>{
 const raw={actors:[{x:1.23456789,y:2.3456789,z:3.456789,vx:.987654321,yaw:Math.PI/7}],time:12.3456789};
 const quantized=quantizeNumbers(structuredClone(raw));
 assert.ok(JSON.stringify(quantized).length<JSON.stringify(raw).length);
});
