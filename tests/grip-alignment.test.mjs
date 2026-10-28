import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Quaternion,Triangle,Vector3} from 'three';
import {operatorMesh,weaponMesh} from '../src/render.js';
import {animateCF,playCF,disposeCF} from '../src/cf-models.js';
import {WEAPON_SLOTS} from '../src/catalog.js';

function handCenters(actor,hand){
 const cf=actor.userData.cf,indices=new Set(cf.bones.map((bone,index)=>{
  let node=bone;while(node&&node!==hand)node=node.parent;return node===hand?index:-1;
 }).filter(index=>index>=0)),unique=new Map();
 actor.updateMatrixWorld(true);
 actor.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const bones=mesh.geometry.attributes.skinIndex;
  for(let i=0;i<bones.count;i++)if(indices.has(bones.getX(i))){
   const p=hand.worldToLocal(mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld));
   unique.set(p.toArray().map(value=>Math.round(value*10000)).join(','),p);
  }
 });
 const points=[...unique.values()];assert.ok(points.length>15,'the actual hand has enough vertices to locate its palm');
 return {bounds:new Box3().setFromPoints(points).getCenter(new Vector3()),mean:points.reduce((center,p)=>center.add(p),new Vector3()).divideScalar(points.length)};
}
function meshDistance(gun,point){
 let distance=Infinity;const nearest=new Vector3(),triangle=new Triangle();
 gun.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const positions=mesh.geometry.attributes.position,index=mesh.geometry.index,count=index?.count??positions.count;
  for(let i=0;i<count;i+=3){
   for(const [k,name]of [[0,'a'],[1,'b'],[2,'c']])triangle[name].fromBufferAttribute(positions,index?index.getX(i+k):i+k);
   if(triangle.getArea()<1e-12)continue;
   triangle.closestPointToPoint(point,nearest);const d=nearest.distanceTo(point);if(Number.isFinite(d)&&d<distance)distance=d;
  }
 });return distance;
}
function worldGrip(gun,key,label){
 const point=gun.userData.worldWeapon?.[key];assert.ok(point?.isVector3,`${label}: weapon exposes a ${key} contact point`);
 assert.ok(point.toArray().every(Number.isFinite),`${label}: finite ${key} contact point`);
 return gun.localToWorld(point.clone());
}
function contactDistance(point,hand,centers){
 return Math.min(point.distanceTo(hand.localToWorld(centers.bounds.clone())),point.distanceTo(hand.localToWorld(centers.mean.clone())));
}

test('rifle grip contacts lie in the actual pistol grip and handguard geometry',()=>{
 for(const id of ['m4','ak']){
  const gun=weaponMesh(id),meta=gun.userData.worldWeapon;
  for(const key of ['grip','support'])assert.ok(meta?.[key]?.isVector3,`${id}: ${key} metadata exists`);
  assert.ok(meta.grip.y<-.025&&meta.grip.y>-.17&&meta.grip.z>-.06&&meta.grip.z<.15,`${id}: trigger contact is on the pistol grip`);
  assert.ok(meta.support.z<-.22&&meta.support.z>-.5&&meta.support.y>.04&&meta.support.y<.21,`${id}: support contact is on the handguard`);
  assert.ok(meshDistance(gun,meta.grip)<.04,`${id}: trigger contact reaches visible geometry`);
  assert.ok(meshDistance(gun,meta.support)<.055,`${id}: support contact reaches visible geometry`);
  assert.ok(meta.grip.distanceTo(meta.support)>.3,`${id}: two separate contact points fit a rifle hold`);
 }
});

