// Reader for the recorded SKC/BNC community port; source files are plain data.
import fs from 'node:fs';
import {Euler,Quaternion} from 'three';
import {TGALoader} from 'three/addons/loaders/TGALoader.js';
import {characterNormals} from './smooth-character.mjs';
const pack=a=>Buffer.from(new Float32Array(a).buffer).toString('base64');
export function readMeteorCharacter(root){
 const skin=fs.readFileSync(root+'/p1.skc','utf8'),rig=fs.readFileSync(root+'/p1.bnc','utf8'),entries=[...rig.matchAll(/^bone (\S+)\s*\{([^}]+)\}/gm)],names=entries.map(e=>e[1]);
 const numberLine=(body,key)=>{const match=body.match(new RegExp('^\\s*'+key+'\\s+([^\\r\\n]+)','m'));if(!match)throw Error('Missing '+key);return match[1].trim().split(/\s+/).map(Number);};
 const bones=entries.map(([_,name,body],i)=>{const parentName=body.match(/parent\s+(\S+)/)[1],parent=names.indexOf(parentName),position=numberLine(body,'pivot'),[w,x,y,z]=numberLine(body,'quaternion');if((i>0&&parent<0)||parent>=i)throw Error('Invalid Meteor hierarchy');return {name:name==='b'?'Bip01':'Bip01 '+name.replace(/^b\w{2}_/,'').replaceAll('_',' '),parent,position,rotation:new Euler().setFromQuaternion(new Quaternion(x,y,z,w).normalize(),'ZYX').toArray().slice(0,3)};});
 if(bones.length!==Number(rig.match(/Bones:\s+(\d+)/)[1]))throw Error('Bone count mismatch');
 const vertices=[...skin.matchAll(/^\s*v\s+(.+)$/gm)].map(([,line])=>{const t=line.trim().split(/\s+/),position=t.slice(0,3).map(Number),uv=t.slice(4,6).map(Number),count=+t[7],indices=[],weights=[];if(count<1||count>4)throw Error('Invalid influences');for(let i=0;i<count;i++){indices.push(+t[8+i*2]);weights.push(+t[9+i*2]);}if(indices.some(n=>n<0||n>=bones.length)||Math.abs(weights.reduce((a,b)=>a+b,0)-1)>.001)throw Error('Invalid skin weights');while(indices.length<4){indices.push(0);weights.push(0);}return {position,uv,indices,weights};});
 if(vertices.length!==Number(skin.match(/Vertices:\s+(\d+)/)[1]))throw Error('Vertex count mismatch');
 const textureNames=[...skin.matchAll(/Texture\s+(\S+)/g)].map(m=>m[1]);const buffers=textureNames.map(()=>({positions:[],uv:[],indices:[],weights:[],dominant:[]}));
 const faces=[...skin.matchAll(/^\s*f\s+3\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*$/gm)];if(faces.length!==Number(skin.match(/Triangles:\s+(\d+)/)[1]))throw Error('Face count mismatch');
 for(const face of faces){const mesh=buffers[+face[1]];if(!mesh)throw Error('Invalid material');for(const index of face.slice(2)){const v=vertices[+index];if(!v)throw Error('Invalid vertex');mesh.positions.push(...v.position);mesh.uv.push(v.uv[0],1-v.uv[1]);mesh.indices.push(...v.indices);mesh.weights.push(...v.weights);mesh.dominant.push(v.indices[v.weights.indexOf(Math.max(...v.weights))]);}}
 const meshes=buffers.map((m,i)=>({part:i,name:textureNames[i],texture:i,positions:pack(m.positions),normals:pack(characterNormals(m.positions,m.indices,m.weights)),uv:pack(m.uv),bones:Buffer.from(m.dominant).toString('base64'),skinIndices:Buffer.from(m.indices).toString('base64'),skinWeights:pack(m.weights),vertices:m.dominant.length}));
 const loader=new TGALoader(),textures=textureNames.map(name=>{const b=fs.readFileSync(root+'/'+name),t=loader.parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.length));return {name,w:t.width,h:t.height,format:'rgba',flags:name.includes('hair')?64:0,pixels:Buffer.from(t.data).toString('base64')};});
 return {kind:'character',poseBasis:'goldsrc',bones,meshes,textures,parts:textureNames.map(name=>({name,models:[name]})),clips:{}};
}

