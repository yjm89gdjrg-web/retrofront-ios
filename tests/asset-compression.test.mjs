import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {decodeCompressedJSON,restoreStringTable} from '../src/asset-compression.js';
import {compressModelJSON} from '../scripts/convert-cf.mjs';
import {CF_MODELS,CF_ARM_TEXTURES,CF_MODEL_SOURCE} from '../src/generated/cf-models.js';

test('model compression preserves every generated JSON byte and all 28 model exports',()=>{
 const raw=Buffer.from(JSON.stringify({models:CF_MODELS,armTextures:CF_ARM_TEXTURES}));
 assert.equal(CF_MODEL_SOURCE.compression,'zlib');assert.equal(CF_MODEL_SOURCE.encoding,'string-table-v1');assert.equal(raw.length,CF_MODEL_SOURCE.jsonBytes);
 assert.ok(CF_MODEL_SOURCE.encodedJSONBytes<raw.length*.75,'shared strings reduce the parsed text and its transient buffer');
 assert.equal(createHash('sha256').update(raw).digest('hex'),CF_MODEL_SOURCE.sha256);assert.equal(Object.keys(CF_MODELS).length,28);
 assert.ok(CF_MODELS['yun-gr'].meshes.length>0);assert.ok(CF_ARM_TEXTURES.cloth.pixels&&CF_ARM_TEXTURES.glove.pixels);
 const module=readFileSync(new URL('../src/generated/cf-models.js',import.meta.url));assert.ok(module.length<raw.length/2,'compressed model module must materially reduce cold script bytes');
});

test('browser-compatible decoder keeps unicode, integer and floating-point JSON values unchanged',()=>{
 const expected={name:'云悠悠 / OMOH',positions:[Math.PI,Number.MIN_VALUE,1.0000001192092896,-123456789.01234567],unicode:'\u0000💥',nested:{weights:[.1,.2,.7],missing:null,enabled:true}};
 const raw=Buffer.from(JSON.stringify(expected)),packed=deflateSync(raw).toString('base64');assert.deepEqual(decodeCompressedJSON(packed,raw.length),expected);
 assert.throws(()=>decodeCompressedJSON(packed,raw.length+1),/length mismatch/);assert.throws(()=>decodeCompressedJSON(packed,0),/Invalid/);assert.throws(()=>decodeCompressedJSON('not zlib',raw.length));
});

test('string dictionary escapes all original object and array shapes plus short marker-like strings',()=>{
 const repeated='precise-model-data/云悠悠'.repeat(20),expected={r:0,a:['r',0,{r:0},{a:[]},{o:{}}],o:{strings:['{"r":0}','__proto__','string-table-v1']},first:repeated,nested:[repeated,{again:repeated}],special:JSON.parse('{"__proto__":{"polluted":true},"constructor":{"r":0}}')};
 const {packed,source}=compressModelJSON(expected),restored=decodeCompressedJSON(packed,source.encodedJSONBytes,source.encoding);
 assert.deepEqual(restored,expected);assert.equal(JSON.stringify(restored),JSON.stringify(expected));assert.equal(source.strings,1);
 assert.equal(Object.getPrototypeOf(restored.special),Object.prototype);assert.equal(Object.prototype.hasOwnProperty.call(restored.special,'__proto__'),true);assert.equal(Object.prototype.polluted,undefined);
 const raw=Buffer.from(JSON.stringify(restored));assert.equal(createHash('sha256').update(raw).digest('hex'),source.sha256);
});

test('invalid dictionary references, malformed nodes and unknown encodings are rejected',()=>{
 const packet=root=>({version:1,strings:['only entry'],root});
 for(const r of [-1,1,.5,'0',null,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>restoreStringTable(packet({r})),/Invalid model string reference/);
 for(const root of [{r:0,o:{}},{unknown:0},[],{a:{}},{o:[]}])assert.throws(()=>restoreStringTable(packet(root)),/Invalid model JSON/);
 assert.throws(()=>restoreStringTable({version:1,strings:[0],root:0}),/Invalid model string table/);
 const raw=Buffer.from('null'),packed=deflateSync(raw).toString('base64');assert.throws(()=>decodeCompressedJSON(packed,raw.length,'unknown'),/Unsupported/);
});
