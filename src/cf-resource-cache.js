import * as T from 'three';

// Source assets are immutable. Keep decoded CPU data once per source object;
// each actor still owns its skeleton, materials and BufferGeometry instances.
const decoded=new WeakMap(),pixels=new WeakMap(),textures=new WeakMap();
export function assetBytes(owner,field){
 let fields=decoded.get(owner);if(!fields){fields=new Map();decoded.set(owner,fields);}
 if(!fields.has(field)){const raw=atob(owner[field]),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);fields.set(field,bytes);}
 return fields.get(field);
}
export function assetFloats(owner,field){
 const bytes=assetBytes(owner,field),fields=decoded.get(owner),key=field+':float32';
 if(!fields.has(key))fields.set(key,new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4));
 return fields.get(key);
}
function texturePixels(asset){
 let rgba=pixels.get(asset);if(rgba)return rgba;
 const source=assetBytes(asset,'pixels'),size=asset.w*asset.h;
 rgba=asset.format==='rgba'?source:new Uint8Array(size*4);
 if(asset.format!=='rgba')for(let i=0;i<size;i++){const p=size+source[i]*3;rgba.set([source[p],source[p+1],source[p+2],(asset.flags&64)&&source[i]===255?0:255],i*4);}
 pixels.set(asset,rgba);return rgba;
}
export function acquireCFTexture(asset){
 let entry=textures.get(asset);
 if(!entry){
  const map=new T.DataTexture(texturePixels(asset),asset.w,asset.h);map.colorSpace=T.SRGBColorSpace;map.magFilter=T.LinearFilter;map.minFilter=T.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;map.userData.cfShared=true;
  entry={map,refs:0};textures.set(asset,entry);
 }
 entry.refs++;let released=false;
 return {map:entry.map,release(){if(released)return;released=true;if(--entry.refs===0){entry.map.dispose();textures.delete(asset);}}};
}
