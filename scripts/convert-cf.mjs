// GoldSrc v10 conversion. Layout reference: ValveSoftware/halflife engine/studio.h.
// Outputs portable packed geometry, palette textures and selected skeletal poses.
import fs from 'node:fs';
import {deflateSync,inflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeCompressedJSON} from '../src/asset-compression.js';
import {VIEW_ARM_PROFILES} from '../src/view-arm-profiles.js';
import {readMeteorCharacter} from './meteor-character.mjs';
import {retargetCharacter} from './character-retarget.mjs';
import path from 'node:path';
import {Matrix4,Quaternion,Euler,Vector3} from 'three';
const root=path.resolve(import.meta.dirname,'..');
const pack=a=>Buffer.from(new Float32Array(a).buffer).toString('base64');
export function convert(buffer,textureBuffer=buffer,options={}){
 const b=buffer,t=textureBuffer,i=o=>b.readInt32LE(o),f=o=>b.readFloatLE(o),str=(o,n=64)=>b.toString('latin1',o,o+n).split('\0')[0];
 if(str(0,4)!=='IDST'||i(4)!==10||i(72)!==b.length)throw Error('Invalid MDL header');
 const vec=o=>[f(o),f(o+4),f(o+8)],bones=[];
 for(let n=0;n<i(140);n++){const o=i(144)+n*112; bones.push({name:str(o,32),parent:i(o+32),position:vec(o+64),rotation:vec(o+76),scale:[...vec(o+88),...vec(o+100)]});}
 const matrices=bones.map((bone,n)=>{const m=new Matrix4().compose(new Vector3(...bone.position),new Quaternion().setFromEuler(new Euler(...bone.rotation,'ZYX')),new Vector3(1,1,1));if(bone.parent>=n)throw Error('Bone hierarchy not sorted');return m;});
 for(let n=0;n<bones.length;n++)if(bones[n].parent>=0)matrices[n].premultiply(matrices[bones[n].parent]);
 const attachments=[];
 for(let n=0;n<i(212);n++){
  const o=i(216)+n*88;if(o<0||o+88>b.length)throw Error('Invalid attachment range');
  const bone=i(o+36),position=vec(o+40);if(!bones[bone]||!position.every(Number.isFinite))throw Error('Invalid attachment');
  attachments.push({name:str(o,32),bone,position});
 }
 const textures=[];
 for(let n=0;n<t.readInt32LE(180);n++){const o=t.readInt32LE(184)+n*80,w=t.readInt32LE(o+68),h=t.readInt32LE(o+72),start=t.readInt32LE(o+76);if(w<1||h<1||start+w*h+768>t.length)throw Error('Invalid texture');textures.push({name:t.toString('latin1',o,o+64).split('\0')[0],w,h,flags:t.readInt32LE(o+64),pixels:t.subarray(start,start+w*h+768).toString('base64')});}
 const meshes=[],parts=[];
 for(let part=0;part<i(204);part++){
  const po=i(208)+part*76,mo=i(po+72),models=i(po+64);parts.push({name:str(po),models:Array.from({length:models},(_,n)=>str(mo+n*112))});
  // Bodygroup value zero is the default. Alternate bodygroup models are mutually exclusive.
  const numMeshes=i(mo+72),meshOffset=i(mo+76),vertCount=i(mo+80),boneOffset=i(mo+84),vertOffset=i(mo+88);
  for(let m=0;m<numMeshes;m++){
   const o=meshOffset+m*20,skin=i(o+8),texture=t.readInt16LE(t.readInt32LE(200)+skin*2),tex=textures[texture];if(!tex)throw Error('Missing texture');
   const positions=[],uv=[],skinBones=[];let at=i(o+4),guard=0;
   const emit=v=>{const [index,s,tt]=v;if(index<0||index>=vertCount)throw Error('Vertex out of range');const bi=b[boneOffset+index];if(!matrices[bi])throw Error('Invalid vertex bone');const p=new Vector3(...vec(vertOffset+index*12)).applyMatrix4(matrices[bi]);positions.push(p.x,p.y,p.z);uv.push(s/tex.w,tt/tex.h);skinBones.push(bi);};
   while(true){if(++guard>100000)throw Error('Bad triangle commands');const command=b.readInt16LE(at);at+=2;if(!command)break;const count=Math.abs(command),vs=[];for(let v=0;v<count;v++,at+=8)vs.push([b.readInt16LE(at),b.readInt16LE(at+4),b.readInt16LE(at+6)]);for(let v=2;v<count;v++){const tri=command<0?[0,v-1,v]:v%2?[v-1,v-2,v]:[v-2,v-1,v];tri.forEach(index=>emit(vs[index]));}}
   if(!options.omitAdditive||!(tex.flags&32))meshes.push({part,name:str(po),texture,positions:pack(positions),uv:pack(uv),bones:Buffer.from(skinBones).toString('base64'),vertices:skinBones.length});
  }
 }
 const sequences=[];
 for(let n=0;n<i(164);n++){const o=i(168)+n*176;sequences.push({name:options.sequenceNames?.[n]||str(o,32),fps:f(o+32),frames:i(o+56),motion:i(o+68),motionBone:i(o+72),offset:i(o+124),blends:i(o+120),group:i(o+156)});}
 const character=!options.weapon&&!str(8).toLowerCase().includes('v_')&&bones.length>10;
 const wanted=character?['idle1','ref_aim_rifle','walk','run','ref_shoot_rifle','death1','death2','head']:['idle','idle1','idle_0','idle_unsil','shoot1','shoot1_unsil','prefire','reload','reload_unsil','draw','draw_unsil','select','combo_1','combo_2'];
 function channel(offset,frame){if(!offset)return 0;let p=offset,k=frame,guard=0;while(true){if(++guard>100000)throw Error('Bad animation RLE');const valid=b[p],total=b[p+1];if(!total||valid>total)throw Error('Invalid animation run');if(k<total)return b.readInt16LE(p+2*Math.min(k+1,valid));k-=total;p+=2*(valid+1);}}
 const clips={};
 for(const seq of sequences.filter(s=>wanted.includes(s.name))){if(seq.group!==0)throw Error('External sequence group unsupported');const poses=[];for(let frame=0;frame<seq.frames;frame++){for(let n=0;n<bones.length;n++){const bone=bones[n],a=seq.offset+(Math.floor(seq.blends/2)*bones.length+n)*12,values=[...bone.position,...bone.rotation];for(let c=0;c<6;c++){const rel=b.readUInt16LE(a+c*2);if(rel)values[c]+=channel(a+rel,frame)*bone.scale[c];}if(n===seq.motionBone)for(let c=0;c<3;c++)if(seq.motion&(1<<c))values[c]=bone.position[c];const q=new Quaternion().setFromEuler(new Euler(...values.slice(3),'ZYX'));poses.push(...values.slice(0,3),q.x,q.y,q.z,q.w);}}clips[seq.name]={fps:seq.fps,frames:seq.frames,poses:pack(poses)};}
 return {bones:bones.map(({scale,...rest})=>rest),attachments,textures,meshes,clips,parts,...(options.weapon?{kind:'weapon',armParts:options.armParts||[]}: {})};
}

