// Offline GoldSrc BSP30/WAD3 conversion using the published binary layout:
// https://github.com/ValveSoftware/halflife/blob/master/utils/common/bspfile.h
// No external executables or geometry decompilation are required.
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {deflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';

const SCALE=.025;
const LUMPS=['entities','planes','textures','vertices','visibility','nodes','texinfo','faces','lighting','clipnodes','leaves','markfaces','edges','surfedges','models'];
const range=(b,o,n)=>Number.isInteger(o)&&Number.isInteger(n)&&o>=0&&n>=0&&o+n<=b.length;
const cstring=(b,o,n)=>b.toString('latin1',o,o+n).replace(/\0.*$/s,'');
const floats=(b,o,n)=>Array.from({length:n},(_,i)=>b.readFloatLE(o+i*4));
const hash=b=>createHash('sha256').update(b).digest('hex');
const b64f=a=>Buffer.from(Float32Array.from(a).buffer).toString('base64');
const b64i=a=>Buffer.from(Int32Array.from(a).buffer).toString('base64');
function parseEntities(data){
  const result=[];for(const block of data.toString('latin1').matchAll(/\{([^{}]*)\}/g)){
    const entity={};for(const pair of block[1].matchAll(/"((?:\\.|[^"\\])*)"\s*"((?:\\.|[^"\\])*)"/g))entity[pair[1]]=pair[2];result.push(entity);
  }return result;
}
const crcTable=Uint32Array.from({length:256},(_,i)=>{let c=i;for(let j=0;j<8;j++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc(data){let c=0xffffffff;for(const v of data)c=crcTable[(c^v)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type),header=Buffer.alloc(4),tail=Buffer.alloc(4);header.writeUInt32BE(data.length);tail.writeUInt32BE(crc(Buffer.concat([name,data])));return Buffer.concat([header,name,data,tail]);}
function png(width,height,rgba){
  const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
  const scan=Buffer.alloc((width*4+1)*height);for(let y=0;y<height;y++)Buffer.from(rgba.buffer,rgba.byteOffset+y*width*4,width*4).copy(scan,y*(width*4+1)+1);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(scan,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
function mipTexture(buffer,offset,source){
  if(!range(buffer,offset,40))return null;
  const name=cstring(buffer,offset,16),width=buffer.readUInt32LE(offset+16),height=buffer.readUInt32LE(offset+20),offsets=Array.from({length:4},(_,i)=>buffer.readUInt32LE(offset+24+i*4));
  if(!name||width<1||height<1||width*height>16*1024*1024)return null;
  const result={name,width,height,source};if(!offsets[0])return result;
  const pixels=offset+offsets[0],palette=offset+offsets[3]+width*height/64+2;
  if(!range(buffer,pixels,width*height)||!range(buffer,palette,768))throw new Error(`Invalid indexed pixels or palette: ${name}`);
  const rgba=new Uint8Array(width*height*4),transparent=name.startsWith('{');
  for(let i=0;i<width*height;i++){const index=buffer[pixels+i];for(let j=0;j<3;j++)rgba[i*4+j]=buffer[palette+index*3+j];rgba[i*4+3]=transparent&&index===255?0:255;}
  return {...result,rgba,transparent};
}
function wadTextures(buffer,source){
  if(!['WAD2','WAD3'].includes(buffer.toString('ascii',0,4)))throw new Error(`Not a WAD archive: ${source}`);
  const count=buffer.readInt32LE(4),table=buffer.readInt32LE(8);if(count<0||count>65536||!range(buffer,table,count*32))throw new Error('Invalid WAD directory');
  const textures=new Map();for(let i=0;i<count;i++){
    const base=table+i*32;if(buffer[base+13])continue;const type=buffer[base+12];if(type!==0x43&&type!==0x44)continue;
    const item=mipTexture(buffer,buffer.readInt32LE(base),source);if(item?.rgba)textures.set(item.name.toLowerCase(),item);
  }return textures;
}
function tga(buffer){
  const id=buffer[0],colorMap=buffer[1],type=buffer[2],width=buffer.readUInt16LE(12),height=buffer.readUInt16LE(14),depth=buffer[16],flags=buffer[17],step=depth/8;
  if(colorMap||![2,10].includes(type)||![24,32].includes(depth))throw new Error('Unsupported sky TGA');
  const total=width*height,pixels=[];let at=18+id;
  const pixel=()=>{if(!range(buffer,at,step))throw new Error('Truncated TGA');const p=[buffer[at+2],buffer[at+1],buffer[at],step===4?buffer[at+3]:255];at+=step;return p;};
  if(type===2)for(let i=0;i<total;i++)pixels.push(pixel());
  else while(pixels.length<total){const packet=buffer[at++],count=(packet&127)+1;if(packet&128){const p=pixel();for(let i=0;i<count;i++)pixels.push(p);}else for(let i=0;i<count;i++)pixels.push(pixel());}
  const rgba=new Uint8Array(total*4);for(let i=0;i<total;i++){
    const x=flags&16?width-1-i%width:i%width,y=flags&32?Math.floor(i/width):height-1-Math.floor(i/width);rgba.set(pixels[i],(y*width+x)*4);
  }return {width,height,rgba};
}
function atlasPack(faces,size=2048){
  const pages=[];const newPage=()=>{const page={size,pixels:new Uint8Array(size*size*4).fill(255),x:0,y:0,row:0};pages.push(page);return page;};let page=newPage();
  for(const face of faces.filter(f=>f.light).sort((a,b)=>b.light.h-a.light.h)){
    const w=face.light.w+2,h=face.light.h+2;if(w>size||h>size)throw new Error(`Oversized lightmap face ${face.id}`);
    if(page.x+w>size){page.x=0;page.y+=page.row;page.row=0;}if(page.y+h>size)page=newPage();
    Object.assign(face.light,{atlas:pages.length-1,x:page.x+1,y:page.y+1});page.x+=w;page.row=Math.max(page.row,h);
  }return pages;
}
export async function convertFullDesert(inputDirectory,outputDirectory){
  const bspFile=path.join(inputDirectory,'de_dust2_cf.bsp'),bsp=await readFile(bspFile);if(bsp.readInt32LE(0)!==30)throw new Error('Only GoldSrc BSP30 is supported by this converter');
  const lumps=LUMPS.map((name,i)=>({name,offset:bsp.readInt32LE(4+i*8),bytes:bsp.readInt32LE(8+i*8)}));for(const l of lumps)if(!range(bsp,l.offset,l.bytes))throw new Error(`Invalid lump ${l.name}`);
  const slice=name=>{const l=lumps.find(l=>l.name===name);return bsp.subarray(l.offset,l.offset+l.bytes);},entities=parseEntities(slice('entities'));
  const vertices=slice('vertices'),planesData=slice('planes'),texinfoData=slice('texinfo'),edges=slice('edges'),surfedges=slice('surfedges'),faceData=slice('faces'),modelData=slice('models'),lighting=slice('lighting');
  const models=Array.from({length:modelData.length/64},(_,id)=>{const p=id*64;return {id,minSource:floats(modelData,p,3),maxSource:floats(modelData,p+12,3),originSource:floats(modelData,p+24,3),headnodes:Array.from({length:4},(_,i)=>modelData.readInt32LE(p+36+i*4)),firstFace:modelData.readInt32LE(p+56),faceCount:modelData.readInt32LE(p+60)};});
  const center=[(models[0].minSource[0]+models[0].maxSource[0])/2,(models[0].minSource[1]+models[0].maxSource[1])/2];
  const point=p=>[(p[0]-center[0])*SCALE,p[2]*SCALE,-(p[1]-center[1])*SCALE],vector=n=>[n[0],n[2],-n[1]],bounds=(min,max)=>({min:point([min[0],max[1],min[2]]),max:point([max[0],min[1],max[2]])});
  const planes=Array.from({length:planesData.length/20},(_,i)=>({n:floats(planesData,i*20,3),d:planesData.readFloatLE(i*20+12),type:planesData.readInt32LE(i*20+16)}));
  const texinfos=Array.from({length:texinfoData.length/40},(_,i)=>({s:floats(texinfoData,i*40,4),t:floats(texinfoData,i*40+16,4),texture:texinfoData.readInt32LE(i*40+32),flags:texinfoData.readInt32LE(i*40+36)}));
  const wadSources=[],wadItems=new Map();for(const file of (await readdir(inputDirectory)).filter(file=>/\.wad$/i.test(file))){const data=await readFile(path.join(inputDirectory,file));wadSources.push({file,bytes:data.length,sha256:hash(data)});for(const [name,item]of wadTextures(data,file))wadItems.set(name,item);}
  const textureData=slice('textures'),textureCount=textureData.readInt32LE(0),textures=[];for(let i=0;i<textureCount;i++){
    const offset=textureData.readInt32LE(4+i*4);if(offset<0)throw new Error(`Missing BSP miptex ${i}`);const reference=mipTexture(textureData,offset,'BSP embedded'),item=reference.rgba?reference:wadItems.get(reference.name.toLowerCase());
    if(!item?.rgba)throw new Error(`Missing original texture: ${reference.name}`);textures.push({...item,index:i});
  }
  const entityByModel=new Map(entities.filter(e=>/^\*\d+$/.test(e.model||'')).map(e=>[Number(e.model.slice(1)),e]));
  for(const model of models){model.entity=entityByModel.get(model.id)||null;model.classname=model.id===0?'worldspawn':model.entity?.classname||'unassigned_bmodel';model.solid=model.id===0||['func_wall','func_breakable','func_door','func_door_rotating','func_train','func_rotating','func_conveyor','func_button','func_plat','func_pendulum'].includes(model.classname);model.hidden=/trigger|buyzone|bomb_target/.test(model.classname);model.bounds=bounds(model.minSource,model.maxSource);model.origin=point(model.originSource);}
  const faceModel=new Int32Array(faceData.length/20).fill(-1);for(const model of models)for(let f=model.firstFace;f<model.firstFace+model.faceCount;f++)faceModel[f]=model.id;
  const faces=[];for(let id=0;id<faceData.length/20;id++){
    const at=id*20,planeIndex=faceData.readUInt16LE(at),side=faceData.readInt16LE(at+2),firstEdge=faceData.readInt32LE(at+4),edgeCount=faceData.readUInt16LE(at+8),texinfo=faceData.readUInt16LE(at+10),style=faceData[at+12],lightOffset=faceData.readInt32LE(at+16),info=texinfos[texinfo];
    if(!info||!planes[planeIndex])throw new Error(`Invalid face references: ${id}`);
    const polygon=[];for(let i=0;i<edgeCount;i++){
      const edge=surfedges.readInt32LE((firstEdge+i)*4),index=edges.readUInt16LE(Math.abs(edge)*4+(edge<0?2:0));if(!range(vertices,index*12,12))throw new Error(`Invalid vertex on face ${id}`);polygon.push(floats(vertices,index*12,3));
    }
    if(polygon.length<3)throw new Error(`Degenerate polygon ${id}`);
    const st=polygon.map(p=>[p[0]*info.s[0]+p[1]*info.s[1]+p[2]*info.s[2]+info.s[3],p[0]*info.t[0]+p[1]*info.t[1]+p[2]*info.t[2]+info.t[3]]);
    const min=[0,1].map(j=>Math.floor(Math.min(...st.map(p=>p[j]))/16)),max=[0,1].map(j=>Math.ceil(Math.max(...st.map(p=>p[j]))/16)),w=max[0]-min[0]+1,h=max[1]-min[1]+1;
    let light=null;if(lightOffset>=0&&style!==255&&!(info.flags&1)){
      if(!range(lighting,lightOffset,w*h*3))throw new Error(`Invalid face light samples: ${id} (${w}x${h})`);light={offset:lightOffset,w,h,min,style,styles:[...faceData.subarray(at+12,at+16)]};
    }
    faces.push({id,model:faceModel[id],texture:info.texture,plane:planeIndex,normal:vector(planes[planeIndex].n.map(v=>side?-v:v)),polygon,st,light});
  }
  const atlases=atlasPack(faces);for(const face of faces)if(face.light){
    const l=face.light,page=atlases[l.atlas];for(let y=-1;y<=l.h;y++)for(let x=-1;x<=l.w;x++){
      const sample=l.offset+(Math.max(0,Math.min(l.h-1,y))*l.w+Math.max(0,Math.min(l.w-1,x)))*3,destination=((l.y+y)*page.size+l.x+x)*4;
      page.pixels[destination]=lighting[sample];page.pixels[destination+1]=lighting[sample+1];page.pixels[destination+2]=lighting[sample+2];page.pixels[destination+3]=255;
    }
  }
  const groups=new Map(),solidTriangles=[],floorTriangles=[];let triangles=0;for(const face of faces){
    const atlas=face.light?.atlas??-1,key=`${face.model}/${face.texture}/${atlas}`,texture=textures[face.texture];if(!texture)throw new Error(`Missing texture index on face ${face.id}`);
    if(!groups.has(key))groups.set(key,{model:face.model,texture:face.texture,lightmap:atlas,positions:[],normals:[],uv:[],uv2:[],faceIds:[],triangles:0});const group=groups.get(key);
    const projected=face.polygon.map(point);for(let i=1;i<face.polygon.length-1;i++){
      const indices=[0,i,i+1],a=projected[0],b=projected[i],c=projected[i+1],ab=b.map((v,j)=>v-a[j]),ac=c.map((v,j)=>v-a[j]),cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
      if(cross.reduce((sum,v,j)=>sum+v*face.normal[j],0)<0)[indices[1],indices[2]]=[indices[2],indices[1]];
      for(const index of indices){group.positions.push(...projected[index]);group.normals.push(...face.normal);group.uv.push(face.st[index][0]/texture.width,face.st[index][1]/texture.height);
        if(face.light){const l=face.light,size=atlases[l.atlas].size;group.uv2.push((l.x+face.st[index][0]/16-l.min[0]+.5)/size,(l.y+face.st[index][1]/16-l.min[1]+.5)/size);}else group.uv2.push(.5/2048,.5/2048);
      }
      group.faceIds.push(face.id);group.triangles++;triangles++;
      if(models[face.model]?.solid&&!/^sky$/i.test(texture.name)&&!/^aaatrigger$|^clip$|^origin$|^null$/i.test(texture.name)){
        const triangle=indices.flatMap(index=>projected[index]);solidTriangles.push(...triangle);if(face.normal[1]>.65)floorTriangles.push(...triangle);
      }
    }
  }
  await mkdir(path.join(outputDirectory,'textures'),{recursive:true});await mkdir(path.join(outputDirectory,'lightmaps'),{recursive:true});await mkdir(path.join(outputDirectory,'sky'),{recursive:true});
  const textureMetadata=[];for(const texture of textures){const file=`textures/${String(texture.index).padStart(2,'0')}.png`;await writeFile(path.join(outputDirectory,file),png(texture.width,texture.height,texture.rgba));textureMetadata.push({index:texture.index,name:texture.name,file,width:texture.width,height:texture.height,source:texture.source,flipY:false,repeat:true,transparent:!!texture.transparent,sky:/^sky$/i.test(texture.name),trigger:/^aaatrigger$|^clip$|^origin$|^null$/i.test(texture.name)});}
  const lightmapMetadata=[];for(const [i,atlas]of atlases.entries()){const file=`lightmaps/${i}.png`;await writeFile(path.join(outputDirectory,file),png(atlas.size,atlas.size,atlas.pixels));lightmapMetadata.push({index:i,file,width:atlas.size,height:atlas.size,flipY:false,style:0});}
  const sky=[];for(const suffix of ['rt','lf','up','dn','ft','bk']){const file=`sky/mountain${suffix}.png`,data=await readFile(path.join(inputDirectory,'gfx','env',`mountain${suffix}.tga`)),image=tga(data);await writeFile(path.join(outputDirectory,file),png(image.width,image.height,image.rgba));sky.push({suffix,file,width:image.width,height:image.height});}
  const encodedMeshes=[...groups.values()].map((g,id)=>({id,model:g.model,texture:g.texture,lightmap:g.lightmap,vertexCount:g.positions.length/3,triangleCount:g.triangles,positions:b64f(g.positions),normals:b64f(g.normals),uv:b64f(g.uv),uv2:b64f(g.uv2),faceIds:b64i(g.faceIds)}));
  const metadata={format:'retrofront-goldsrc-map-v1',source:'de_dust2_cf.bsp',sourceEngine:'GoldSrc BSP30 community CF port',sha256:hash(bsp),wadSources,coordinateTransform:{scale:SCALE,sourceCenterXY:center,yOffset:0,mapping:'source (x,y,z) -> ((x-centerX)*scale,z*scale,-(y-centerY)*scale)'},bounds:models[0].bounds,textures:textureMetadata,lightmaps:lightmapMetadata,sky,models:models.map(m=>({...m,meshIds:encodedMeshes.filter(g=>g.model===m.id).map(g=>g.id)})),entities:entities.map((e,id)=>({...e,id,...(e.origin?{position:point(e.origin.split(/\s+/).map(Number))}:{}),...(e.angles?{gameYaw:Math.PI/2-Number(e.angles.split(/\s+/)[1])*Math.PI/180}:{})})),counts:{models:models.length,faces:faces.length,triangles,meshes:encodedMeshes.length,textures:textures.length,litFaces:faces.filter(f=>f.light).length,lightmapAtlases:atlases.length,solidTriangles:solidTriangles.length/9,floorTriangles:floorTriangles.length/9},encoding:{attributes:'base64 little-endian Float32, positions/normals itemSize 3; uv/uv2 itemSize 2',faceIds:'base64 little-endian Int32, one face ID per triangle',lightmaps:'Original BSP RGB samples, static first style retained; all original lighting bytes also exported in collision.json'}};
  const nodesData=slice('nodes'),clipData=slice('clipnodes'),leavesData=slice('leaves');
  const sourcePlanes=planes.flatMap(p=>[...p.n,p.d]),metricPlanes=planes.flatMap(p=>[...vector(p.n),SCALE*(p.d-p.n[0]*center[0]-p.n[1]*center[1])]);
  const nodes=Array.from({length:nodesData.length/24},(_,i)=>[nodesData.readInt32LE(i*24),nodesData.readInt16LE(i*24+4),nodesData.readInt16LE(i*24+6)]).flat(),clipnodes=Array.from({length:clipData.length/8},(_,i)=>[clipData.readInt32LE(i*8),clipData.readInt16LE(i*8+4),clipData.readInt16LE(i*8+6)]).flat(),contents=Array.from({length:leavesData.length/28},(_,i)=>leavesData.readInt32LE(i*28));
  const collision={format:'retrofront-goldsrc-collision-v1',coordinateTransform:metadata.coordinateTransform,planeCount:planes.length,planes:b64f(metricPlanes),sourcePlanes:b64f(sourcePlanes),nodes:b64i(nodes),nodeCount:nodes.length/3,clipnodes:b64i(clipnodes),clipnodeCount:clipnodes.length/3,leafContents:b64i(contents),leafCount:contents.length,models:metadata.models,solidTriangles:b64f(solidTriangles),floorTriangles:b64f(floorTriangles),originalLighting:lighting.toString('base64'),visibility:slice('visibility').toString('base64'),encoding:{planes:'Float32 [normalX,normalY,normalZ,distance] in Three world metres',sourcePlanes:'Float32 [normalX,normalY,normalZ,distance] in original GoldSrc units',nodes:'Int32 [planeIndex,front,back]; negative child = -(leafIndex+1)',clipnodes:'Int32 [planeIndex,front,back]; negative child = contents value',leafContents:'Int32; EMPTY=-1, SOLID=-2, WATER=-3, SKY=-6',solidTriangles:'Float32, nine position components per triangle, excludes triggers/illusionary/sky',floorTriangles:'Float32, same as solidTriangles but upward normal > .65'},hull1SourceBounds:{min:[-16,-16,-36],max:[16,16,36]},hull1MetricBounds:{min:[-.4,-.9,-.4],max:[.4,.9,.4]}};
  await writeFile(path.join(outputDirectory,'map.json'),JSON.stringify({...metadata,meshes:encodedMeshes}));await writeFile(path.join(outputDirectory,'metadata.json'),JSON.stringify(metadata,null,2));await writeFile(path.join(outputDirectory,'collision.json'),JSON.stringify(collision));
  await writeFile(path.join(outputDirectory,'entities.json'),JSON.stringify({entities:metadata.entities,spawns:metadata.entities.filter(e=>['info_player_start','info_player_deathmatch'].includes(e.classname)),bombSites:metadata.models.filter(m=>m.classname==='func_bomb_target'),buyZones:metadata.models.filter(m=>m.classname==='func_buyzone')},null,2));
  console.log(JSON.stringify({output:outputDirectory,...metadata.counts,bounds:metadata.bounds,coordinateTransform:metadata.coordinateTransform,missingTextures:[],wadSources:wadSources.map(s=>s.file)}));return metadata;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),workspace=path.resolve(project,'../..');
  await convertFullDesert(process.argv[2]||path.join(workspace,'work/desert-full-map/downloads'),process.argv[3]||path.join(project,'assets-source/maps/desert-full'));
}
