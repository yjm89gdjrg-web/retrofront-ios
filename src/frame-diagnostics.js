// Bounded session statistics. Only consecutive, foreground combat draws count;
// loading, menus and resume gaps must not masquerade as gameplay stalls.
export class FrameDiagnostics {
  constructor(){this.reset();}
  reset(){
    this.bins=new Uint32Array(1001);this.frames=0;this.elapsed=0;this.max=0;
    this.slow=0;this.stutters=0;this.severe=0;this.recent=[];this.baseline();
  }
  baseline(){this.lastTime=null;this.lastSerial=null;}
  sample(now,serial,active){
    if(!active||!Number.isFinite(now)||!Number.isSafeInteger(serial)||serial<0){this.baseline();return;}
    if(this.lastTime===null||now<=this.lastTime||serial<this.lastSerial||serial>this.lastSerial+1){this.lastTime=now;this.lastSerial=serial;return;}
    if(serial===this.lastSerial)return;
    const ms=now-this.lastTime;this.lastTime=now;this.lastSerial=serial;
    this.frames++;this.elapsed+=ms;this.max=Math.max(this.max,ms);
    this.bins[Math.min(1000,Math.ceil(ms))]++;
    if(ms>1000/30+1e-5)this.slow++;
    if(ms>=50-1e-5){
      this.stutters++;if(ms>=100-1e-5)this.severe++;
      this.recent.push({atSeconds:Math.round(this.elapsed/100)/10,frameMs:Math.round(ms*10)/10});
      if(this.recent.length>8)this.recent.shift();
    }
  }
  summary(){
    let p95=0,count=0;const threshold=Math.ceil(this.frames*.95);
    if(threshold)for(let i=1;i<this.bins.length;i++){count+=this.bins[i];if(count>=threshold){p95=i;break;}}
    return {frames:this.frames,activeSeconds:Math.round(this.elapsed/100)/10,
      averageFPS:this.elapsed?Math.round(this.frames*10000/this.elapsed)/10:0,
      p95FrameMs:Math.round(Math.min(p95,this.max)*10)/10,p95Capped:p95===1000&&this.max>=1000,maxFrameMs:Math.round(this.max*10)/10,
      framesOver33ms:this.slow,stutters50ms:this.stutters,severe100ms:this.severe,
      recentStutters:this.recent.map(record=>({...record}))};
  }
}
