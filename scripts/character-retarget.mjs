import {Matrix4,Quaternion,Euler,Vector3} from 'three';
const pack=a=>Buffer.from(new Float32Array(a).buffer).toString('base64');
const floats=s=>new Float32Array(Uint8Array.from(Buffer.from(s,'base64')).buffer);
// Retarget the existing rifle poses through world-space bind rotations; retain this model's bone lengths.
export function retargetCharacter(target,source){
 const local=b=>new Quaternion().setFromEuler(new Euler(...b.rotation,'ZYX'));
 const worldRest=bones=>{const out=[];for(const b of bones)out.push(b.parent<0?local(b):out[b.parent].clone().multiply(local(b)));return out;};
 const a=worldRest(source.bones),b=worldRest(target.bones),names=new Map(source.bones.map((n,i)=>[n.name,i]));
 const mapped=target.bones.map(bone=>names.get(bone.name==='Bip01 Spine4'?'Bip01 Spine3':bone.name));
 const restPositions=[];for(let i=0;i<source.bones.length;i++){const bone=source.bones[i],p=new Vector3(...bone.position);restPositions.push(bone.parent<0?p:p.applyQuaternion(a[bone.parent]).add(restPositions[bone.parent]));}
 const hipScale=target.bones[0].position[2]/restPositions[mapped[0]].z;
 for(const [name,clip]of Object.entries(source.clips)){
  const src=floats(clip.poses),poses=[];for(let frame=0;frame<clip.frames;frame++){
   const aq=[],ap=[],bq=[];for(let i=0;i<source.bones.length;i++){const offset=(frame*source.bones.length+i)*7,q=new Quaternion().fromArray(src,offset+3),p=new Vector3().fromArray(src,offset),parent=source.bones[i].parent;ap.push(parent<0?p:p.applyQuaternion(aq[parent]).add(ap[parent]));aq.push(parent<0?q:aq[parent].clone().multiply(q));}
   for(let i=0;i<target.bones.length;i++){const bone=target.bones[i],index=mapped[i],parent=bone.parent;let world,q;if(index!==undefined){world=target.poseBasis==='goldsrc'?aq[index].clone():aq[index].clone().multiply(a[index].clone().invert()).multiply(b[i]);q=parent<0?world.clone():bq[parent].clone().invert().multiply(world);}else{q=local(bone);world=parent<0?q.clone():bq[parent].clone().multiply(q);}bq.push(world);const position=new Vector3(...bone.position);if(parent<0&&index!==undefined)position.add(ap[index].clone().sub(restPositions[index]).multiplyScalar(hipScale));poses.push(...position,q.x,q.y,q.z,q.w);}
  }target.clips[name]={fps:clip.fps,frames:clip.frames,poses:pack(poses)};
 }
 groundDeaths(target);
 return target;
}
// Different body proportions need a floor correction after retargeting a fall.
// Bake it into the clips so corpse visuals and skinned hit detection agree.
function groundDeaths(model){
 const unit=new Vector3(1,1,1),rest=[];
 for(const bone of model.bones){const matrix=new Matrix4().compose(new Vector3(...bone.position),new Quaternion().setFromEuler(new Euler(...bone.rotation,'ZYX')),unit);rest.push(bone.parent<0?matrix:rest[bone.parent].clone().multiply(matrix));}
 const inverses=rest.map(m=>m.clone().invert()),unique=new Map();
 for(const mesh of model.meshes){const p=floats(mesh.positions),weights=floats(mesh.skinWeights),indices=Buffer.from(mesh.skinIndices,'base64');for(let i=0;i<mesh.vertices;i++){const entry=[...p.subarray(i*3,i*3+3),...indices.subarray(i*4,i*4+4),...weights.subarray(i*4,i*4+4)];unique.set(entry.join(','),entry);}}
 const points=[...unique.values()],minimum=(poses,frame)=>{const world=[],skin=[];for(let i=0;i<model.bones.length;i++){const offset=(frame*model.bones.length+i)*7,local=new Matrix4().compose(new Vector3().fromArray(poses,offset),new Quaternion().fromArray(poses,offset+3),unit),parent=model.bones[i].parent;world.push(parent<0?local:world[parent].clone().multiply(local));skin.push(world[i].clone().multiply(inverses[i]).elements);}let min=Infinity;for(const p of points){let z=0;for(let k=0;k<4;k++){if(!p[7+k])continue;const m=skin[p[3+k]];z+=p[7+k]*(p[0]*m[2]+p[1]*m[6]+p[2]*m[10]+m[14]);}min=Math.min(min,z);}return min;};
 const idle=model.clips.ref_aim_rifle||model.clips.idle1,ground=minimum(floats(idle.poses),0);
 for(const [name,clip]of Object.entries(model.clips)){if(!name.startsWith('death'))continue;const poses=floats(clip.poses);for(let frame=0;frame<clip.frames;frame++)poses[frame*model.bones.length*7+2]+=ground-minimum(poses,frame);clip.poses=pack(poses);}
}