export function buildViewArms(target,profile){
 const unpack=s=>new Float32Array(Uint8Array.from(Buffer.from(s,'base64')).buffer);
 const matrices=[];for(const bone of target.bones){const m=new Matrix4().compose(new Vector3(...bone.position),new Quaternion().setFromEuler(new Euler(...bone.rotation,'ZYX')),new Vector3(1,1,1));if(bone.parent>=0)m.premultiply(matrices[bone.parent]);matrices.push(m);}
 const ak=target.bones.some(b=>b.name==='BIPL_UpperARM'),part=ak?1:0;
 const positionKey=p=>p.map(x=>Math.round(x*10000)).join(',');
 const protectedPoints=new Set();
 for(const mesh of target.meshes.filter(m=>m.part===part)){const ps=unpack(mesh.positions),bs=Buffer.from(mesh.bones,'base64');for(let v=0;v<bs.length;v++)if(!/Upperarm|UpperARM|Forearm|LowerARM/.test(target.bones[bs[v]].name))protectedPoints.add(positionKey(Array.from(ps.slice(v*3,v*3+3))));}
 const chains={};for(const side of ['L','R']){const upper=target.bones.findIndex(b=>b.name===(ak?'BIP'+side+'_UpperARM':side+'_Upperarm')),lower=target.bones.findIndex(b=>b.name===(ak?'BIP'+side+'_LowerARM':side+'_Forearm')),hand=target.bones.findIndex(b=>b.name===(ak?'BIP'+side+'_Hand':side+'_Wrist'));chains[side]={upper,lower,shoulder:upper>=0?new Vector3().setFromMatrixPosition(matrices[upper]):null,start:new Vector3().setFromMatrixPosition(matrices[lower]),end:new Vector3().setFromMatrixPosition(matrices[hand])};}
 const fitAKCuff=(point,side)=>{const {start,end}=chains[side],axis=end.clone().sub(start),t=point.clone().sub(start).dot(axis)/axis.lengthSq(),center=start.clone().addScaledVector(axis,t);return point.sub(center).multiplyScalar(.72*(side==='L'?1.3:1)*(profile.width/.9)).add(center);};
 return target.meshes.filter(m=>m.part===part).flatMap(mesh=>{
   const name=target.textures[mesh.texture].name,sleeve=/tree|sleeve/i.test(name);
   // M4 contains a complete bare forearm in its hand mesh. Remove only the outer jacket.
   if(!ak&&sleeve&&profile.bare)return [];
   if(ak&&sleeve&&profile.bare){
     return ['L','R'].map(side=>{
       const {shoulder,start,end,upper,lower}=chains[side],upperAxis=start.clone().sub(shoulder),lowerAxis=end.clone().sub(start),upperDirection=upperAxis.clone().normalize(),lowerDirection=lowerAxis.clone().normalize();
       const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
       const initialX=new Vector3(0,1,0).cross(upperDirection).normalize(),wristX=initialX.clone().applyQuaternion(new Quaternion().setFromUnitVectors(upperDirection,lowerDirection)),wristY=new Vector3().crossVectors(lowerDirection,wristX).normalize();
       // The native glove has a slanted cuff before the Hand bone. Follow its
       // perimeter so the bare wrist meets it without an abrupt width change.
       const cuffPoints=new Map();
       for(const handMesh of target.meshes.filter(m=>m.part===part&&!/sleeve/i.test(target.textures[m.texture].name))){
         const p=unpack(handMesh.positions),b=Buffer.from(handMesh.bones,'base64');
         for(let v=0;v<b.length;v++)if(b[v]===lower){const point=fitAKCuff(new Vector3().fromArray(p,v*3),side),offset=point.clone().sub(start),t=offset.dot(lowerAxis)/lowerAxis.lengthSq(),radial=offset.addScaledVector(lowerAxis,-t);if(radial.length()>.5)cuffPoints.set(positionKey(point.toArray()),{point,t,angle:Math.atan2(radial.dot(wristY),radial.dot(wristX))});}
       }
       const cuff=[...cuffPoints.values()].sort((a,b)=>a.angle-b.angle);if(cuff.length<3)throw Error('Missing AK glove cuff');
       const cuffT=cuff.reduce((sum,p)=>sum+p.t,0)/cuff.length,forearmAxis=lowerAxis.clone().multiplyScalar(cuffT);
       const parent=target.bones[upper].parent,anchor=new Vector3(...target.bones[upper].position);anchor.y=-24;anchor.applyMatrix4(matrices[parent]);const shoulderControl=shoulder.clone().addScaledVector(upperDirection,-2);
       const cornerStart=start.clone().addScaledVector(upperAxis,-.2),cornerEnd=start.clone().addScaledVector(forearmAxis,.2);
       const shape=[[0,1.62,.84],[.35,1.64,.82],[.75,1.46,.80],[1,1.28,.82],[1.20,1.49,.81],[1.40,1.46,.80],[1.70,1.28,.77],[2,1.18,.77]];
       const section=s=>{let i=1;while(i<shape.length-1&&s>shape[i][0])i++;const a=shape[i-1],b=shape[i],t=smooth((s-a[0])/(b[0]-a[0]));return [a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];};
       const positions=[],uv=[],bones=[],secondaryBones=[],secondaryWeights=[],segments=cuff.length*2,rings=40,vertices=[];
       // Round both the centerline and the section at the elbow. Rotating
       // sections around a sharp corner caused the old arm's swollen joint.
       let previousTangent=upperDirection.clone(),radialX=initialX.clone();
       for(let ring=0;ring<=rings;ring++){
         // Join the shoulder to the body below the view, keeping the open root
         // out of frame even while the native draw animation moves the arm.
         const s=(ring-8)/32*2;let center,tangent;
         if(s<0){const t=(s+.5)/.5;center=anchor.clone().multiplyScalar((1-t)**2).addScaledVector(shoulderControl,2*t*(1-t)).addScaledVector(shoulder,t*t);tangent=shoulderControl.clone().sub(anchor).multiplyScalar(1-t).addScaledVector(shoulder.clone().sub(shoulderControl),t).normalize();}
         else if(s<.8){center=shoulder.clone().addScaledVector(upperAxis,s);tangent=upperDirection.clone();}
         else if(s>1.2){center=start.clone().addScaledVector(forearmAxis,s-1);tangent=lowerDirection.clone();}
         else {const t=(s-.8)/.4;center=cornerStart.clone().multiplyScalar((1-t)**2).addScaledVector(start,2*t*(1-t)).addScaledVector(cornerEnd,t*t);tangent=start.clone().sub(cornerStart).multiplyScalar(1-t).addScaledVector(cornerEnd.clone().sub(start),t).normalize();}
         radialX.applyQuaternion(new Quaternion().setFromUnitVectors(previousTangent,tangent)).normalize();previousTangent.copy(tangent);
         const radialY=new Vector3().crossVectors(tangent,radialX).normalize(),[width,depth]=section(s),leftSupport=side==='L'?1+.3*smooth((s-.35)/.85):1,radius=width*leftSupport*(profile.width/.9),secondaryBone=s<0?parent:lower,secondaryWeight=s<0?1-smooth((s+.5)/.5):smooth((s-.86)/.28),cuffBlend=smooth((s-1.72)/.28);
         for(let n=0;n<=segments;n++){
           const i=Math.floor(n/2)%cuff.length,a=cuff[i],b=cuff[(i+1)%cuff.length],t=n%2/2,angle=a.angle+((b.angle+(i===cuff.length-1?Math.PI*2:0))-a.angle)*t;
           const radial=radialX.clone().multiplyScalar(Math.cos(angle)*radius).addScaledVector(radialY,Math.sin(angle)*radius*depth),point=center.clone().add(radial);
           const cuffPoint=a.point.clone().lerp(b.point,t).addScaledVector(lowerDirection,.08);point.lerp(cuffPoint,cuffBlend);
           // Stay within bare skin; the atlas's .64 row includes the glove edge.
           vertices.push({p:point,uv:[.26+n/segments*.34,.70+Math.max(0,s)/2*.23],secondaryBone,secondaryWeight});
         }
       }
       const emit=i=>{positions.push(...vertices[i].p);uv.push(...vertices[i].uv);bones.push(upper);secondaryBones.push(vertices[i].secondaryBone);secondaryWeights.push(vertices[i].secondaryWeight);};
       for(let ring=0;ring<rings;ring++)for(let n=0;n<segments;n++){const a=ring*(segments+1)+n,b=a+segments+1;[a,b,a+1,a+1,b,b+1].forEach(emit);}
       return {...mesh,name:'character-arms',surface:'skin',texture:target.textures.findIndex(t=>t.name==='adapted-forearm-skin'),positions:pack(positions),uv:pack(uv),bones:Buffer.from(bones).toString('base64'),secondaryBones:Buffer.from(secondaryBones).toString('base64'),secondaryWeights:pack(secondaryWeights),vertices:bones.length};
     });
   }
   const positions=unpack(mesh.positions),uv=unpack(mesh.uv),bones=Buffer.from(mesh.bones,'base64');
   for(let v=0;v<bones.length;v++){
     const boneName=target.bones[bones[v]].name,side=boneName.startsWith('L_')||boneName.startsWith('BIPL')?'L':'R';
     const {start,end}=chains[side],axis=end.clone().sub(start),point=new Vector3().fromArray(positions,v*3),t=point.clone().sub(start).dot(axis)/axis.lengthSq();
     // Only the wrist opening changes: palms, fingers, UVs and grip bones stay native.
     if(ak&&profile.bare&&bones[v]===chains[side].lower){fitAKCuff(point,side);point.toArray(positions,v*3);continue;}
     // Smoothly taper the mid-forearm only. Keep both joints and all finger geometry intact.
     if(!(ak&&profile.bare)&&!protectedPoints.has(positionKey(point.toArray()))&&t>0&&t<1){
       const center=start.clone().addScaledVector(axis,t);
       point.sub(center).multiplyScalar(1-(1-profile.width)*Math.sin(Math.PI*t)**2).add(center);
       point.toArray(positions,v*3);
     }

   }
   return [{...mesh,name:'character-arms',surface:sleeve?(profile.bare?'skin':'cloth'):'glove',texture:mesh.texture,positions:pack(positions),uv:pack(uv)}];
 });
}

