import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Box3,Vector3} from 'three';
import {weaponMesh,operatorMesh} from '../src/render.js';
import {cfModel,animateCF,playCF,disposeCF} from '../src/cf-models.js';
import {convert} from '../scripts/convert-cf.mjs';
import {WEAPONS} from '../src/catalog.js';

const firearms=Object.values(WEAPONS).filter(w=>w.slot!=='melee').map(w=>w.id);
const sourceFile=id=>new URL(`../assets-source/cf/${id}-view.mdl`,import.meta.url);
function sourceAttachments(id){
 const buffer=fs.readFileSync(sourceFile(id)),count=buffer.readInt32LE(212),offset=buffer.readInt32LE(216);
 return Array.from({length:count},(_,index)=>{
  const at=offset+index*88;
  return {bone:buffer.readInt32LE(at+36),origin:[0,4,8].map(delta=>buffer.readFloatLE(at+40+delta))};
 });
}
function close(actual,expected,label,tolerance=1e-6){
 assert.ok(actual.toArray().every(Number.isFinite),`${label}: finite coordinate`);
 assert.ok(actual.distanceTo(expected)<tolerance,`${label}: ${actual.toArray()} differs from ${expected.toArray()}`);
}

// Expectations come directly from each source MDL's attachment records, so an
// incorrect generated muzzle cannot make its own regression test pass.
test('source firearm attachments distinguish the barrel from shell ejection',()=>{
 assert.equal(firearms.length,11);
 for(const id of firearms){
  const attachments=sourceAttachments(id),muzzle=attachments[id==='m4'?2:0],ejection=attachments[1];
  assert.ok(muzzle&&ejection,`${id}: source provides muzzle and ejection points`);
  assert.ok(muzzle.bone!==ejection.bone||new Vector3(...muzzle.origin).distanceTo(new Vector3(...ejection.origin))>3,`${id}: muzzle is distinct from ejection`);
 }
 for(const id of ['axe','shovel'])assert.equal(sourceAttachments(id).length,0,`${id}: source has no firearm muzzle`);
});

test('conversion preserves every original firearm attachment bone and position',()=>{
 for(const id of firearms){
  const source=sourceAttachments(id),converted=convert(fs.readFileSync(sourceFile(id)));
  assert.equal(converted.attachments.length,source.length,`${id}: attachment count`);
  for(let i=0;i<source.length;i++){
   assert.equal(converted.attachments[i].bone,source[i].bone,`${id}/${i}: bone`);
   assert.deepEqual(converted.attachments[i].position,source[i].origin,`${id}/${i}: original local coordinate`);
  }
 }
});

test('all eleven first-person firearms anchor effects at the barrel attachment',()=>{
 for(const id of firearms){
  const gun=weaponMesh(id,true),cf=gun.userData.cf,index=id==='m4'?2:0,attachment=sourceAttachments(id)[index],muzzle=gun.userData.muzzle;
  assert.ok(muzzle?.isObject3D,`${id}: effect anchor exists`);
  assert.equal(gun.userData.muzzleAttachment,index,`${id}: muzzle is not the shell ejector`);
  assert.ok(muzzle.parent===cf.bones[attachment.bone],`${id}: attached to native bone`);
  close(muzzle.position,new Vector3(...attachment.origin),`${id}: native local position`);
  gun.updateMatrixWorld(true);
  const position=muzzle.getWorldPosition(new Vector3());
  assert.ok(position.z<-.25,`${id}: idle muzzle lies in front of the view camera`);
  assert.ok(Math.abs(position.x)<.4&&Math.abs(position.y)<.3,`${id}: muzzle remains beside the visible gun`);
  for(const action of ['idle','shoot','reload']){
   playCF(gun,action,{restart:true,once:true,hold:true});
   for(let i=0;i<8;i++){
    animateCF(gun,i===0?0:.041);
    const expected=cf.bones[attachment.bone].localToWorld(new Vector3(...attachment.origin));
    close(muzzle.getWorldPosition(new Vector3()),expected,`${id}/${action}/${i}: follows animation`);
   }
  }
  disposeCF(gun);
 }
});

