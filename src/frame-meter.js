// Count completed draws rather than requestAnimationFrame callbacks: paused
// and menu render pacing must not be reported as a full-rate combat scene.
export class FrameMeter {
 constructor(){this.reset();}
 reset(now=null,serial=0){this.time=now;this.serial=serial;}
 sample(now,serial){
  if(!Number.isFinite(now)||!Number.isSafeInteger(serial))return null;
  if(this.time===null||now<this.time||serial<this.serial||now-this.time>2000){this.reset(now,serial);return null;}
  const elapsed=now-this.time;if(elapsed<1000)return null;
  const fps=Math.round((serial-this.serial)*1000/elapsed);this.reset(now,serial);return Math.max(0,fps);
 }
}
