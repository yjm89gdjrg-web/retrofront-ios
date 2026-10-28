import fs from 'node:fs/promises';
import path from 'node:path';
// Collision comes from the complete BSP, including stairs, slopes and solid boxes.
const input=path.resolve(process.argv[2]||'assets-source/maps/desert-full/de_dust2_cf.bsp');
const output=path.resolve('src/generated/desert-collision.js');
const b=await fs.readFile(input);
if(b.readInt32LE(0)!==30)throw new Error('Expected a GoldSrc BSP30 map');
const lumps=Array.from({length:15},(_,i)=>({o:b.readInt32LE(4+i*8),n:b.readInt32LE(8+i*8)}));
for(const l of lumps)if(l.o<0||l.n<0||l.o+l.n>b.length)throw new Error('Invalid BSP lump');
const v=(p)=>[0,4,8].map(k=>b.readFloatLE(p+k));
const entities=[];for(const m of b.toString('latin1',lumps[0].o,lumps[0].o+lumps[0].n).matchAll(/\{([^{}]*)\}/g)){const e={};for(const pair of m[1].matchAll(/"([^"]*)"\s*"([^"]*)"/g))e[pair[1]]=pair[2];entities.push(e);}
const models=Array.from({length:lumps[14].n/64},(_,i)=>{const p=lumps[14].o+i*64;return {min:v(p),max:v(p+12),heads:[0,4,8,12].map(k=>b.readInt32LE(p+36+k)),first:b.readInt32LE(p+56),count:b.readInt32LE(p+60)};});
const scale=.025,center=[(models[0].min[0]+models[0].max[0])/2,(models[0].min[1]+models[0].max[1])/2];
const point=([x,y,z])=>[(x-center[0])*scale,z*scale,-(y-center[1])*scale];
const round=n=>Math.round(n*1e6)/1e6;
const planes=[];for(let i=0;i<lumps[1].n/20;i++){const p=lumps[1].o+i*20,n=v(p);planes.push(n[0],n[2],-n[1],(b.readFloatLE(p+12)-n[0]*center[0]-n[1]*center[1])*scale);}
const leaves=Array.from({length:lumps[10].n/28},(_,i)=>b.readInt32LE(lumps[10].o+i*28));
const nodes=[];for(let i=0;i<lumps[5].n/24;i++){const p=lumps[5].o+i*24,child=k=>{const n=b.readInt16LE(p+k);return n<0?leaves[-n-1]:n;};nodes.push(b.readInt32LE(p),child(4),child(6));}
const clips=[];for(let i=0;i<lumps[9].n/8;i++){const p=lumps[9].o+i*8;clips.push(b.readInt32LE(p),b.readInt16LE(p+4),b.readInt16LE(p+6));}
const entityByModel=new Map(entities.filter(e=>e.model?.startsWith('*')).map(e=>[+e.model.slice(1),e]));
const solidModels=models.map((m,i)=>({index:i,entity:entityByModel.get(i),...m})).filter(m=>m.index===0||m.entity?.classname==='func_breakable');
const solids=solidModels.map(m=>{const a=point(m.min),c=point(m.max);return {index:m.index,hull0:m.heads[0],hull1:m.heads[1],min:a.map((n,k)=>Math.min(n,c[k])),max:a.map((n,k)=>Math.max(n,c[k]))};});
const vertices=Array.from({length:lumps[3].n/12},(_,i)=>point(v(lumps[3].o+i*12)));
const textureNames=Array.from({length:b.readInt32LE(lumps[2].o)},(_,i)=>{const off=b.readInt32LE(lumps[2].o+4+i*4);return off<0?'':b.toString('latin1',lumps[2].o+off,lumps[2].o+off+16).replace(/\0.*$/s,'');});
const floors=[];
for(const model of solidModels)for(let i=model.first;i<model.first+model.count;i++){
 const p=lumps[7].o+i*20,plane=b.readUInt16LE(p),side=b.readInt16LE(p+2),normal=planes.slice(plane*4,plane*4+3).map(n=>side?-n:n);
 const texinfo=b.readUInt16LE(p+10),texture=b.readInt32LE(lumps[6].o+texinfo*40+32);if(/^sky$|^clip$|^aaatrigger$/i.test(textureNames[texture]))continue;
 if(normal[1]<.65)continue;
 const start=b.readInt32LE(p+4),count=b.readUInt16LE(p+8),polygon=[];
 for(let j=0;j<count;j++){const edge=b.readInt32LE(lumps[13].o+(start+j)*4),ep=lumps[12].o+Math.abs(edge)*4;polygon.push(vertices[b.readUInt16LE(ep+(edge<0?2:0))]);}
 for(let j=1;j<polygon.length-1;j++)floors.push([...polygon[0],...polygon[j],...polygon[j+1]].map(round));
}
const starts=side=>entities.filter(e=>e.classname===(side==='attack'?'info_player_deathmatch':'info_player_start')).map(e=>{const p=point(e.origin.split(/\s+/).map(Number));return {x:p[0],y:p[1]-.9,z:p[2],yaw:Math.PI/2-Number((e.angles||'0 0 0').split(/\s+/)[1])*Math.PI/180};});
const targets=entities.filter(e=>e.classname==='func_bomb_target').map(e=>{const m=models[+e.model.slice(1)],a=point(m.min),c=point(m.max);return {id:e.target==='tgt_a'?'A':'B',min:a.map((n,k)=>Math.min(n,c[k])),max:a.map((n,k)=>Math.max(n,c[k]))};});
const bounds=solids[0];
const data={scale,center,bounds:{min:bounds.min,max:bounds.max},planes:planes.map(round),nodes,clips,solids,floors,starts:{attack:starts('attack'),defend:starts('defend')},targets};
await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,'// Generated from the complete BSP30 map. Do not edit.\nexport const BSP_COLLISION = '+JSON.stringify(data)+';\n');
console.log(JSON.stringify({planes:planes.length/4,nodes:nodes.length/3,clips:clips.length/3,solidModels:solids.length,floorTriangles:floors.length,bytes:(await fs.stat(output)).size,bounds:data.bounds}));
