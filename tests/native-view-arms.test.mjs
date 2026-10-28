import test from 'node:test';
import assert from 'node:assert/strict';
import {CF_MODELS} from '../src/generated/cf-models.js';
import {VIEW_ARM_PROFILES} from '../src/view-arm-profiles.js';
import {cfModel,playCF,animateCF,disposeCF} from '../src/cf-models.js';
import {Matrix4,Vector3,Quaternion,Euler} from 'three';
const floats=s=>new Float32Array(Uint8Array.from(Buffer.from(s,'base64')).buffer);
for(const weapon of ['m4-view','ak-view'])test(weapon+': every adapted hand preserves native finger vertices and bone assignments',()=>{
 const source=CF_MODELS[weapon],part=weapon==='m4-view'?0:1;
 for(const id of Object.keys(VIEW_ARM_PROFILES)){
  const meshes=CF_MODELS[id].arms[weapon];const glove=meshes.find(m=>m.surface==='glove');const native=source.meshes.find(m=>m.part===part&&m.texture===glove.texture);
  assert.equal(glove.bones,native.bones,'bone mapping must remain native');assert.equal(glove.uv,native.uv,'glove UVs must remain native');
  const a=floats(glove.positions),b=floats(native.positions),bones=Buffer.from(native.bones,'base64');let checked=0;
  for(let v=0;v<bones.length;v++)if(/Wrist|Hand|Thumb|Index|Mid|Ring|Pinky/.test(source.bones[bones[v]].name)){assert.deepEqual(Array.from(a.slice(v*3,v*3+3)),Array.from(b.slice(v*3,v*3+3)));checked++;}
  assert.ok(checked>300,'must check actual palms and fingers');
 }
});
test('bare M4 removes the outer jacket while OMOH retains it',()=>{
 assert.ok(CF_MODELS.omoh.arms['m4-view'].some(m=>m.surface==='cloth'));
 for(const id of ['fox-bl','fox-gr','star-bl','star-gr'])assert.ok(CF_MODELS[id].arms['m4-view'].every(m=>m.surface==='glove'));
});
test('bare AK arms connect shoulder, elbow and wrist with blended native bones and valid skin UVs',()=>{
 const texture=nativeAK.textures.find(t=>t.name==='adapted-forearm-skin'),pixels=Buffer.from(texture.pixels,'base64'),palette=texture.w*texture.h;
 for(const id of ['fox-bl','fox-gr','star-bl','star-gr']){
  const arms=CF_MODELS[id].arms['ak-view'].filter(m=>m.surface==='skin');assert.equal(arms.length,2);
  for(const mesh of arms){assert.ok(mesh.vertices>0&&mesh.vertices%6===0&&mesh.vertices<6000,'arms need connected triangles within the mobile geometry budget');assert.equal(CF_MODELS['ak-view'].textures[mesh.texture].name,'adapted-forearm-skin');const uv=floats(mesh.uv);for(let i=0;i<uv.length;i+=2){assert.ok(uv[i]>=.259&&uv[i]<=.601);assert.ok(uv[i+1]>=.639&&uv[i+1]<=.931);const color=palette+pixels[Math.floor(uv[i+1]*texture.h)*texture.w+Math.floor(uv[i]*texture.w)]*3;assert.ok(Math.max(...pixels.subarray(color,color+3))>40,'bare skin UVs must not include black glove patches');}const weights=floats(mesh.secondaryWeights),primary=Buffer.from(mesh.bones,'base64'),secondary=Buffer.from(mesh.secondaryBones,'base64');assert.equal(weights.length,mesh.vertices);assert.ok(weights.includes(0)&&weights.includes(1)&&weights.includes(.5),'shoulder, wrist and elbow need distinct bone influence');for(let v=0;v<weights.length;v++){assert.ok(weights[v]>=0&&weights[v]<=1);assert.match(CF_MODELS['ak-view'].bones[primary[v]].name,/UpperARM$/);assert.ok(CF_MODELS['ak-view'].bones[primary[v]].parent===secondary[v]||CF_MODELS['ak-view'].bones[secondary[v]].parent===primary[v],'blend only adjoining native body/upper/forearm bones');}}
 }
});

