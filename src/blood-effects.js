import * as T from 'three';
import {BLOOD_ASSET} from './generated/blood-asset.js';
import {GroundBlood} from './ground-blood.js';
const finiteVector=value=>Array.isArray(value)&&value.length===3&&value.every(Number.isFinite);
// Sprite maps share one image/GPU source; each map selects one original atlas cell.
export class BloodEffects {
 constructor(world,{texture,maxBursts=24,maxStains=64}={}){
  this.world=world;this.maxBursts=maxBursts;this.bursts=[];this.serial=0;
  this.texture=texture||new T.TextureLoader().load(BLOOD_ASSET.image);
  Object.assign(this.texture,{colorSpace:T.SRGBColorSpace,magFilter:T.LinearFilter,minFilter:T.LinearFilter,generateMipmaps:false});
  this.frames=Array.from({length:BLOOD_ASSET.frames},(_,frame)=>{
   const map=this.texture.clone();map.repeat.set(1/BLOOD_ASSET.columns,1/BLOOD_ASSET.rows);map.offset.set(frame%BLOOD_ASSET.columns/BLOOD_ASSET.columns,1-(Math.floor(frame/BLOOD_ASSET.columns)+1)/BLOOD_ASSET.rows);return map;
  });
  // TextureLoader fills the original texture asynchronously. Clones share its Source.
  // Center the dense first frame's painted area (x=4..42, y=21..41).
  // Animation cells include empty margins; using the whole cell offsets pools.
  this.groundMap=this.texture.clone();this.groundMap.repeat.set(52/512,40/512);this.groundMap.offset.set(0,1-52/512);
  this.ground=new GroundBlood(world,this.groundMap,{maxStains});
 }
 emit(event,{spray=true}={}){
  if(!finiteVector(event.position)||!finiteVector(event.direction)||!(event.damage>0||event.corpse===true))return false;
  const direction=new T.Vector3(...event.direction);if(direction.lengthSq()<1e-8)return false;direction.normalize();
  this.ground.emit(event);if(!spray)return true;
  while(this.bursts.length>=this.maxBursts)this.remove(0);
  const material=new T.SpriteMaterial({map:this.frames[0],transparent:true,opacity:.9,depthTest:true,depthWrite:false,toneMapped:false});
  const node=new T.Sprite(material);node.name='actor-blood';node.center.set(.22,.74);node.position.set(...event.position).addScaledVector(direction,-.045);
  const size=(event.headshot?.5:event.melee?.55:.65)*(event.fatal?1.12:1);node.scale.setScalar(size);this.world.add(node);
  this.bursts.push({node,age:0,duration:BLOOD_ASSET.frames/BLOOD_ASSET.fps,direction,size,id:event.id,seed:++this.serial*2.39996,frame:0});return true;
 }
 update(dt,camera){
  this.ground.update(dt);
  const right=camera?new T.Vector3(1,0,0).applyQuaternion(camera.quaternion):null,up=camera?new T.Vector3(0,1,0).applyQuaternion(camera.quaternion):null;
  for(let i=this.bursts.length-1;i>=0;i--){
   const burst=this.bursts[i];burst.age+=Math.max(0,dt);if(burst.age>=burst.duration){this.remove(i);continue;}
   const frame=Math.min(BLOOD_ASSET.frames-1,Math.floor(burst.age*BLOOD_ASSET.fps));burst.frame=frame;burst.node.material.map=this.frames[frame];
   const life=burst.age/burst.duration;burst.node.material.opacity=.9*Math.min(1,(1-life)/.32);burst.node.scale.setScalar(burst.size*(1+life*.12));
   if(right){const x=burst.direction.dot(right),y=burst.direction.dot(up);burst.node.material.rotation=Math.hypot(x,y)>.15?Math.atan2(y,x):burst.seed;}
  }
 }
 remove(index){const burst=this.bursts[index];burst.node.removeFromParent();burst.node.material.dispose();this.bursts.splice(index,1);}
 clear(){while(this.bursts.length)this.remove(this.bursts.length-1);this.ground.clear();}
 dispose(){this.clear();this.ground.dispose();this.groundMap.dispose();for(const map of this.frames)map.dispose();this.texture.dispose();}
}
