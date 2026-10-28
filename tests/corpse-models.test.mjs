import test from 'node:test';import assert from 'node:assert/strict';import {Group,Bone,BoxGeometry,SkinnedMesh,Mesh,MeshBasicMaterial,Skeleton,Uint16BufferAttribute,Float32BufferAttribute,DoubleSide,Box3,Vector3,Scene,DataTexture} from 'three';
import {traceCorpseModels} from '../src/corpse-hit.js';import {cfModel,animateCF,playCF,disposeCF} from '../src/cf-models.js';import {BloodEffects} from '../src/blood-effects.js';
function fixture(){
 const root=new Group(),bone=new Bone();root.add(bone);const geometry=new BoxGeometry(1,.3,2),count=geometry.attributes.position.count;
 geometry.setAttribute('skinIndex',new Uint16BufferAttribute(new Uint16Array(count*4),4));const weights=new Float32Array(count*4);for(let i=0;i<count;i++)weights[i*4]=1;geometry.setAttribute('skinWeight',new Float32BufferAttribute(weights,4));
 const body=new SkinnedMesh(geometry,new MeshBasicMaterial({side:DoubleSide}));root.add(body);root.updateMatrixWorld(true);body.bind(new Skeleton([bone]));
 const actor={id:1,dead:true,team:'defend',character:'omoh'},trace=(origin=[0,2,0],dir=[0,-1,0],range=5)=>traceCorpseModels([actor],()=>root,origin,dir,range);return {root,bone,body,actor,trace};
}
test('corpse raycasts use current deformed skin and refresh bounds after a bone moves',()=>{
 const f=fixture();let builds=0;const compute=f.body.computeBoundingBox.bind(f.body);f.body.computeBoundingBox=()=>{builds++;compute();};
 const first=f.trace()[0];assert.ok(Math.abs(first.position[1]-.15)<1e-8);f.trace();assert.equal(builds,1,'settled corpse reuses skinned bounds');
 f.bone.position.x=3;assert.equal(f.trace().length,0,'old standing location has no phantom corpse');const moved=f.trace([3,2,0])[0];assert.equal(moved.id,1);assert.ok(Math.abs(moved.position[0]-3)<1e-8);assert.equal(builds,2);f.body.geometry.dispose();f.body.material.dispose();
});
test('a corpse gun, living model, hidden body and a wall-limited ray cannot trigger blood',()=>{
 const f=fixture(),gun=new Mesh(new BoxGeometry(1,1,1),new MeshBasicMaterial());gun.position.y=1;f.root.add(gun);
 assert.ok(Math.abs(f.trace()[0].position[1]-.15)<1e-8,'gun is not a body surface');assert.equal(f.trace([0,2,0],[0,-1,0],1).length,0,'range stopped before the body');
 f.actor.dead=false;assert.equal(f.trace().length,0);f.actor.dead=true;f.root.visible=false;assert.equal(f.trace().length,0);f.root.visible=true;f.body.visible=false;assert.equal(f.trace().length,0);assert.equal(f.trace([NaN,0,0]).length,0);
 f.body.geometry.dispose();f.body.material.dispose();gun.geometry.dispose();gun.material.dispose();
});
test('all six character variants can be hit on their displayed falling and settled death poses',()=>{
 for(const [id,team] of [['omoh','attack'],['omoh','defend'],['fox-bl','attack'],['fox-gr','defend'],['star-bl','attack'],['star-gr','defend']]){
  const root=cfModel(id),actor={id:1,dead:true,team,character:id},clip=root.userData.cf.clips.death1,duration=(clip.frames-1)/clip.fps;
  root.position.set(4,0,-3);root.rotation.y=.7;playCF(root,'death',{once:true,hold:true,restart:true});
  for(const step of [0,.3,.7,1]){
   playCF(root,'death',{once:true,hold:true,restart:true});animateCF(root,duration*step);const bounds=new Box3().setFromObject(root,true),center=bounds.getCenter(new Vector3());let hit;
   for(const dx of [0,-.15,.15,-.3,.3])for(const dz of [0,-.15,.15,-.3,.3]){
    const result=traceCorpseModels([actor],()=>root,[center.x+dx,bounds.max.y+.5,center.z+dz],[0,-1,0],bounds.max.y-bounds.min.y+1);if(result.length){hit=result[0];break;}
   }
   assert.ok(hit,`${id} death progress ${step} has hittable skin`);assert.ok(hit.position.every(Number.isFinite));assert.ok(bounds.containsPoint(new Vector3(...hit.position)));assert.equal(hit.id,1);
  }
  disposeCF(root);
 }
});
test('corpse feedback plays the same blood animation without fabricating positive damage',()=>{
 const fx=new BloodEffects(new Scene(),{texture:new DataTexture(new Uint8Array(4),1,1)}),event={id:1,corpse:true,position:[0,.15,0],direction:[0,-1,0]};assert.equal(fx.emit(event),true);assert.equal(fx.bursts.length,1);fx.update(.6);assert.equal(fx.bursts.length,0);assert.equal(fx.emit({...event,corpse:false}),false);fx.dispose();
});
