import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {Scene,DataTexture,PerspectiveCamera,Vector3} from 'three';import {BloodEffects} from '../src/blood-effects.js';import {BLOOD_ASSET} from '../src/generated/blood-asset.js';
const hit={id:1,position:[3,1.1,-5],direction:[0,0,-1],damage:34,headshot:false,fatal:false};
const create=options=>new BloodEffects(new Scene(),{texture:new DataTexture(new Uint8Array(512*512*4),512,512),...options});
test('the offline atlas preserves the downloaded CC0 original and its 16-frame layout',async()=>{
 const original=await readFile(new URL('../assets-source/vfx/blood/blood_hit_03.png',import.meta.url)),embedded=Buffer.from(BLOOD_ASSET.image.split(',')[1],'base64');assert.deepEqual(embedded,original);
 assert.equal(createHash('sha256').update(original).digest('hex'),'772881ae173e39f488e7ef5cbbc60ae70515460c0faa28db4f6236dfdacd3270');
 assert.equal(original.readUInt32BE(16),512);assert.equal(original.readUInt32BE(20),512);assert.equal(BLOOD_ASSET.frames,16);assert.equal(BLOOD_ASSET.fps,30);assert.equal(BLOOD_ASSET.license,'CC0-1.0');
});
test('blood spawns at the actual character hit point with depth occlusion and rejects invalid hits',()=>{
 const fx=create();for(const event of [{...hit,damage:0},{...hit,position:[NaN,0,0]},{...hit,direction:[0,0,0]}])assert.equal(fx.emit(event),false);
 assert.equal(fx.emit(hit),true);const b=fx.bursts[0];assert.ok(b.node.position.distanceTo(new Vector3(3,1.1,-4.955))<1e-9);assert.equal(b.node.material.depthTest,true);assert.equal(b.node.material.depthWrite,false);assert.equal(b.id,1);assert.equal(fx.world.children.length,1);fx.dispose();
});
test('animation reads the source top-left first and each simultaneous hit keeps its own frame',()=>{
 const fx=create();fx.emit(hit);fx.update(5/30);fx.emit({...hit,id:2});fx.update(0);
 const [first,second]=fx.bursts;assert.equal(first.frame,5);assert.equal(second.frame,0);assert.deepEqual(first.node.material.map.offset.toArray(),[.25,.5]);assert.deepEqual(second.node.material.map.offset.toArray(),[0,.75]);assert.deepEqual(first.node.material.map.repeat.toArray(),[.25,.25]);
 assert.equal(first.node.material.map.source,second.node.material.map.source);assert.notEqual(first.node.material.map,second.node.material.map);fx.dispose();
});
test('pause freezes blood frame, size and opacity; resume fades and expires without texture disposal',()=>{
 const fx=create(),camera=new PerspectiveCamera();let textureDisposals=0,materialDisposals=0;fx.texture.addEventListener('dispose',()=>textureDisposals++);fx.emit(hit);const node=fx.bursts[0].node;node.material.addEventListener('dispose',()=>materialDisposals++);
 fx.update(.4,camera);const before={frame:fx.bursts[0].frame,size:node.scale.x,opacity:node.material.opacity};fx.update(0,camera);assert.deepEqual({frame:fx.bursts[0].frame,size:node.scale.x,opacity:node.material.opacity},before);assert.ok(before.opacity<.9);
 fx.update(.2,camera);assert.equal(fx.bursts.length,0);assert.equal(fx.world.children.length,0);assert.equal(materialDisposals,1);assert.equal(textureDisposals,0);fx.dispose();assert.equal(textureDisposals,1);
});
test('repeated automatic hits have a hard budget and clear releases materials and all shared maps once',()=>{
 const fx=create({maxBursts:3});let oldestDisposals=0,mapDisposals=0;fx.emit(hit);fx.bursts[0].node.material.addEventListener('dispose',()=>oldestDisposals++);
 for(let id=2;id<=20;id++)fx.emit({...hit,id});assert.equal(fx.bursts.length,3);assert.deepEqual(fx.bursts.map(b=>b.id),[18,19,20]);assert.equal(oldestDisposals,1);assert.equal(fx.world.children.length,3);
 for(const map of fx.frames)map.addEventListener('dispose',()=>mapDisposals++);fx.clear();assert.equal(fx.world.children.length,0);assert.equal(mapDisposals,0);fx.dispose();assert.equal(mapDisposals,16);
});
