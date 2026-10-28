import * as T from 'three';
import {resolveShotPath,tracerSegment} from './shot-path.js';
const sizes={ak:.23,m4:.18,scar:.2,an94:.2,mp5:.09,awm:.26,m700:.24,usp:.14,deagle:.19,anaconda:.2,colt1911:.14};
function flameTexture(){
 const size=96,pixels=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const dx=(x+.5)/size*2-1,dy=(y+.5)/size*2-1,r=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);
  const radius=.30+.64*Math.max(0,Math.cos(angle*5))**12+.08*Math.max(0,Math.cos(angle*9+1))**8;
  const alpha=Math.max(0,1-r/radius)**.65,core=Math.max(0,1-r/.34),i=(y*size+x)*4;
  pixels[i]=255;pixels[i+1]=Math.round(125+130*core);pixels[i+2]=Math.round(20+210*core);pixels[i+3]=Math.round(alpha*255);
 }
 const map=new T.DataTexture(pixels,size,size);map.colorSpace=T.SRGBColorSpace;map.magFilter=T.LinearFilter;map.minFilter=T.LinearFilter;map.needsUpdate=true;return map;
}
export class ShotEffects {
 constructor(world,view){this.world=world;this.view=view;this.texture=flameTexture();this.flashes=[];this.tracers=[];this.serial=0;}
 emit({weapon,firstPerson=false,showFlash=true,muzzle,origin,dir,distance,follow,trace}){
  if(!sizes[weapon])return;
  if(firstPerson)this.clearPlayerFlash();
  if(showFlash){const material=new T.SpriteMaterial({map:this.texture,transparent:true,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false,rotation:++this.serial*2.39996});
  const sprite=new T.Sprite(material);sprite.name='muzzle-flame';sprite.position.copy(follow());sprite.scale.setScalar(sizes[weapon]);sprite.renderOrder=firstPerson?20:2;(firstPerson?this.view:this.world).add(sprite);
  this.flashes.push({node:sprite,age:0,duration:weapon==='mp5'?.035:.055,size:sizes[weapon],follow,firstPerson});}
  const path=resolveShotPath(origin,dir,distance,muzzle,trace);if(!path)return;
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(6),3));
  const line=new T.Line(geometry,new T.LineBasicMaterial({color:0xffd6a0,transparent:true,opacity:.72,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}));line.name='bullet-trail';line.frustumCulled=false;this.world.add(line);
  const tracer={node:line,path,age:0};this.tracers.push(tracer);this.positionTrail(tracer);
 }
 positionTrail(effect){const segment=tracerSegment(effect.path,effect.age),position=effect.node.geometry.attributes.position;position.setXYZ(0,...segment.from);position.setXYZ(1,...segment.to);position.needsUpdate=true;effect.node.material.opacity=.72*Math.max(.15,1-effect.age/((effect.path.length+2.2)/260));return segment.finished;}
 update(dt){
  for(let i=this.flashes.length-1;i>=0;i--){const f=this.flashes[i];f.age+=dt;if(f.age>=f.duration){this.removeFlash(i);continue;}f.node.position.copy(f.follow());const life=f.age/f.duration;f.node.material.opacity=1-life;f.node.scale.setScalar(f.size*(1+life*.25));}
  for(let i=this.tracers.length-1;i>=0;i--){const t=this.tracers[i];t.age+=dt;if(this.positionTrail(t)){t.node.removeFromParent();t.node.geometry.dispose();t.node.material.dispose();this.tracers.splice(i,1);}}
 }
 removeFlash(index){const f=this.flashes[index];f.node.removeFromParent();f.node.material.dispose();this.flashes.splice(index,1);}
 clearPlayerFlash(){for(let i=this.flashes.length-1;i>=0;i--)if(this.flashes[i].firstPerson)this.removeFlash(i);}
 clear(){while(this.flashes.length)this.removeFlash(this.flashes.length-1);for(const t of this.tracers){t.node.removeFromParent();t.node.geometry.dispose();t.node.material.dispose();}this.tracers=[];}
 dispose(){this.clear();this.texture.dispose();}
}
