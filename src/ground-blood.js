import * as T from 'three';
import {DecalGeometry} from 'three/addons/geometries/DecalGeometry.js';

// Index only upward-facing map triangles, never actors, sky or earlier decals.
export class GroundBlood {
 constructor(world,map,{maxStains=64,lifetime=45}={}){
  this.world=world;this.map=map;this.maxStains=Math.max(1,maxStains);this.lifetime=lifetime;this.stains=[];this.buckets=null;this.serial=0;this.batch=null;this.dirty=false;
 }
 index(){
  this.buckets=new Map();const root=this.world.userData.desertWorld?.world;if(!root)return;
  root.updateMatrixWorld(true);
  root.traverse(mesh=>{
   if(!mesh.isMesh||mesh.userData.bspModel===undefined)return;
   const p=mesh.geometry.attributes.position,indices=mesh.geometry.index,count=indices?.count??p.count;
   for(let i=0;i<count;i+=3){
    const v=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,indices?indices.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld));
    const normal=new T.Vector3().subVectors(v[1],v[0]).cross(new T.Vector3().subVectors(v[2],v[0])).normalize();if(normal.y<.55)continue;
    const box=new T.Box3().setFromPoints(v),triangle={v,normal,box};
    for(let x=Math.floor(box.min.x/2);x<=Math.floor(box.max.x/2);x++)for(let z=Math.floor(box.min.z/2);z<=Math.floor(box.max.z/2);z++){
     const key=x+','+z;if(!this.buckets.has(key))this.buckets.set(key,[]);this.buckets.get(key).push(triangle);
    }
   }
  });
 }
 emit(event){
  if(!this.buckets)this.index();
  const origin=new T.Vector3(...event.position),ray=new T.Ray(origin,new T.Vector3(0,-1,0)),point=new T.Vector3();let surface=null,distance=Infinity;
  for(const triangle of this.buckets.get(Math.floor(origin.x/2)+','+Math.floor(origin.z/2))||[]){
   if(ray.intersectTriangle(...triangle.v,false,point)){
    const drop=origin.y-point.y;if(drop>=0&&drop<distance&&drop<8){distance=drop;surface={point:point.clone(),normal:triangle.normal};}
   }
  }
  if(!surface)return false;
  const seed=++this.serial*2.39996,size=(event.fatal?2.8:event.melee?2.4:2.1)*(1+.12*Math.sin(seed)),radius=size;
  const center=surface.point,candidates=new Set();
  for(let x=Math.floor((center.x-radius)/2);x<=Math.floor((center.x+radius)/2);x++)for(let z=Math.floor((center.z-radius)/2);z<=Math.floor((center.z+radius)/2);z++)for(const t of this.buckets.get(x+','+z)||[])candidates.add(t);
  const positions=[],normals=[];
  for(const t of candidates){
   if(t.normal.dot(surface.normal)<.94||t.box.distanceToPoint(center)>radius)continue;
   for(const v of t.v){positions.push(...v.toArray());normals.push(...t.normal.toArray());}
  }
  const source=new T.BufferGeometry();source.setAttribute('position',new T.Float32BufferAttribute(positions,3));source.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
  const rotation=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),surface.normal).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),seed));
  const geometry=new DecalGeometry(new T.Mesh(source,null),center,new T.Euler().setFromQuaternion(rotation),new T.Vector3(size,size,.12));source.dispose();
  if(!geometry.attributes.position.count){geometry.dispose();return false;}
  const material=new T.MeshBasicMaterial({map:this.map,color:0xffffff,transparent:true,opacity:0,depthTest:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,toneMapped:false});
  // Logical stains retain individual lifetimes; one mesh draws all their faces.
  const node=new T.Mesh(geometry,material);node.name='ground-blood';
  while(this.stains.length>=this.maxStains)this.remove(0);
  this.stains.push({node,age:0,delay:Math.min(.45,Math.sqrt(2*distance/9.8)),id:event.id});this.dirty=true;return true;
 }
 rebuild(){
  const count=this.stains.reduce((sum,s)=>sum+s.node.geometry.attributes.position.count,0);
  if(!count)return;
  if(!this.batch){
   const material=new T.MeshBasicMaterial({map:this.map,vertexColors:true,transparent:true,depthTest:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,toneMapped:false});
   this.batch=new T.Mesh(new T.BufferGeometry(),material);this.batch.name='ground-blood-batch';this.batch.renderOrder=1;this.batch.frustumCulled=false;this.world.add(this.batch);
  }
  const geometry=this.batch.geometry;
  if((geometry.attributes.position?.count||0)<count){
   // Grow only when required. The 64-stain budget bounds retained buffers.
   const capacity=Math.max(1536,2**Math.ceil(Math.log2(count)));
   if(geometry.attributes.position){geometry.dispose();this.batch.geometry=new T.BufferGeometry();}
   const target=this.batch.geometry;
   for(const [name,size]of [['position',3],['uv',2],['color',4]])target.setAttribute(name,new T.BufferAttribute(new Float32Array(capacity*size),size).setUsage(T.DynamicDrawUsage));
  }
  const target=this.batch.geometry,attributes=target.attributes;let offset=0;
  for(const stain of this.stains){
   const source=stain.node.geometry.attributes,n=source.position.count;stain.offset=offset;stain.count=n;
   attributes.position.array.set(source.position.array,offset*3);attributes.uv.array.set(source.uv.array,offset*2);
   for(let i=offset;i<offset+n;i++){const at=i*4;attributes.color.array[at]=attributes.color.array[at+1]=attributes.color.array[at+2]=1;attributes.color.array[at+3]=stain.node.material.opacity;}
   offset+=n;
  }
  target.setDrawRange(0,count);for(const attribute of Object.values(attributes)){attribute.clearUpdateRanges();attribute.addUpdateRange(0,count*attribute.itemSize);attribute.needsUpdate=true;}
  this.dirty=false;
 }
 update(dt){
  // WebGL clears upload ranges after drawing. Preserve them through the second
  // update(0) pass so a fade only uploads changed vertices, not the full buffer.
  let changed=false;const colors=this.batch?.geometry.attributes.color;
  for(let i=this.stains.length-1;i>=0;i--){const stain=this.stains[i];stain.age+=Math.max(0,dt);const age=stain.age-stain.delay;
   if(age>=this.lifetime){this.remove(i);continue;}
   const opacity=.96*Math.max(0,Math.min(1,age/.12))*Math.min(1,(this.lifetime-age)/8);
   if(stain.node.material.opacity!==opacity){stain.node.material.opacity=opacity;if(colors&&!this.dirty){for(let j=stain.offset;j<stain.offset+stain.count;j++)colors.array[j*4+3]=opacity;colors.addUpdateRange(stain.offset*4,stain.count*4);changed=true;}}
  }
  if(this.dirty)this.rebuild();else if(changed)colors.needsUpdate=true;
 }
 remove(index){const {node}=this.stains[index];node.geometry.dispose();node.material.dispose();this.stains.splice(index,1);this.dirty=true;if(!this.stains.length)this.releaseBatch();}
 releaseBatch(){if(!this.batch)return;this.batch.removeFromParent();this.batch.geometry.dispose();this.batch.material.dispose();this.batch=null;this.dirty=false;}
 clear(){while(this.stains.length)this.remove(this.stains.length-1);this.releaseBatch();}
 dispose(){this.clear();this.buckets?.clear();}
}
