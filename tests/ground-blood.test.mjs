import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {BloodEffects} from '../src/blood-effects.js';
const hit={id:2,position:[0,1,0],direction:[0,0,-1],damage:30};
function fixture(options={}){
 const world=new T.Scene(),root=new T.Group();world.add(root);world.userData.desertWorld={world:root};
 const addFloor=(height=0,slope=0,size=4)=>{const mesh=new T.Mesh(new T.PlaneGeometry(size,size),new T.MeshBasicMaterial());mesh.rotation.set(-Math.PI/2+slope,0,0);mesh.position.y=height;mesh.userData.bspModel=0;root.add(mesh);return mesh;};
 const fx=new BloodEffects(world,{texture:new T.DataTexture(new Uint8Array(4),1,1),...options});
 const cleanup=()=>{fx.dispose();root.traverse(n=>{n.geometry?.dispose();n.material?.dispose();});};return {fx,addFloor,cleanup};
}
test('blood lands on the nearest floor below the hit, not the overhead floor or a zero-height plane',()=>{
 const {fx,addFloor,cleanup}=fixture();addFloor(-3);addFloor(2);addFloor(5);fx.emit({...hit,position:[0,3,0]});
 const stain=fx.ground.stains[0];assert.ok(stain);const p=stain.node.geometry.attributes.position;for(let i=0;i<p.count;i++)assert.ok(Math.abs(p.getY(i)-2)<1e-6);
 assert.equal(stain.node.material.depthTest,true);assert.equal(stain.node.material.depthWrite,false);assert.equal(stain.node.material.polygonOffset,true);cleanup();
});
test('ground projection follows a ramp and clips at its edge',()=>{
 const {fx,addFloor,cleanup}=fixture();const floor=addFloor(0,.25,1);fx.emit({...hit,position:[.44,1,0]});const p=fx.ground.stains[0].node.geometry.attributes.position;
 floor.updateMatrixWorld();const inverse=floor.matrixWorld.clone().invert();for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(inverse);assert.ok(Math.abs(v.z)<1e-6);assert.ok(Math.abs(v.x)<=.50001&&Math.abs(v.y)<=.50001);}cleanup();
});
test('corpse hits and local-player damage stain the ground; misses and invalid damage do not',()=>{
 const {fx,addFloor,cleanup}=fixture();addFloor();fx.emit({...hit,damage:0});assert.equal(fx.ground.stains.length,0);
 fx.emit({...hit,damage:0,corpse:true});fx.emit(hit,{spray:false});assert.equal(fx.ground.stains.length,2);assert.equal(fx.bursts.length,1);
 fx.emit({...hit,position:[20,1,20]});assert.equal(fx.ground.stains.length,2);cleanup();
});
test('blood has a landing delay, freezes while paused, fades, and releases bounded geometry',()=>{
 const {fx,addFloor,cleanup}=fixture({maxStains:2});addFloor();fx.emit(hit);const first=fx.ground.stains[0].node;let removed=0;first.geometry.addEventListener('dispose',()=>removed++);
 assert.equal(first.material.opacity,0);fx.update(.6);assert.equal(first.material.opacity,.96);fx.update(0);assert.equal(first.material.opacity,.96);
 fx.emit({...hit,id:3});fx.emit({...hit,id:4});assert.equal(removed,1);assert.deepEqual(fx.ground.stains.map(s=>s.id),[3,4]);
 fx.update(40);assert.ok(fx.ground.stains[0].node.material.opacity<.96);fx.update(6);assert.equal(fx.ground.stains.length,0);
 fx.emit(hit);const last=fx.ground.stains[0].node;let disposed=0;last.material.addEventListener('dispose',()=>disposed++);fx.clear();assert.equal(disposed,1);assert.equal(fx.ground.stains.length,0);cleanup();
});
test('64 overlapping stains share a single draw mesh while retaining independent fades and cleanup',()=>{
 const {fx,addFloor,cleanup}=fixture();addFloor();
 for(let i=0;i<64;i++)fx.emit({...hit,id:i},{spray:false});fx.update(.6);
 const ground=fx.ground,batch=ground.batch;assert.ok(batch);assert.equal(fx.world.children.filter(n=>n.name==='ground-blood-batch').length,1);
 assert.equal(batch.geometry.drawRange.count,ground.stains.reduce((sum,s)=>sum+s.count,0));assert.equal(batch.material.map,fx.groundMap);assert.equal(batch.material.vertexColors,true);
 const colors=batch.geometry.attributes.color;for(const stain of ground.stains)assert.ok(Math.abs(colors.getW(stain.offset)-.96)<1e-6);
 fx.emit({...hit,id:65},{spray:false});fx.update(0);assert.equal(ground.stains.length,64);const newest=ground.stains.at(-1);assert.equal(ground.batch.geometry.attributes.color.getW(newest.offset),0);
 const revision=ground.batch.geometry.attributes.color.version,ranges=ground.batch.geometry.attributes.color.updateRanges.map(r=>({...r}));fx.update(0);assert.equal(ground.batch.geometry.attributes.color.version,revision,'paused opacity does not upload unchanged buffers');assert.deepEqual(ground.batch.geometry.attributes.color.updateRanges,ranges,'the post-event zero-time pass preserves pending partial GPU uploads');
 let geometryDisposals=0,materialDisposals=0;ground.batch.geometry.addEventListener('dispose',()=>geometryDisposals++);ground.batch.material.addEventListener('dispose',()=>materialDisposals++);fx.clear();assert.equal(ground.batch,null);assert.equal(geometryDisposals,1);assert.equal(materialDisposals,1);cleanup();
});