export function compressModelJSON(data){
 const raw=Buffer.from(JSON.stringify(data)),strings=[],indices=new Map();
 const encode=value=>{
  if(typeof value==='string'&&value.length>=128){let index=indices.get(value);if(index===undefined){index=strings.length;indices.set(value,index);strings.push(value);}return {r:index};}
  if(Array.isArray(value))return {a:value.map(encode)};
  if(value&&typeof value==='object')return {o:Object.fromEntries(Object.entries(value).map(([key,item])=>[key,encode(item)]))};
  return value;
 };
 const root=encode(data),encoded=Buffer.from(JSON.stringify({version:1,strings,root})),compressed=deflateSync(encoded,{level:9});
 if(!inflateSync(compressed).equals(encoded))throw Error('Model compression round trip mismatch');
 // Exercise the same synchronous decoder used by Safari, and compare the
 // complete canonical JSON bytes rather than sampling model fields.
 const packed=compressed.toString('base64'),restored=Buffer.from(JSON.stringify(decodeCompressedJSON(packed,encoded.length,'string-table-v1')));
 if(!restored.equals(raw))throw Error('Model string table round trip mismatch');
 return {packed,source:{compression:'zlib',encoding:'string-table-v1',jsonBytes:raw.length,encodedJSONBytes:encoded.length,packedBytes:compressed.length,strings:strings.length,sha256:createHash('sha256').update(raw).digest('hex')}};
}
export function generateCF(){
 const indexedBMP=name=>{const b=fs.readFileSync(path.join(root,'assets-source/cf',name)),w=b.readInt32LE(18),h=b.readInt32LE(22),offset=b.readInt32LE(10);if(b.readUInt16LE(28)!==8||h<=0)throw Error('Expected indexed arm texture');const pixels=Buffer.alloc(w*h+768),stride=Math.ceil(w/4)*4;for(let y=0;y<h;y++)b.copy(pixels,y*w,offset+(h-1-y)*stride,offset+(h-1-y)*stride+w);for(let p=0;p<256;p++)for(let c=0;c<3;c++)pixels[w*h+p*3+c]=b[54+p*4+2-c];return {name,w,h,flags:0,pixels:pixels.toString('base64')};};
 const armTextures={cloth:indexedBMP('FVIEW_ARM_NEW_OMOH_BL.bmp'),glove:indexedBMP('FVIEW_HAND_NEW_OMOH_BL.bmp')};
 const assets={};for(const id of ['omoh','fox-bl','fox-gr','star-bl','star-gr','m4-view','m4-world','ak-view']){const p=path.join(root,'assets-source/cf',id+'.mdl'),b=fs.readFileSync(p);assets[id]=convert(b,id==='omoh'?fs.readFileSync(path.join(root,'assets-source/cf/omohT.mdl')):b);console.log(id,assets[id].meshes.reduce((n,m)=>n+m.vertices/3,0),'triangles',Object.keys(assets[id].clips).join(','),JSON.stringify(assets[id].parts));}
 assets['ak-view'].textures.push({...assets['m4-view'].textures.find(t=>t.name==='newhands4.bmp'),name:'adapted-forearm-skin'});
 assets['yun-gr']=retargetCharacter(readMeteorCharacter(path.join(root,'assets-source/cf/yunyouyou')),assets['fox-gr']);
 for(const id of ['omoh','fox-bl','fox-gr','star-bl','star-gr','yun-gr'])assets[id].arms=Object.fromEntries(['m4-view','ak-view'].map(weapon=>[weapon,buildViewArms(assets[weapon],VIEW_ARM_PROFILES[id])]));
 const weapons=JSON.parse(fs.readFileSync(path.join(root,'assets-source/cf/weapons.json'),'utf8'));
 for(const [id,meta] of Object.entries(weapons))for(const role of meta.world?['view','world']:['view']){const b=fs.readFileSync(path.join(root,'assets-source/cf',id+'-'+role+'.mdl'));assets[id+'-'+role]=convert(b,b,{weapon:true,...(role==='view'?meta:{})});console.log(id+'-'+role,assets[id+'-'+role].meshes.reduce((n,m)=>n+m.vertices/3,0),'triangles');}
 fs.writeFileSync(path.join(root,'src/generated/cf-weapon-assets.js'),'// Generated from assets-source/cf/weapons.json\nexport const CF_WEAPON_ASSETS='+JSON.stringify(weapons)+';\n');
 const {packed,source}=compressModelJSON({models:assets,armTextures});
 const module='// Generated by scripts/convert-cf.mjs; lossless string table + zlib JSON. See assets-source/cf/SOURCES.md.\nimport {decodeCompressedJSON} from "../asset-compression.js";\nconst decoded=decodeCompressedJSON('+JSON.stringify(packed)+','+source.encodedJSONBytes+',"string-table-v1");\nexport const CF_MODELS=decoded.models;\nexport const CF_ARM_TEXTURES=decoded.armTextures;\nexport const CF_MODEL_SOURCE='+JSON.stringify(source)+';\n';
 fs.mkdirSync(path.join(root,'src/generated'),{recursive:true});fs.writeFileSync(path.join(root,'src/generated/cf-models.js'),module);console.log('Lossless model JSON:',source.jsonBytes,'bytes ->',source.encodedJSONBytes,'dictionary JSON bytes ->',source.packedBytes,'zlib bytes; SHA256',source.sha256);
const audioDir=path.join(root,'assets-source/cf/audio');
if(fs.existsSync(audioDir))fs.writeFileSync(path.join(root,'src/generated/cf-sounds.js'),'export const CF_SOUNDS='+JSON.stringify(Object.fromEntries(fs.readdirSync(audioDir).map(name=>[name,fs.readFileSync(path.join(audioDir,name)).toString('base64')])))+';');

}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(import.meta.filename))generateCF();
