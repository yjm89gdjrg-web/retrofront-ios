const point=p=>Array.isArray(p)&&p.length>=3&&p.slice(0,3).every(Number.isFinite);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

// Coordinates use gameplay yaw: zero looks down -Z, positive yaw turns to +X.
export function soundDirection(position,listener,yaw=0){
  if(!point(position)||!point(listener))return {pan:0,distance:0,gain:1};
  if(!Number.isFinite(yaw))yaw=0;
  const dx=position[0]-listener[0],dy=position[1]-listener[1],dz=position[2]-listener[2],distance=Math.hypot(dx,dy,dz),horizontal=Math.hypot(dx,dz);
  return {pan:horizontal>.01?clamp((dx*Math.cos(yaw)+dz*Math.sin(yaw))/horizontal,-1,1):0,distance,gain:distance>=55?0:1/(1+(distance/13)**2)};
}

export class SpatialAudioField {
  constructor({trace=()=>Infinity,now=()=>performance.now()/1000,cacheLimit=128,raysPerFrame=12}={}){
    this.trace=trace;this.now=now;this.cacheLimit=cacheLimit;this.raysPerFrame=raysPerFrame;this.cache=new Map();this.listener=null;this.yaw=0;this.frame=-1;this.rays=0;
  }
  clear(){this.cache.clear();this.frame=-1;this.rays=0;}
  setListener(position,yaw=0){if(!point(position)||!Number.isFinite(yaw))return false;this.listener=position.slice(0,3);this.yaw=yaw;return true;}
  parameters(position,listener=this.listener,yaw=this.yaw){
    const direction=soundDirection(position,listener,Number.isFinite(yaw)?yaw:0);
    if(!point(position)||!point(listener)||!direction.gain)return {...direction,blocked:false,wallGain:1,cutoff:18000};
    const now=this.now(),frame=Math.floor(now*60);if(frame!==this.frame){this.frame=frame;this.rays=0;}
    // One-meter cells and a short TTL bound work for automatic weapons without
    // retaining actor identities or growing while moving across a long match.
    const key=[...listener,...position].map(n=>Math.floor(n)).join(','),cached=this.cache.get(key);
    let blocked=cached?.blocked??false;
    if(direction.distance>.6&&(!cached||now-cached.time>.18)&&this.rays<this.raysPerFrame){
      this.rays++;
      const delta=position.map((n,i)=>(n-listener[i])/direction.distance);
      blocked=this.trace(listener,delta,direction.distance)<direction.distance-.12;
      this.cache.delete(key);this.cache.set(key,{blocked,time:now});
      if(this.cache.size>this.cacheLimit)this.cache.delete(this.cache.keys().next().value);
    }
    return {...direction,blocked,wallGain:blocked?.38:1,cutoff:blocked?1150:18000};
  }
}

export const validSoundPoint=point;
