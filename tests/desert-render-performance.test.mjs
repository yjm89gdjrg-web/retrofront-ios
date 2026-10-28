import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {DESERT_MAP} from '../src/generated/desert-assets.js';
import {prepareDesertBatches} from '../src/desert-batches.js';
import {buildDesertWorld,disposeDesertWorld} from '../src/desert-world.js';
const channels=[['position','positions',3],['normal','normals',3],['uv','uv',2],['uv1','uv2',2]];
const unpack=value=>{const b=Buffer.from(value,'base64');return new Float32Array(b.buffer,b.byteOffset,b.byteLength/4);};
function signatures(attributes,index){
 const count=index?.length??attributes.position.length/3,result=[],bits={};for(const [name]of channels)bits[name]=new Uint32Array(attributes[name].buffer,attributes[name].byteOffset,attributes[name].length);
 const triangle=new Uint32Array(30);
 for(let i=0;i<count;i+=3){let at=0;for(let j=0;j<3;j++){const vertex=index?index[i+j]:i+j;for(const [name,,size]of channels)for(let n=0;n<size;n++)triangle[at++]=bits[name][vertex*size+n];}result.push(createHash('sha256').update(new Uint8Array(triangle.buffer)).digest('hex'));}
 return result;
}
test('map batching preserves every native triangle, normal, diffuse UV and baked-light UV exactly',()=>{
 const expected=new Map(),actual=new Map();
 for(const source of DESERT_MAP.meshes){const asset=DESERT_MAP.textures[source.texture];if(DESERT_MAP.models[source.model].hidden||asset.sky||asset.trigger)continue;const attributes={};for(const [name,field]of channels)attributes[name]=unpack(source[field]);const key=source.texture+'/'+source.lightmap;if(!expected.has(key))expected.set(key,[]);expected.get(key).push(...signatures(attributes));}
 const {batches,stats}=prepareDesertBatches(DESERT_MAP);
 for(const batch of batches){const key=batch.texture+'/'+batch.lightmap;if(!actual.has(key))actual.set(key,[]);actual.get(key).push(...signatures(Object.fromEntries(Object.entries(batch.attributes).map(([name,a])=>[name,a.array])),batch.index));}
 assert.deepEqual([...actual.keys()].sort(),[...expected.keys()].sort());for(const [key,values]of expected)assert.deepEqual(actual.get(key).sort(),values.sort(),key);
 assert.equal(stats.sourceMeshes,96);assert.equal(stats.renderMeshes,72);assert.equal(stats.triangles,37935);assert.ok(stats.geometryBytes<stats.sourceAttributeBytes*.65);assert.equal(stats.sourceAttributeBytes,4552200);
 assert.equal(prepareDesertBatches(DESERT_MAP).batches,batches,'later matches reuse prepared buffers');
});
test('map batches keep independently disposable scene resources and avoid lightmap mip allocations',async()=>{
 const original=T.TextureLoader.prototype.load;T.TextureLoader.prototype.load=function(_uri,onLoad){const texture=new T.Texture();queueMicrotask(()=>onLoad?.(texture));return texture;};
 const first=new T.Scene(),second=new T.Scene();
 try{
  buildDesertWorld(first);buildDesertWorld(second);await first.userData.mapReady;await second.userData.mapReady;
  const a=first.userData.desertWorld,b=second.userData.desertWorld,ma=a.world.children.find(n=>n.userData.bspModel!==undefined),mb=b.world.children.find(n=>n.userData.bspModel!==undefined);
  assert.notEqual(ma.geometry,mb.geometry);assert.equal(ma.geometry.attributes.position.array,mb.geometry.attributes.position.array);assert.equal(ma.geometry.index.array,mb.geometry.index.array);
  const lightmap=[...a.textures].find(texture=>texture.channel===1);assert.ok(lightmap);assert.equal(lightmap.generateMipmaps,false);assert.equal(lightmap.minFilter,T.LinearFilter);
  const counters={geometries:0,materials:0,textures:0};for(const [kind,resources]of [['geometries',a.geometries],['materials',a.materials],['textures',a.textures]])for(const resource of resources)resource.addEventListener('dispose',()=>counters[kind]++);
  disposeDesertWorld(first);disposeDesertWorld(first);for(const [kind,resources]of [['geometries',a.geometries],['materials',a.materials],['textures',a.textures]])assert.equal(counters[kind],resources.size,kind);
  assert.equal(first.userData.desertWorld,undefined);assert.ok(second.userData.desertWorld);assert.equal(second.userData.mapMeshCount,78);assert.equal(second.userData.mapNativeCounts,DESERT_MAP.counts);
 }finally{disposeDesertWorld(first);disposeDesertWorld(second);T.TextureLoader.prototype.load=original;}
});