test('rifle muzzle anchors follow female arms, mirrored views, recoil and aiming transforms',()=>{
 for(const character of ['omoh','fox','star'])for(const side of ['attack','defend'])for(const id of ['m4','ak']){
  const gun=weaponMesh(id,true,character,side),cf=gun.userData.cf,attachment=sourceAttachments(id)[id==='m4'?2:0];
  for(const mirror of [-1,1])for(const aim of [false,true]){
   gun.scale.x=mirror;gun.position.set(aim?-.08:0,-.095,.03);gun.rotation.set(.12,.025,0);
   for(const action of ['idle','shoot','reload']){
    playCF(gun,action,{restart:true,once:true,hold:true});
    for(let i=0;i<5;i++){
     animateCF(gun,i===0?0:.05);
     const expected=cf.bones[attachment.bone].localToWorld(new Vector3(...attachment.origin));
     close(gun.userData.muzzle.getWorldPosition(new Vector3()),expected,`${character}/${side}/${id}/${mirror}/${aim}/${action}/${i}`);
    }
   }
  }
  disposeCF(gun);
 }
});

test('all eleven third-person firearms expose a finite muzzle at the barrel end',()=>{
 for(const id of firearms){
  const gun=weaponMesh(id),anchor=gun.userData.muzzle,point=gun.userData.worldWeapon?.muzzle,bounds=new Box3().setFromObject(gun),size=bounds.getSize(new Vector3());
  assert.ok(anchor?.isObject3D&&point?.isVector3,`${id}: world effect anchor exists`);
  close(anchor.position,point,`${id}: world metadata and scene anchor agree`);
  assert.ok(point.z<-.15,`${id}: muzzle points ahead of the trigger hand`);
  assert.ok(point.z<=bounds.min.z+size.z*.2,`${id}: muzzle lies near the forward barrel end`);
  assert.ok(bounds.distanceToPoint(point)<.12,`${id}: muzzle remains at the visible gun`);
  if(id==='ak')close(point,new Vector3(.10946206401586532,.20144163349151614,-.7036664966583251),'AK: original attachment transformed through receiver',1e-6);
  gun.position.set(12,4,-8);gun.rotation.set(.1,1.2,-.04);gun.scale.setScalar(.82);gun.updateMatrixWorld(true);
  close(anchor.getWorldPosition(new Vector3()),gun.localToWorld(point.clone()),`${id}: world yaw, height and scale`);
 }
});

test('bot muzzle anchors follow the animated held gun instead of a fixed chest offset',()=>{
 for(const character of ['omoh','fox','star'])for(const side of [false,true])for(const id of ['m4','ak']){
  const actor=operatorMesh(character,side,id),held=actor.userData.heldGun,point=held.gun.userData.worldWeapon.muzzle;
  for(const action of ['idle','run','ref_shoot_rifle']){
   playCF(actor,action,{restart:true,once:true,hold:true});
   for(let i=0;i<5;i++){
    animateCF(actor,i===0?0:.06);actor.position.set(12,3.2,-20);actor.rotation.y=i*.63;
    const expected=held.gun.localToWorld(point.clone()),actual=held.gun.userData.muzzle.getWorldPosition(new Vector3());
    close(actual,expected,`${character}/${side}/${id}/${action}/${i}`);
    assert.ok(actual.distanceTo(actor.position)>.8,`${id}: effects originate at held gun height`);
   }
  }
  disposeCF(actor);
 }
});

test('melee weapons and arms-only rigs cannot expose a firearm muzzle',()=>{
 for(const id of ['knife','axe','shovel'])for(const view of [false,true]){
  const gun=weaponMesh(id,view);
  assert.ok(gun.userData.muzzle===undefined,`${id}/${view}: no firearm effect anchor`);
  gun.traverse(node=>assert.equal(node.name==='muzzle',false,`${id}/${view}: no hidden descendant muzzle`));
  disposeCF(gun);
 }
 const arms=cfModel('m4-view',{view:true,armsOnly:true,characterAsset:'fox-bl'});
 assert.ok(arms.userData.muzzle===undefined,'arms-only native rig does not create a rifle muzzle');disposeCF(arms);
});
