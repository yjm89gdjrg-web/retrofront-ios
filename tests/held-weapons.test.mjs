import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Quaternion,Vector3} from 'three';
import {weaponMesh,operatorMesh} from '../src/render.js';
import {animateCF,playCF,disposeCF} from '../src/cf-models.js';

test('world rifle geometry puts the barrel forward and the magazine below the receiver',()=>{
 for(const id of ['m4','ak']){
  const gun=weaponMesh(id),bounds=new Box3().setFromObject(gun),size=bounds.getSize(new Vector3());
  assert.ok(size.z>size.x*3,'rifle length follows the forward axis');
  assert.ok(-bounds.min.z>bounds.max.z*1.3,'the longer barrel is ahead of the grip');
  gun.traverse(mesh=>{assert.ok(!mesh.isSkinnedMesh,'world rifle must not inherit first-person sway');assert.notEqual(mesh.material?.name,'SILENCER.bmp','unattached spare silencer must not float under the rifle');});
  if(id==='m4'){
   const magazine=gun.children.find(m=>m.material.name==='project_m4_mag.bmp'),mag=new Box3().setFromObject(magazine);
   assert.ok(mag.min.y<-.15,'magazine hangs below the grip');assert.ok(mag.max.y<.09,'magazine does not point above the receiver');
  }
 }
});

test('all character variants keep the held rifle forward and upright through animation and yaw',()=>{
 for(const character of ['omoh','fox','star'])for(const enemy of [false,true])for(const weapon of ['m4','ak']){
  const model=operatorMesh(character,enemy,weapon),held=model.userData.heldGun,cf=model.userData.cf;
  for(const action of ['idle','run','ref_shoot_rifle','death']){
   const name=action==='idle'?cf.idle:action==='death'?'death1':action,clip=cf.clips[name],duration=(clip.frames-1)/clip.fps;
   playCF(model,action,{restart:true,once:true,hold:true});
   for(let sample=0;sample<=12;sample++){
    animateCF(model,sample===0?0:duration/12);
    for(const yaw of [0,Math.PI/2,Math.PI-.0001,Math.PI+.0001,Math.PI*1.75]){
     model.rotation.y=yaw;model.updateMatrixWorld(true);
     const palms=model.userData.cf.grips,right=palms.right.getWorldPosition(new Vector3()),left=palms.left.getWorldPosition(new Vector3()),forward=left.sub(right).normalize(),up=held.torsoTop.getWorldPosition(new Vector3()).sub(held.torsoBase.getWorldPosition(new Vector3())).normalize();
     up.addScaledVector(forward,-up.dot(forward)).normalize();
     const q=held.gun.getWorldQuaternion(new Quaternion()),barrel=new Vector3(0,0,-1).applyQuaternion(q),top=new Vector3(0,1,0).applyQuaternion(q);
     assert.ok(barrel.dot(forward)>.8,`${character}/${enemy}/${weapon}/${action}: barrel points ahead of the supporting palm`);
     assert.ok(top.dot(up)>.65,`${character}/${enemy}/${weapon}/${action}: rifle stays upright without a roll flip`);
     assert.ok(held.gun.localToWorld(held.gun.userData.worldWeapon.grip.clone()).distanceTo(right)<.001,'visible grip stays inside the trigger palm');
     assert.ok(q.toArray().every(Number.isFinite));
    }
   }
  }
  disposeCF(model);
 }
});
