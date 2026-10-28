import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {cfModel,playCF,animateCF,disposeCF} from '../src/cf-models.js';
import {CF_MODELS} from '../src/generated/cf-models.js';
import {convert} from '../scripts/convert-cf.mjs';
import fs from 'node:fs';
for(const id of Object.keys(CF_MODELS))test(`CF ${id}: valid skins and finite animated geometry`,()=>{
 const model=cfModel(id,{view:id.includes('view')}),cf=model.userData.cf;
 for(const [name,clip] of Object.entries(cf.clips)){
  assert.equal(clip.poses.length,clip.frames*cf.bones.length*7);assert.ok(clip.fps>0);assert.ok(clip.poses.every(Number.isFinite));
  cf.play(name,{restart:true});cf.update(.12);cf.skeleton.update();
  model.traverse(o=>{if(!o.isSkinnedMesh)return;const count=o.geometry.attributes.position.count;assert.ok(count>0);for(const index of [0,Math.floor(count/2),count-1]){const p=o.getVertexPosition(index,new Vector3());assert.ok(p.toArray().every(Number.isFinite));assert.ok(p.length()<1000,'unexpected exploded geometry');}assert.ok(o.material.map.image.data.length>0);});
 }
 disposeCF(model);
});
test('viewmodel shooting and reload recover to idle, frozen time preserves pose',()=>{
 const model=cfModel('ak-view',{view:true}),cf=model.userData.cf;
 playCF(model,'reload',{once:true,restart:true,duration:2.5});animateCF(model,1);assert.equal(cf.current,'reload');const q=cf.bones.map(b=>b.quaternion.toArray());animateCF(model,0);assert.deepEqual(cf.bones.map(b=>b.quaternion.toArray()),q);animateCF(model,2);assert.equal(cf.current,cf.idle);
 playCF(model,'shoot',{once:true,restart:true});assert.equal(cf.current,'shoot1');animateCF(model,2);assert.equal(cf.current,cf.idle);disposeCF(model);
});
test('OMOH requires the separate texture MDL; corrupt input is rejected',()=>{
 const model=fs.readFileSync(new URL('../assets-source/cf/omoh.mdl',import.meta.url)),texture=fs.readFileSync(new URL('../assets-source/cf/omohT.mdl',import.meta.url));assert.throws(()=>convert(model));assert.equal(convert(model,texture).textures.length,5);const broken=Buffer.from(model);broken.writeInt32LE(99,4);assert.throws(()=>convert(broken,texture),/Invalid MDL/);
});
