// Keep gameplay simulation independent from menu/paused drawing frequency.
export class RenderPacer {
 constructor(){this.mode=null;this.elapsed=0;this.force=true;}
 invalidate(){this.force=true;}
 consume(mode,dt){
  if(this.mode!==mode){this.mode=mode;this.elapsed=0;this.force=true;}
  this.elapsed+=Math.max(0,dt);const interval=mode==='menu'?1/30:mode==='paused'?1/15:0;
  if(!this.force&&interval&&this.elapsed+1e-6<interval)return null;
  const elapsed=this.elapsed;this.elapsed=0;this.force=false;return elapsed;
 }
}

// Adapt only after sustained frame pressure. A user-selected quality stays the
// upper bound; brief loading spikes cannot make resolution oscillate each frame.
export class ResolutionBudget {
 constructor(quality='low',deviceRatio=1){this.configure(quality,deviceRatio);}
 configure(quality,deviceRatio){
  this.max=Math.min(deviceRatio,quality==='high'?1.6:1);this.min=Math.min(this.max,quality==='high'?.9:.7);this.ratio=this.max;this.reset();return this.ratio;
 }
 reset(){this.seconds=0;this.frames=0;this.sum=0;this.recovery=0;}
 sample(dt){
  if(!Number.isFinite(dt)||dt<=0||dt>.1)return null;
  this.seconds+=dt;this.frames++;this.sum+=dt;
  if(this.seconds<2)return null;
  const average=this.sum/this.frames,seconds=this.seconds;this.seconds=0;this.frames=0;this.sum=0;
  let next=this.ratio;
  if(average>.022){this.recovery=0;next=Math.max(this.min,this.ratio-.15);}
  else if(average<.0175){this.recovery+=seconds;if(this.recovery>=6){next=Math.min(this.max,this.ratio+.05);this.recovery=0;}}
  else this.recovery=0;
  if(Math.abs(next-this.ratio)<1e-5)return null;
  this.ratio=Math.round(next*100)/100;return this.ratio;
 }
}
