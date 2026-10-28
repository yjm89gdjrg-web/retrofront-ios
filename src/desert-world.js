import * as T from 'three';
import {DESERT_MAP as M} from './generated/desert-assets.js';
import {prepareDesertBatches} from './desert-batches.js';

export function buildDesertWorld(scene){
 if(scene.userData.desertWorld)disposeDesertWorld(scene);
 const world=new T.Group();world.name='desert-world';scene.add(world);
 const state={world,geometries:new Set(),materials:new Set(),textures:new Set(),disposed:false};scene.userData.desertWorld=state;
 const errors=[],loads=[],loader=new T.TextureLoader();scene.userData.mapAssetErrors=errors;
 function texture(asset,light=false){
  let t;loads.push(new Promise(resolve=>{t=loader.load(asset.uri,()=>{if(state.disposed)t.dispose();resolve();},undefined,()=>{errors.push(asset.file);resolve();});}));
  t.flipY=false;t.colorSpace=light?T.NoColorSpace:T.SRGBColorSpace;t.wrapS=t.wrapT=light?T.ClampToEdgeWrapping:T.RepeatWrapping;t.anisotropy=light?1:2;t.channel=light?1:0;if(light){t.generateMipmaps=false;t.minFilter=T.LinearFilter;}state.textures.add(t);return t;
 }
 const prepared=prepareDesertBatches(M),usedDiffuse=new Set(prepared.batches.map(b=>b.texture)),usedLightmaps=new Set(prepared.batches.map(b=>b.lightmap));
 const diffuse=M.textures.map((a,i)=>usedDiffuse.has(i)?texture(a):null),lightmaps=M.lightmaps.map((a,i)=>usedLightmaps.has(i)?texture(a,true):null),materialCache=new Map();
 for(const source of prepared.batches){
  const asset=M.textures[source.texture];
  const geometry=new T.BufferGeometry();for(const [name,attribute] of Object.entries(source.attributes))geometry.setAttribute(name,new T.BufferAttribute(attribute.array,attribute.itemSize));geometry.setIndex(new T.BufferAttribute(source.index,1));geometry.computeBoundingSphere();state.geometries.add(geometry);
  const key=source.texture+'/'+source.lightmap;
  if(!materialCache.has(key)){const material=new T.MeshBasicMaterial({map:diffuse[source.texture],lightMap:lightmaps[source.lightmap]||null,lightMapIntensity:2.5,side:T.FrontSide,alphaTest:asset.transparent?.5:0,toneMapped:false});materialCache.set(key,material);state.materials.add(material);}
  const mesh=new T.Mesh(geometry,materialCache.get(key));mesh.name=`desert-native-${source.models.join('-')}-${asset.name}`;mesh.userData.bspModel=source.models[0];mesh.userData.bspModels=source.models;mesh.userData.triangleCount=source.triangles;world.add(mesh);
 }
 // Native baked lighting is retained; these lights affect the character models.
 world.add(new T.HemisphereLight(0xffffff,0x777c82,2));const sun=new T.DirectionalLight(0xffffff,1.7);sun.position.set(-25,50,15);world.add(sun);
 const skyImages=new Map(M.sky.map(a=>[a.suffix,a]));
 // GoldSrc's six st_to_vec bases preserve the native sky orientation and seams.
 const bases=[[3,-1,2],[-3,1,2],[1,3,2],[-1,-3,2],[-2,-1,3],[2,-1,-3]],suffixes=['rt','lf','bk','ft','up','dn'];
 for(let i=0;i<6;i++){
  const corners=[[-1,-1],[1,-1],[1,1],[-1,1]],positions=[],uv=[];
  for(const index of [0,1,2,0,2,3]){const [s,t]=corners[index],v=[s,t,1],source=bases[i].map(k=>Math.sign(k)*v[Math.abs(k)-1]);positions.push(source[0]*60,source[2]*60,-source[1]*60);uv.push((s+1)/2,(1-t)/2);}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));state.geometries.add(geometry);
  const map=texture(skyImages.get(suffixes[i]));map.wrapS=map.wrapT=T.ClampToEdgeWrapping;
  const material=new T.MeshBasicMaterial({map,side:T.DoubleSide,depthWrite:false,toneMapped:false});state.materials.add(material);const sky=new T.Mesh(geometry,material);sky.name='desert-sky';sky.frustumCulled=false;sky.renderOrder=-1000;sky.onBeforeRender=(_r,_s,camera)=>{sky.position.copy(camera.position);sky.updateMatrixWorld(true);};world.add(sky);
 }
 scene.background=new T.Color(0x9dbad3);scene.fog=null;
 scene.userData.mapMeshCount=world.children.filter(o=>o.isMesh).length;
 scene.userData.mapBatchStats=prepared.stats;
 scene.userData.mapNativeCounts=M.counts;scene.userData.mapReady=Promise.all(loads).then(()=>({errors:[...errors]}));return world;
}
export function disposeDesertWorld(scene){const state=scene.userData.desertWorld;if(!state)return;state.disposed=true;state.world.removeFromParent();for(const g of state.geometries)g.dispose();for(const m of state.materials)m.dispose();for(const t of state.textures)t.dispose();scene.background=null;delete scene.userData.desertWorld;delete scene.userData.mapReady;}