test('all character variants fit both palms to the rifle through idle, running and shooting',()=>{
 for(const character of ['omoh','fox','star'])for(const enemy of [false,true])for(const id of ['m4','ak']){
  const actor=operatorMesh(character,enemy,id),held=actor.userData.heldGun,label=`${character}/${enemy}/${id}`;
  const right=handCenters(actor,held.right),left=handCenters(actor,held.left);
  for(const action of ['idle','run','ref_shoot_rifle']){
   playCF(actor,action,{restart:true,once:true,hold:true});
   for(let i=0;i<9;i++){
    animateCF(actor,i===0?0:.04);actor.position.set(12,3.2,-20);actor.rotation.y=i*.49;actor.updateMatrixWorld(true);
    const gun=held.gun,r=worldGrip(gun,'grip',label),l=worldGrip(gun,'support',label);
    assert.ok(contactDistance(r,held.right,right)<.03,`${label}/${action}/${i}: trigger stays inside the right palm`);
    assert.ok(contactDistance(l,held.left,left)<.03,`${label}/${action}/${i}: handguard stays inside the left palm`);
    const scale=gun.scale;assert.ok(scale.x>=.5&&scale.x<=1.3,`${label}: bounded human-sized rifle`);
    assert.ok(Math.abs(scale.x-scale.y)<1e-6&&Math.abs(scale.x-scale.z)<1e-6,`${label}: uniform scale preserves the rifle shape`);
    const q=gun.getWorldQuaternion(new Quaternion()),forward=new Vector3(0,0,-1).applyQuaternion(q),up=new Vector3(0,1,0).applyQuaternion(q),torso=held.torsoTop.getWorldPosition(new Vector3()).sub(held.torsoBase.getWorldPosition(new Vector3())).normalize();
    assert.ok(forward.dot(l.clone().sub(r).normalize())>.8,`${label}: barrel points forward along the supporting hand`);
    assert.ok(up.dot(torso)>.65,`${label}: rifle remains upright rather than flipping over`);
    const muzzle=gun.userData.muzzle.getWorldPosition(new Vector3()),expected=gun.localToWorld(gun.userData.worldWeapon.muzzle.clone());
    assert.ok(muzzle.distanceTo(expected)<1e-6,`${label}: gun flame anchor follows the fitted rifle`);
   }
  }
  disposeCF(actor);
 }
});

test('female palm targets come from the hand surface rather than the wrist origin',()=>{
 for(const character of ['fox','star'])for(const enemy of [false,true]){
  const actor=operatorMesh(character,enemy,'m4'),held=actor.userData.heldGun;
  for(const hand of [held.right,held.left]){
   const centers=handCenters(actor,hand),wrist=hand.getWorldPosition(new Vector3()),palm=hand.localToWorld(centers.bounds.clone());
   assert.ok(palm.distanceTo(wrist)>.085,`${character}/${enemy}: visible female palm is ahead of its wrist bone`);
  }
  disposeCF(actor);
 }
});

test('every warehouse primary weapon remains held at both palms across character variants',()=>{
 assert.equal(WEAPON_SLOTS.primary.length,7);
 for(const character of ['omoh','fox','star'])for(const enemy of [false,true])for(const id of WEAPON_SLOTS.primary){
  const actor=operatorMesh(character,enemy,id),held=actor.userData.heldGun,label=`${character}/${enemy}/${id}`;
  const right=handCenters(actor,held.right).bounds,left=handCenters(actor,held.left).bounds;
  for(const action of ['idle','run','ref_shoot_rifle']){
   playCF(actor,action,{restart:true,once:true,hold:true});
   const clip=actor.userData.cf.clips[actor.userData.cf.current],step=(clip.frames-1)/clip.fps/8;
   for(let i=0;i<=8;i++){
    animateCF(actor,i===0?0:step);actor.position.set(12,3.2,-20);actor.rotation.y=i*1.07;actor.updateMatrixWorld(true);
    const gun=held.gun,r=worldGrip(gun,'grip',label),l=worldGrip(gun,'support',label),rExpected=held.right.localToWorld(right.clone()),lExpected=held.left.localToWorld(left.clone());
    const rGap=r.distanceTo(rExpected),lGap=l.distanceTo(lExpected);
    assert.ok(rGap<.03,`${label}/${action}/${i}: trigger gap ${rGap.toFixed(5)}m`);
    assert.ok(lGap<.03,`${label}/${action}/${i}: handguard gap ${lGap.toFixed(5)}m`);
    assert.ok(gun.scale.toArray().every(scale=>Number.isFinite(scale)&&scale>=.5&&scale<=1.3),`${label}: finite bounded scale`);
   }
  }
  disposeCF(actor);
 }
});
