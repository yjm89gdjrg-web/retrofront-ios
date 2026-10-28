import {Vector3} from 'three';
// Weld lighting across UV seams without changing the triangles or silhouette.
// Keep sharp shoe soles and double-sided hair cards from averaging together.
export function characterNormals(positions,indices,weights){
 const groups=new Map(),keys=[],faces=[];
 for(let i=0;i<positions.length;i+=9){
  const a=new Vector3().fromArray(positions,i),b=new Vector3().fromArray(positions,i+3),c=new Vector3().fromArray(positions,i+6);
  const normal=b.sub(a).cross(c.sub(a)),unit=normal.clone().normalize();faces.push({normal,unit});
  for(let k=0;k<3;k++){
   const v=i/3+k,key=positions.slice(v*3,v*3+3).map(n=>Math.round(n*10000)).join(',')+':'+indices.slice(v*4,v*4+4).join(',')+':'+weights.slice(v*4,v*4+4).map(n=>Math.round(n*1000)).join(',');
   keys[v]=key;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(faces.length-1);
  }
 }
 const normals=[];
 for(let v=0;v<keys.length;v++){
  const face=faces[Math.floor(v/3)],sum=new Vector3();
  for(const n of new Set(groups.get(keys[v])))if(face.unit.dot(faces[n].unit)>.45)sum.add(faces[n].normal);
  if(sum.lengthSq()<1e-12)sum.copy(face.unit);sum.normalize();normals.push(...sum);
 }
 return normals;
}