const nativeAK=CF_MODELS['ak-view'],bindMatrices=[];
for(const bone of nativeAK.bones){const m=new Matrix4().compose(new Vector3(...bone.position),new Quaternion().setFromEuler(new Euler(...bone.rotation,'ZYX')),new Vector3(1,1,1));if(bone.parent>=0)m.premultiply(bindMatrices[bone.parent]);bindMatrices.push(m);}
function forearm(side){const upper=nativeAK.bones.findIndex(b=>b.name===`BIP${side}_UpperARM`),lower=nativeAK.bones.findIndex(b=>b.name===`BIP${side}_LowerARM`),hand=nativeAK.bones.findIndex(b=>b.name===`BIP${side}_Hand`),start=new Vector3().setFromMatrixPosition(bindMatrices[lower]),end=new Vector3().setFromMatrixPosition(bindMatrices[hand]),axis=end.sub(start),direction=axis.clone().normalize(),x=new Vector3(0,1,0).cross(direction).normalize(),y=new Vector3().crossVectors(direction,x).normalize();return {upper,lower,start,axis,x,y};}

test('female AK forearms have an oval section and taper before the glove instead of forming round pipes',()=>{
 for(const id of ['fox-bl','fox-gr','star-bl','star-gr'])for(const side of ['L','R']){
  const {upper,lower,start,axis,x,y}=forearm(side),mesh=CF_MODELS[id].arms['ak-view'].find(m=>m.surface==='skin'&&Buffer.from(m.bones,'base64')[0]===upper),p=floats(mesh.positions),weights=floats(mesh.secondaryWeights),secondary=Buffer.from(mesh.secondaryBones,'base64'),unique=new Map();
  for(let v=0;v<p.length;v+=3){if(weights[v/3]<1||secondary[v/3]!==lower)continue;const point=new Vector3().fromArray(p,v),offset=point.sub(start),t=offset.dot(axis)/axis.lengthSq(),radial=offset.addScaledVector(axis,-t);unique.set(Array.from(p.slice(v,v+3)).map(n=>n.toFixed(4)).join(','),{t,x:radial.dot(x),y:radial.dot(y),r:radial.length()});}
  const mid=[...unique.values()].filter(p=>p.t>.20&&p.t<.45),distal=[...unique.values()].filter(p=>p.t>.52&&p.t<.62);assert.ok(mid.length>30&&distal.length>15);
  const midRadius=Math.max(...mid.map(p=>p.r));assert.ok(side==='L'?midRadius>1.75&&midRadius<2.1:midRadius<1.6,'the left support forearm must be fuller while the right remains proportionate');assert.ok(Math.max(...distal.map(p=>p.r))<midRadius,'skin must narrow toward the wrist before meeting the cuff');
  const mx=mid.reduce((a,p)=>a+p.x,0)/mid.length,my=mid.reduce((a,p)=>a+p.y,0)/mid.length,a=mid.reduce((s,p)=>s+(p.x-mx)**2,0)/mid.length,b=mid.reduce((s,p)=>s+(p.x-mx)*(p.y-my),0)/mid.length,c=mid.reduce((s,p)=>s+(p.y-my)**2,0)/mid.length,d=Math.hypot(a-c,2*b),ratio=Math.sqrt((a+c-d)/(a+c+d));
  assert.ok(ratio>.60&&ratio<.90,`forearm section must remain oval without becoming a thin ribbon: ${id}/${side} ${ratio}`);
 }
});

