import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {CF_MODELS} from '../src/generated/cf-models.js';



const floats=value=>{const b=Buffer.from(value,'base64');return new Float32Array(b.buffer,b.byteOffset,b.byteLength/4);};

test('Yun normals smooth the curved body without deleting the heel or flattening the shoe sole',()=>{
 const mesh=CF_MODELS['yun-gr'].meshes.find(m=>m.name==='yun_body.tga'),p=floats(mesh.positions),n=floats(mesh.normals),groups=new Map();
 assert.equal(n.length,p.length);
 let curved=0,creases=0;
 for(let v=0;v<p.length;v+=9){
  const a=new Vector3().fromArray(p,v),b=new Vector3().fromArray(p,v+3),c=new Vector3().fromArray(p,v+6),face=b.sub(a).cross(c.sub(a)).normalize();
  for(let j=0;j<3;j++){
   const index=v+j*3,normal=new Vector3().fromArray(n,index);assert.ok(Math.abs(normal.length()-1)<1e-5);if(face.dot(normal)<.995)curved++;
   const key=Array.from(p.slice(index,index+3)).map(x=>x.toFixed(4)).join(',');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(normal);
  }
 }
 for(const values of groups.values())if(values.some(v=>v.dot(values[0])<.6))creases++;
 assert.ok(curved>1000,'curved surfaces must no longer use one normal per triangle');assert.ok(creases>20,'creases at soles and garment edges remain sharp');
 assert.equal(CF_MODELS['yun-gr'].meshes.reduce((n,m)=>n+m.vertices/3,0),11748,'retain all original shoe and outfit geometry');
});


