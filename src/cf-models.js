import * as T from 'three';
import {VIEW_ARM_PROFILES} from './view-arm-profiles.js';
import {CF_MODELS,CF_ARM_TEXTURES} from './generated/cf-models.js';
import {CF_WEAPON_ASSETS} from './generated/cf-weapon-assets.js';
import {weaponGrips} from './weapon-grips.js';
import {assetBytes,assetFloats,acquireCFTexture} from './cf-resource-cache.js';
const layouts=new WeakMap(),worldWeapons=new Map();
const orientation=new T.Matrix4().makeBasis(new T.Vector3(0,0,-1),new T.Vector3(-1,0,0),new T.Vector3(0,1,0));
export function cfModel(id,{view=false,weaponOnly=false,characterAsset=null,armsOnly=false,handSide='both'}={}){
 let data=CF_MODELS[id];if(!data)return null;
 if(view&&characterAsset){const character=CF_MODELS[characterAsset];if(data.kind==='weapon'){
  const bare=VIEW_ARM_PROFILES[characterAsset].bare,skin=CF_MODELS['m4-view'].textures.find(t=>t.name==='newhands4.bmp'),textures=[...data.textures,bare?skin:CF_ARM_TEXTURES.cloth,CF_ARM_TEXTURES.glove],clothIndex=data.textures.length;
  data={...data,textures,meshes:data.meshes.map(m=>{if(!data.armParts.includes(m.part))return m;const name=data.textures[m.texture].name,arm=/FVIEW_ARM/i.test(name),hand=/FVIEW_HAND/i.test(name);return {...m,name:'character-arms',surface:arm?(bare?'skin':'cloth'):/skin|finger|CSLC hand/i.test(name)?'skin':'glove',texture:arm?clothIndex:hand?clothIndex+1:m.texture,skinUV:arm&&bare};})};
 }else{if(!character?.arms?.[id])throw Error('Missing character arms: '+characterAsset+'/'+id);const weaponMeshes=armsOnly?[]:data.meshes.filter(m=>id==='ak-view'?m.part!==1:m.part!==0);data={...data,meshes:[...weaponMeshes,...character.arms[id]]};}}

 const outer=new T.Group(),space=new T.Group();space.quaternion.setFromRotationMatrix(orientation);outer.add(space);space.scale.setScalar(.0254);
 const bones=data.bones.map(b=>{const bone=new T.Bone();bone.name=b.name;bone.position.fromArray(b.position);bone.quaternion.setFromEuler(new T.Euler(...b.rotation,'ZYX'));return bone;});
 bones.forEach((bone,i)=>{const parent=data.bones[i].parent;(parent<0?space:bones[parent]).add(bone);});
 // Bind in source coordinates. Apply the source-to-game transform only after binding.
 space.quaternion.identity();space.scale.setScalar(1);space.updateMatrixWorld(true);
 const skeleton=new T.Skeleton(bones);skeleton.calculateInverses();
 const visibleMeshes=data.meshes.filter(m=>!weaponOnly||!(data.armParts?.includes(m.part)||(id==='ak-view'&&m.part===1)||(id==='m4-view'&&m.part===0))),usedTextures=new Set(visibleMeshes.map(m=>m.texture));
 const leases=[];outer.userData.cfTextureLeases=leases;
 const materials=data.textures.map((tex,index)=>{if(!usedTextures.has(index))return null;const lease=acquireCFTexture(tex);leases.push(lease);return new T.MeshStandardMaterial({name:tex.name,map:lease.map,roughness:.85,metalness:.05,side:T.DoubleSide,alphaTest:(tex.flags&64)?.5:0});});
 for(const mesh of data.meshes){
  if(weaponOnly&&(data.armParts?.includes(mesh.part)||(id==='ak-view'&&mesh.part===1)||(id==='m4-view'&&mesh.part===0)))continue;
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(assetFloats(mesh,'positions'),3));geo.setAttribute('uv',new T.BufferAttribute(mesh.skinUV?assetFloats(mesh,'uv').slice():assetFloats(mesh,'uv'),2));
  if(mesh.skinUV){const uv=geo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,.26+((uv.getX(i)%1+1)%1)*.34,.70+((uv.getY(i)%1+1)%1)*.23);}
  const indices=new Uint16Array(mesh.vertices*4),weights=new Float32Array(mesh.vertices*4),bi=assetBytes(mesh,'bones'),secondary=mesh.secondaryBones?assetBytes(mesh,'secondaryBones'):null,blend=mesh.secondaryWeights?assetFloats(mesh,'secondaryWeights'):null;for(let i=0;i<bi.length;i++){indices[i*4]=bi[i];weights[i*4]=1;if(secondary&&blend){indices[i*4+1]=secondary[i];weights[i*4]=1-blend[i];weights[i*4+1]=blend[i];}}if(handSide==='right'&&mesh.name==='character-arms'){const draw=[];for(let v=0;v<bi.length;v+=3)if([0,1,2].every(k=>data.bones[bi[v+k]].name.startsWith('R_')))draw.push(v,v+1,v+2);geo.setIndex(draw);}
  if(mesh.skinIndices&&mesh.skinWeights){indices.set(assetBytes(mesh,'skinIndices'));weights.set(assetFloats(mesh,'skinWeights'));}
  geo.setAttribute('skinIndex',new T.BufferAttribute(indices,4));geo.setAttribute('skinWeight',new T.BufferAttribute(weights,4));if(mesh.normals)geo.setAttribute('normal',new T.BufferAttribute(mesh.name==='character-arms'?assetFloats(mesh,'normals').slice():assetFloats(mesh,'normals'),3));else geo.computeVertexNormals();
  if(mesh.name==='character-arms'){
   const position=geo.attributes.position,normal=geo.attributes.normal,averages=new Map(),keys=[];
   for(let v=0;v<position.count;v++){const key=[position.getX(v),position.getY(v),position.getZ(v)].map(x=>Math.round(x*1000)).join(',');keys.push(key);const n=averages.get(key)||new T.Vector3();n.add(new T.Vector3().fromBufferAttribute(normal,v));averages.set(key,n);}
   for(const n of averages.values())n.normalize();for(let v=0;v<normal.count;v++){const n=averages.get(keys[v]);normal.setXYZ(v,n.x,n.y,n.z);}
  }
  let material=materials[mesh.texture];
  if(mesh.name==='character-arms'&&characterAsset){
    const profile=VIEW_ARM_PROFILES[characterAsset];material=material.clone();
    if(mesh.surface==='skin'){material.color.setRGB(...profile.skinTint);material.roughness=.82;}
    else {
      const glove=mesh.surface==='glove',tint=glove?profile.glove:profile.cloth;
      material.onBeforeCompile=shader=>{
        shader.uniforms.armTint={value:new T.Vector3(...tint)};shader.uniforms.armSkinTint={value:new T.Vector3(...profile.skinTint)};
        shader.fragmentShader='uniform vec3 armTint; uniform vec3 armSkinTint;\n'+shader.fragmentShader;
        const correction=glove?'float skinMask=step(diffuseColor.g*1.08,diffuseColor.r)*step(diffuseColor.b*1.12,diffuseColor.g); diffuseColor.rgb*=mix(armTint,armSkinTint,skinMask);':'diffuseColor.rgb*=armTint;';
        shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n'+correction);
      };
      material.customProgramCacheKey=()=>characterAsset+':'+mesh.surface;
    }
  }
  const node=new T.SkinnedMesh(geo,material);node.name=mesh.name;space.add(node);node.bind(skeleton,new T.Matrix4());node.frustumCulled=false;node.castShadow=!view;node.receiveShadow=!view;
 }
 space.quaternion.setFromRotationMatrix(orientation);space.scale.setScalar(.0254);
 if(!armsOnly&&data.attachments?.length&&/-(view|world)$/.test(id)){
  // M4's third attachment belongs to the unsilenced barrel; the second is the shell ejector.
  const index=id==='m4-view'&&data.clips.idle_unsil&&data.attachments[2]?2:0,attachment=data.attachments[index],muzzle=new T.Object3D();
  muzzle.name='muzzle';muzzle.position.fromArray(attachment.position);bones[attachment.bone].add(muzzle);
  outer.userData.muzzle=muzzle;outer.userData.muzzleAttachment=index;
 }
 const clips=Object.fromEntries(Object.entries(data.clips).map(([name,clip])=>[name,{...clip,poses:assetFloats(clip,'poses')}]));
 const idle=clips.idle_unsil?'idle_unsil':clips.idle?'idle':clips.idle_0?'idle_0':clips.ref_aim_rifle?'ref_aim_rifle':'idle1';
 let current=idle,elapsed=0,once=false,hold=false,speed=1;const q1=new T.Quaternion(),q2=new T.Quaternion();
 const play=(name,options={})=>{if(!clips[name])name=idle;if(name===current&&!options.restart)return;current=name;elapsed=0;once=!!options.once;hold=!!options.hold;speed=options.duration?(Math.max(1,clips[name].frames-1)/clips[name].fps)/options.duration:1;};
 const update=dt=>{const clip=clips[current];if(!clip)return;elapsed+=dt*speed;let frame=elapsed*clip.fps;if(frame>=clip.frames-1){if(once&&!hold){current=idle;elapsed=0;once=false;return update(0);}frame=once&&hold?clip.frames-1:clip.frames>1?frame%(clip.frames-1):0;}const a=Math.floor(frame),b=Math.min(a+1,clip.frames-1),blend=frame-a,n=bones.length;for(let i=0;i<n;i++){const u=(a*n+i)*7,v=(b*n+i)*7,p=clip.poses,bone=bones[i];bone.position.set(T.MathUtils.lerp(p[u],p[v],blend),T.MathUtils.lerp(p[u+1],p[v+1],blend),T.MathUtils.lerp(p[u+2],p[v+2],blend));q1.fromArray(p,u+3);q2.fromArray(p,v+3);bone.quaternion.copy(q1.slerp(q2,blend));}outer.updateMatrixWorld(true);};
 outer.userData.cf={id,characterAsset,space,bones,skeleton,clips,idle,play,update,get current(){return current;}};update(0);
 if(!view){
  const character=data.kind!=='weapon'&&data.bones.length>10&&!id.includes('view');let layout=character?layouts.get(data):null;
  if(!layout){const bounds=new T.Box3().setFromObject(space),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());layout={scale:1.83/size.y,center,minY:bounds.min.y};}
  if(character){space.scale.multiplyScalar(layout.scale);space.position.set(-layout.center.x*layout.scale,-layout.minY*layout.scale,-layout.center.z*layout.scale);outer.updateMatrixWorld(true);outer.userData.cf.grips=handGripAnchors(space,bones,layout.grips);if(!layout.grips){layout.grips=Object.fromEntries(Object.entries(outer.userData.cf.grips).map(([side,anchor])=>[side,anchor.position.toArray()]));layouts.set(data,layout);}}
  else space.position.sub(layout.center);
 }
 return outer;
}
function handGripAnchors(space,bones,cached){
 const grips={};
 for(const [side,label] of [['R','right'],['L','left']]){
  const hand=bones.find(b=>b.name==='Bip01 '+side+' Hand');if(!hand)continue;
  if(cached){if(cached[label]){const anchor=new T.Object3D();anchor.name='palm-'+label;anchor.position.fromArray(cached[label]);hand.add(anchor);grips[label]=anchor;}continue;}
  const belongs=bones.map(b=>{for(let p=b;p?.isBone;p=p.parent)if(p===hand)return true;return false;}),bounds=new T.Box3(),point=new T.Vector3();
  space.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const a=mesh.geometry.attributes;for(let v=0;v<a.position.count;v++)if(belongs[a.skinIndex.getX(v)]){mesh.getVertexPosition(v,point).applyMatrix4(mesh.matrixWorld);bounds.expandByPoint(hand.worldToLocal(point));}});
  if(bounds.isEmpty())continue;const anchor=new T.Object3D();anchor.name='palm-'+label;bounds.getCenter(anchor.position);hand.add(anchor);grips[label]=anchor;
 }
 return grips;
}
// World weapons use the weapon bone's frame, rather than the viewmodel camera
// frame. In the source models +Z is the barrel and +Y is the top of the rifle.
export function cfWorldWeapon(id){
 let entry=worldWeapons.get(id);
 if(!entry){
  const template=buildWorldWeapon(id);if(!template)return null;
  const meshes=template.children.filter(node=>node.isMesh),usedMaps=new Set(meshes.map(mesh=>mesh.material.map)),leases=template.userData.cfTextureLeases||[];
  for(const lease of leases)if(!usedMaps.has(lease.map))lease.release();
  entry={meshes,leases:leases.filter(lease=>usedMaps.has(lease.map)),muzzle:template.userData.muzzle?.position.clone(),refs:0};
  for(const mesh of meshes){mesh.geometry.userData.cfShared=true;mesh.material.userData.cfShared=true;}
  worldWeapons.set(id,entry);
 }
 const gun=new T.Group();
 for(const source of entry.meshes){const mesh=new T.Mesh(source.geometry,source.material);mesh.name=source.name;mesh.position.copy(source.position);mesh.quaternion.copy(source.quaternion);mesh.scale.copy(source.scale);mesh.castShadow=true;mesh.receiveShadow=true;gun.add(mesh);}
 setWorldMuzzle(gun,id,entry.muzzle?.clone());entry.refs++;let released=false;
 gun.userData.cfWorldLease={release(){if(released)return;released=true;if(--entry.refs===0){const geometries=new Set(entry.meshes.map(m=>m.geometry)),materials=new Set(entry.meshes.map(m=>m.material));for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();for(const lease of entry.leases)lease.release();worldWeapons.delete(id);}}};
 return gun;
}
function buildWorldWeapon(id){
 if(CF_WEAPON_ASSETS[id]){
  const source=cfModel(id+'-view',{view:true,weaponOnly:true});source.scale.x=CF_WEAPON_ASSETS[id].mirror===false?1:-1;source.updateMatrixWorld(true);
  const cf=source.userData.cf,hand=cf.bones.find(b=>/ R Hand$|Kili_Rcotay|Bone_Righthand/.test(b.name)),grip=hand?hand.getWorldPosition(new T.Vector3()):new T.Box3().setFromObject(source).getCenter(new T.Vector3()),gun=new T.Group(),muzzle=source.userData.muzzle?.getWorldPosition(new T.Vector3()).sub(grip);
  source.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const geometry=new T.BufferGeometry(),positions=[],uv=[],attributes=mesh.geometry.attributes,p=new T.Vector3();for(let v=0;v<attributes.position.count;v+=3){if(id==='awm'&&[0,1,2].every(k=>['Kilimangiero','Kili_att'].includes(cf.bones[attributes.skinIndex.getX(v+k)].name)))continue;for(let k=0;k<3;k++){mesh.getVertexPosition(v+k,p).applyMatrix4(mesh.matrixWorld).sub(grip);positions.push(p.x,p.y,p.z);uv.push(attributes.uv.getX(v+k),attributes.uv.getY(v+k));}}geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.computeVertexNormals();const node=new T.Mesh(geometry,mesh.material);node.name=mesh.material.name;node.castShadow=true;node.receiveShadow=true;gun.add(node);mesh.geometry.dispose();});cf.skeleton.dispose();gun.userData.cfTextureLeases=source.userData.cfTextureLeases;setWorldMuzzle(gun,id,muzzle);return gun;
 }
 const source=cfModel(id==='m4'?'m4-world':'ak-view',{weaponOnly:true});
 if(!source)return null;
 source.updateMatrixWorld(true);const cf=source.userData.cf;
 const receiver=cf.bones.find(b=>b.name==='Wep_AK47')||cf.bones[0];
 const toReceiver=receiver.matrixWorld.clone().invert(),gun=new T.Group();
 const grip=new T.Vector3(...(id==='ak'?[0,-4.2,-2]:[0,-4.5,0]));
 const nativeMuzzle=source.userData.muzzle?.getWorldPosition(new T.Vector3()).applyMatrix4(toReceiver).sub(grip).multiplyScalar(.0254);
 if(nativeMuzzle){nativeMuzzle.x*=-1;nativeMuzzle.z*=-1;}
 source.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  // The M4 world file also includes an unattached spare silencer.
  if(id==='m4'&&mesh.material.name==='SILENCER.bmp'){mesh.geometry.dispose();mesh.material.dispose();return;}
  const geometry=mesh.geometry.clone(),positions=geometry.attributes.position,p=new T.Vector3();
  for(let v=0;v<positions.count;v++){
   mesh.getVertexPosition(v,p).applyMatrix4(mesh.matrixWorld).applyMatrix4(toReceiver).sub(grip).multiplyScalar(.0254);
   positions.setXYZ(v,-p.x,p.y,-p.z);
  }
  geometry.deleteAttribute('skinIndex');geometry.deleteAttribute('skinWeight');geometry.computeVertexNormals();
  const node=new T.Mesh(geometry,mesh.material);node.name=mesh.material.name;node.castShadow=true;node.receiveShadow=true;gun.add(node);
  mesh.geometry.dispose();
 });
 cf.skeleton.dispose();
 gun.userData.cfTextureLeases=source.userData.cfTextureLeases;
 setWorldMuzzle(gun,id,nativeMuzzle);
 return gun;
}
function setWorldMuzzle(gun,id,position){
 gun.userData.worldWeapon={id,forward:new T.Vector3(0,0,-1),up:new T.Vector3(0,1,0),...weaponGrips(id)};
 if(['axe','shovel'].includes(id))return;
 if(!position){
  // The M4 world model omits attachments. Average the actual barrel tip vertices.
  const points=[];let front=Infinity;gun.traverse(o=>{const a=o.geometry?.attributes.position;if(!a)return;for(let i=0;i<a.count;i++){const p=new T.Vector3().fromBufferAttribute(a,i);points.push(p);front=Math.min(front,p.z);}});
  const tip=points.filter(p=>p.z<=front+.012);position=new T.Vector3();for(const p of tip)position.add(p);position.divideScalar(Math.max(1,tip.length));
 }
 const muzzle=new T.Object3D();muzzle.name='muzzle';muzzle.position.copy(position);gun.add(muzzle);gun.userData.muzzle=muzzle;
 gun.userData.worldWeapon={...gun.userData.worldWeapon,muzzle:position.clone()};
}
export function animateCF(node,dt){
 node.traverse(o=>o.userData.cf?.update(dt));
 node.updateMatrixWorld(true);
 node.traverse(o=>{const grip=o.userData.proceduralGrip;if(!grip)return;o.worldToLocal(grip.hand.getWorldPosition(grip.gun.position));grip.gun.position.add(new T.Vector3(0,.10,-.10));});
 node.traverse(o=>{
  const held=o.userData.heldGun;if(!held)return;
  const palms=o.userData.cf?.grips,contacts=held.gun.userData.worldWeapon;
  const right=o.worldToLocal((palms?.right||held.right).getWorldPosition(new T.Vector3())),left=o.worldToLocal((palms?.left||held.left).getWorldPosition(new T.Vector3())),forward=left.clone().sub(right);
  if(forward.lengthSq()<1e-8)return;forward.normalize();
  const up=held.torsoTop&&held.torsoBase?o.worldToLocal(held.torsoTop.getWorldPosition(new T.Vector3())).sub(o.worldToLocal(held.torsoBase.getWorldPosition(new T.Vector3()))).normalize():new T.Vector3(0,1,0);
  up.addScaledVector(forward,-up.dot(forward));
  if(up.lengthSq()<1e-5){up.set(0,1,0).addScaledVector(forward,-forward.y);if(up.lengthSq()<1e-5)up.set(1,0,0).addScaledVector(forward,-forward.x);}
  up.normalize();const across=forward.clone().cross(up).normalize();up.copy(across).cross(forward).normalize();
  const targetFrame=new T.Matrix4().makeBasis(across,up,forward.clone().negate());
  if(contacts?.grip&&contacts?.support){
   const axis=contacts.support.clone().sub(contacts.grip),span=axis.length();if(span<.01)return;axis.normalize();
   const sourceUp=new T.Vector3(0,1,0).addScaledVector(axis,-axis.y).normalize(),sourceAcross=axis.clone().cross(sourceUp).normalize();sourceUp.copy(sourceAcross).cross(axis).normalize();
   const sourceFrame=new T.Matrix4().makeBasis(sourceAcross,sourceUp,axis.clone().negate());
   held.gun.quaternion.setFromRotationMatrix(targetFrame.multiply(sourceFrame.transpose()));
   held.gun.scale.setScalar(T.MathUtils.clamp(left.distanceTo(right)/span,.5,1.3));
   held.gun.position.copy(right).sub(contacts.grip.clone().multiplyScalar(held.gun.scale.x).applyQuaternion(held.gun.quaternion));
  }else{
   held.gun.quaternion.setFromRotationMatrix(targetFrame);
   held.gun.position.copy(right);if(contacts?.grip)held.gun.position.sub(contacts.grip.clone().multiplyScalar(held.gun.scale.x).applyQuaternion(held.gun.quaternion));
  }
 });
 node.updateMatrixWorld(true);
}
export function playCF(node,action,options={}){const cf=node?.userData.cf||node?.userData.armRig?.userData.cf;if(!cf)return;const map={death:'death1',idle:cf.idle,shoot:cf.clips.shoot1_unsil?'shoot1_unsil':cf.clips.shoot1?'shoot1':cf.clips.prefire?'prefire':cf.clips.combo_1?'combo_1':'ref_shoot_rifle',reload:cf.clips.reload_unsil?'reload_unsil':'reload',draw:cf.clips.draw_unsil?'draw_unsil':cf.clips.select?'select':'draw'};cf.play(map[action]||action,options);}
export function disposeCF(node){node.traverse(o=>{const data=o.userData;if(data.cf&&!data.cf.disposed){data.cf.disposed=true;data.cf.skeleton.dispose();}if(data.cfTextureLeases){for(const lease of data.cfTextureLeases)lease.release();data.cfTextureLeases=null;}data.cfWorldLease?.release();});}