test('bare AK wrists meet the native slanted glove cuff throughout reload without moving the fingers',()=>{
 const glove=nativeAK.meshes.find(m=>m.part===1&&/Glove/.test(nativeAK.textures[m.texture].name)),nativeBones=Buffer.from(glove.bones,'base64');
 for(const id of ['fox-bl','fox-gr','star-bl','star-gr']){
  const native=floats(CF_MODELS[id].arms['ak-view'].find(m=>m.surface==='glove').positions);
  const model=cfModel('ak-view',{view:true,characterAsset:id}),skins=[];let handMesh;
  try{
   model.traverse(node=>{if(node.name==='character-arms'){if(node.material.name==='adapted-forearm-skin')skins.push(node);else handMesh=node;}});
   const pairs=[];
   for(const side of ['L','R']){
    const {upper,lower,start,axis}=forearm(side),skin=skins.find(m=>m.geometry.attributes.skinIndex.getX(0)===upper),positions=skin.geometry.attributes.position,seen=new Set();
    for(let v=0;v<nativeBones.length;v++)if(nativeBones[v]===lower){const p=new Vector3().fromArray(native,v*3),offset=p.clone().sub(start),t=offset.dot(axis)/axis.lengthSq();if(offset.addScaledVector(axis,-t).length()<.5)continue;const key=p.toArray().map(n=>n.toFixed(4)).join(',');if(seen.has(key))continue;seen.add(key);let nearest=-1,distance=Infinity;for(let i=0;i<positions.count;i++){const d=p.distanceTo(new Vector3().fromBufferAttribute(positions,i));if(d<distance){distance=d;nearest=i;}}assert.ok(distance<.081,'the skin edge must follow each native cuff corner');assert.equal(skin.geometry.attributes.skinWeight.getY(nearest),1,'cuff must follow the same bone as the glove');pairs.push({skin,skinVertex:nearest,handVertex:v});}
    assert.ok(seen.size>=8,'exercise the whole irregular cuff rather than one point');
   }
   for(const time of [0,.65,1.15,1.95,2.3]){
    playCF(model,time?'reload':'idle',{once:!!time,restart:true,duration:time?2.5:undefined});animateCF(model,time);model.userData.cf.skeleton.update();
    for(const pair of pairs){const a=pair.skin.getVertexPosition(pair.skinVertex,new Vector3()).applyMatrix4(pair.skin.matrixWorld),b=handMesh.getVertexPosition(pair.handVertex,new Vector3()).applyMatrix4(handMesh.matrixWorld);assert.ok(a.distanceTo(b)<.0021,'skin and glove must stay within 2.1 mm during animation');}
   }
  }finally{disposeCF(model);}
 }
});

test('adapted AK elbow weights reach the runtime skeleton and blend both bones during reload',()=>{
 for(const id of ['fox-bl','fox-gr','star-bl','star-gr']){
  const model=cfModel('ak-view',{view:true,characterAsset:id}),cf=model.userData.cf,meshes=[];
  try{
   model.traverse(node=>{if(node.name==='character-arms')meshes.push(node);});
   const sources=CF_MODELS[id].arms['ak-view'];
   for(let n=0;n<sources.length;n++){
    const source=sources[n];if(source.surface!=='skin')continue;
    const mesh=meshes[n],primary=Buffer.from(source.bones,'base64'),secondary=Buffer.from(source.secondaryBones,'base64'),blend=floats(source.secondaryWeights),indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
    assert.equal(indices.count,source.vertices);
    for(let v=0;v<source.vertices;v++){
     assert.equal(indices.getX(v),primary[v]);assert.equal(indices.getY(v),secondary[v]);
     assert.ok(Math.abs(weights.getX(v)-(1-blend[v]))<1e-7);
     assert.equal(weights.getY(v),blend[v]);
     assert.ok(Math.abs(weights.getX(v)+weights.getY(v)+weights.getZ(v)+weights.getW(v)-1)<1e-7,'every runtime vertex needs normalized weights');
    }
    const vertex=blend.findIndex((weight,i)=>weight===.5&&/LowerARM$/.test(nativeAK.bones[secondary[i]].name));assert.ok(vertex>=0,'must exercise a blended elbow vertex');
    playCF(model,'idle',{restart:true});animateCF(model,0);cf.skeleton.update();
    const idle=mesh.getVertexPosition(vertex,new Vector3());
    // The trigger-side elbow bends later in the native reload than the magazine-side elbow.
    playCF(model,'reload',{once:true,restart:true});animateCF(model,1.95);cf.skeleton.update();
    const position=new Vector3().fromBufferAttribute(mesh.geometry.attributes.position,vertex).applyMatrix4(mesh.bindMatrix);
    const transform=bone=>new Matrix4().multiplyMatrices(cf.bones[bone].matrixWorld,cf.skeleton.boneInverses[bone]);
    const upper=position.clone().applyMatrix4(transform(primary[vertex])),lower=position.clone().applyMatrix4(transform(secondary[vertex]));
    assert.ok(upper.distanceTo(lower)>1e-3,'reload must give the two influencing bones distinct transforms');
    const expected=upper.multiplyScalar(1-blend[vertex]).addScaledVector(lower,blend[vertex]).applyMatrix4(mesh.bindMatrixInverse),actual=mesh.getVertexPosition(vertex,new Vector3());
    assert.ok(actual.distanceTo(expected)<1e-4,'runtime elbow deformation must include both native arm bones');
    assert.ok(actual.distanceTo(idle)>1e-3,'reload must move the elbow from its idle pose');
   }
  }finally{disposeCF(model);}
 }
});
