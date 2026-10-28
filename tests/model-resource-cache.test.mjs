import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {cfModel,cfWorldWeapon,playCF,animateCF,disposeCF} from '../src/cf-models.js';
const meshes=root=>{const out=[];root.traverse(node=>{if(node.isMesh)out.push(node);});return out;};
function destroy(root){disposeCF(root);root.traverse(node=>{if(node.geometry&&!node.geometry.userData.cfShared)node.geometry.dispose();if(node.material&&!node.material.userData.cfShared)node.material.dispose();});}

test('actors share immutable poses and source pixels while keeping independent bones and geometry owners',()=>{
 const first=cfModel('omoh'),second=cfModel('omoh'),a=first.userData.cf,b=second.userData.cf,one=meshes(first)[0],two=meshes(second)[0];
 assert.equal(a.clips[a.idle].poses,b.clips[b.idle].poses);assert.equal(one.material.map,two.material.map);assert.equal(one.material.map.userData.cfShared,true);
 assert.notEqual(a.skeleton,b.skeleton);assert.notEqual(a.bones[0],b.bones[0]);assert.notEqual(one.geometry,two.geometry);assert.notEqual(one.material,two.material);
 const before=b.bones.map(bone=>[...bone.position,...bone.quaternion]);playCF(first,'death',{restart:true,once:true,hold:true});animateCF(first,.5);assert.deepEqual(b.bones.map(bone=>[...bone.position,...bone.quaternion]),before);
 destroy(first);destroy(second);
});

test('disposing one character or disposing it twice leaves other texture users intact',()=>{
 const first=cfModel('omoh'),second=cfModel('omoh'),map=meshes(first)[0].material.map;let disposals=0;map.addEventListener('dispose',()=>disposals++);
 destroy(first);disposeCF(first);assert.equal(disposals,0);assert.equal(meshes(second)[0].material.map,map);
 destroy(second);assert.equal(disposals,1);
 const next=cfModel('omoh');assert.notEqual(meshes(next)[0].material.map,map);assert.equal(meshes(next)[0].material.map.image.data,map.image.data);destroy(next);
});

test('world guns reuse baked geometry and materials until their final owner is released',()=>{
 const first=cfWorldWeapon('ak'),second=cfWorldWeapon('ak'),one=meshes(first)[0],two=meshes(second)[0];let geometryDisposals=0,materialDisposals=0;
 assert.equal(one.geometry,two.geometry);assert.equal(one.material,two.material);assert.equal(one.geometry.userData.cfShared,true);assert.equal(one.material.userData.cfShared,true);
 one.geometry.addEventListener('dispose',()=>geometryDisposals++);one.material.addEventListener('dispose',()=>materialDisposals++);
 const muzzle=second.userData.muzzle.position.clone();first.position.set(5,0,0);first.userData.muzzle.position.x+=1;assert.ok(second.userData.muzzle.position.distanceTo(muzzle)<1e-10);
 destroy(first);disposeCF(first);assert.equal(geometryDisposals,0);assert.equal(materialDisposals,0);assert.ok(two.geometry.attributes.position.count>0);
 destroy(second);assert.equal(geometryDisposals,1);assert.equal(materialDisposals,1);
 const next=cfWorldWeapon('ak');assert.notEqual(meshes(next)[0].geometry,one.geometry);destroy(next);
});

test('cached character palm anchors retain native grip locations through independent animations',()=>{
 const first=cfModel('fox-gr'),second=cfModel('fox-gr');
 for(const side of ['right','left'])assert.ok(first.userData.cf.grips[side].position.distanceTo(second.userData.cf.grips[side].position)<1e-10);
 playCF(first,'death',{restart:true,once:true,hold:true});animateCF(first,.4);animateCF(second,0);
 const a=first.userData.cf.grips.right.getWorldPosition(new Vector3()),b=second.userData.cf.grips.right.getWorldPosition(new Vector3());assert.ok(a.distanceTo(b)>.05);destroy(first);destroy(second);
});
