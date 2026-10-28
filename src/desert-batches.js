// Map geometry is immutable. Prepare it once and share the packed CPU buffers
// across matches; each scene still owns and releases its WebGL geometries.
const preparedMaps=new WeakMap(),channels=[['position','positions',3],['normal','normals',3],['uv','uv',2],['uv1','uv2',2]],cellSize=24;
function floats(encoded){
 const raw=atob(encoded),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return new Float32Array(bytes.buffer);
}
function pack(sources){
 const count=sources.reduce((n,s)=>n+s.position.length/3,0),arrays={},bits={},outBits={};
 for(const [name,,size] of channels){arrays[name]=new Float32Array(count*size);outBits[name]=new Uint32Array(arrays[name].buffer);}
 const lookup=new Map(),next=new Int32Array(count),indices=new Uint32Array(count);let unique=0,cursor=0;
 for(const source of sources){
  for(const [name] of channels)bits[name]=new Uint32Array(source[name].buffer,source[name].byteOffset,source[name].length);
  for(let vertex=0;vertex<source.position.length/3;vertex++){
   let hash=2166136261;for(const [name,,size] of channels)for(let j=0;j<size;j++)hash=Math.imul(hash^bits[name][vertex*size+j],16777619);
   const head=lookup.get(hash);let found=-1;
   for(let candidate=head??-1;candidate>=0;candidate=next[candidate]){
    let same=true;for(const [name,,size] of channels){for(let j=0;j<size;j++)if(bits[name][vertex*size+j]!==outBits[name][candidate*size+j]){same=false;break;}if(!same)break;}
    if(same){found=candidate;break;}
   }
   if(found<0){found=unique++;next[found]=head??-1;lookup.set(hash,found);for(const [name,,size] of channels)for(let j=0;j<size;j++)outBits[name][found*size+j]=bits[name][vertex*size+j];}
   indices[cursor++]=found;
  }
 }
 const attributes={};for(const [name,,size] of channels)attributes[name]={array:arrays[name].slice(0,unique*size),itemSize:size};
 return {attributes,index:unique<=65535?new Uint16Array(indices):indices,vertices:unique,sourceVertices:count};
}
export function prepareDesertBatches(map){
 if(preparedMaps.has(map))return preparedMaps.get(map);
 const groups=new Map();let sourceMeshes=0,sourceVertices=0;
 for(const source of map.meshes){
  const asset=map.textures[source.texture];if(map.models[source.model].hidden||asset.sky||asset.trigger)continue;
  const decoded={};for(const [name,field] of channels)decoded[name]=floats(source[field]);
  let area='world';
  if(source.model!==0){let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;for(let i=0;i<decoded.position.length;i+=3){minX=Math.min(minX,decoded.position[i]);maxX=Math.max(maxX,decoded.position[i]);minZ=Math.min(minZ,decoded.position[i+2]);maxZ=Math.max(maxZ,decoded.position[i+2]);}area=Math.floor((minX+maxX)/2/cellSize)+','+Math.floor((minZ+maxZ)/2/cellSize);}
  const key=source.texture+'/'+source.lightmap+'/'+area;
  if(!groups.has(key))groups.set(key,{texture:source.texture,lightmap:source.lightmap,models:new Set(),sources:[],triangles:0});
  const group=groups.get(key);group.models.add(source.model);group.sources.push(decoded);group.triangles+=source.triangleCount;sourceMeshes++;sourceVertices+=decoded.position.length/3;
 }
 const batches=[...groups.values()].map(group=>({texture:group.texture,lightmap:group.lightmap,models:[...group.models],triangles:group.triangles,...pack(group.sources)}));
 const stats={sourceMeshes,renderMeshes:batches.length,sourceVertices,vertices:batches.reduce((n,b)=>n+b.vertices,0),triangles:batches.reduce((n,b)=>n+b.triangles,0),sourceAttributeBytes:sourceVertices*40,geometryBytes:batches.reduce((n,b)=>n+b.index.byteLength+Object.values(b.attributes).reduce((sum,a)=>sum+a.array.byteLength,0),0)};
 const prepared={batches,stats};preparedMaps.set(map,prepared);return prepared;
}
