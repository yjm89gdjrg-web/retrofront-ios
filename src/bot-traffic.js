const gap=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const sameFloor=(a,b)=>Math.abs((a.y??0)-(b.y??0))<1.2;
const pos=a=>({x:a.x,y:a.y,z:a.z});
const direction=(a,b)=>{if(!b)return null;const x=b.x-a.x,z=b.z-a.z,d=Math.hypot(x,z);return d>.03?{x:x/d,z:z/d}:null;};

// Local traffic advice never moves actors. The caller still applies its normal
// wall/body sweeps. Leases belong to a yielding actor, so one frame's update
// order cannot make both opposing teammates change sides at once.
export class BotTraffic {
 constructor({walkLine,projectWalkable}){this.walkLine=walkLine;this.project=projectWalkable;this.reset();}
 reset(){this.leases=new Map();this.queues=new Map();this.cooldowns=new Map();this.probes=new Map();this.intents=new Map();this.previous=new Map();this.actors=[];this.now=0;this.round=null;}
 release(id){this.leases.delete(id);this.queues.delete(id);this.intents.delete(id);}
 begin(actors,now,round){
  if(this.round!==round){this.reset();this.round=round;}
  this.now=Number.isFinite(now)?now:0;this.actors=actors.filter(a=>!a.dead);
  const alive=new Set(this.actors.map(a=>a.id));
  for(const [id,lease] of this.leases)if(!alive.has(id)||!alive.has(lease.other))this.leases.delete(id);
  for(const map of [this.queues,this.cooldowns,this.intents,this.previous])for(const id of map.keys())if(!alive.has(id))map.delete(id);
  for(const actor of this.actors){
   const previous=this.previous.get(actor.id),movement=previous&&gap(previous,actor)>.005?direction(previous,actor):null;
   if(actor.human||actor.id===0){if(movement)this.intents.set(actor.id,{...movement,at:this.now});else this.intents.delete(actor.id);}
   this.previous.set(actor.id,pos(actor));
  }
  for(const [key,value] of this.probes)if(this.now-value.at>.4)this.probes.delete(key);
 }
 narrow(actor,dir){
  const key=`${Math.round(actor.x*2)},${Math.round((actor.y??0)*2)},${Math.round(actor.z*2)},${Math.round(Math.atan2(dir.z,dir.x)*8/Math.PI)}`;
  const cached=this.probes.get(key);if(cached)return cached.narrow;
  const left={x:actor.x-dir.z*1.05,y:actor.y,z:actor.z+dir.x*1.05},right={x:actor.x+dir.z*1.05,y:actor.y,z:actor.z-dir.x*1.05};
  const narrow=!this.walkLine(actor,left,.4)&&!this.walkLine(actor,right,.4);
  if(this.probes.size>=128)this.probes.delete(this.probes.keys().next().value);
  this.probes.set(key,{at:this.now,narrow});return narrow;
 }
 otherDirection(actor){
  const path=actor.path?.find(p=>gap(actor,p)>.08),direct=direction(actor,path);
  if(direct)return direct;
  const intent=this.intents.get(actor.id);return intent&&this.now-intent.at<.2?intent:null;
 }
 safeTarget(actor,target){
  const p=this.project(target);if(!p||Math.abs((p.y??0)-(actor.y??0))>.45||gap(p,target)>.25||!this.walkLine(actor,p,.4))return null;
  return p;
 }
 yieldTarget(actor,other,dir,side){
  // Prefer a pocket to a step backwards. Keep this choice for the whole lease
  // instead of trying alternate sides on every blocked movement frame.
  for(const sign of [side,-side])for(const back of [0,.65,1.3,2])for(const lateral of [.95,1.35]){
   const p=this.safeTarget(actor,{x:actor.x-dir.x*back-dir.z*sign*lateral,y:actor.y,z:actor.z-dir.z*back+dir.x*sign*lateral});
   if(!p||gap(p,other)<1.15)continue;
   const ox=p.x-other.x,oz=p.z-other.z,along=ox*dir.x+oz*dir.z,perp=Math.abs(ox*dir.z-oz*dir.x);
   if(perp>.88&&along<.8)return p;
  }
  // A genuinely one-person corridor may only allow backing up toward its
  // entrance. All segments are still swept by the normal navigation code.
  for(const back of [1.2,.6]){
   const p=this.safeTarget(actor,{x:actor.x-dir.x*back,y:actor.y,z:actor.z-dir.z*back});
   if(p&&gap(p,other)>gap(actor,other)+.25)return p;
  }
  return null;
 }
 decide(actor,point){
  const dir=direction(actor,point);if(!dir)return {mode:'clear',speed:1};
  this.intents.set(actor.id,{...dir,at:this.now});
  const previous=this.leases.get(actor.id);
  if(previous){
   const other=this.actors.find(a=>a.id===previous.other);
   const behind=other&&((other.x-actor.x)*previous.dir.x+(other.z-actor.z)*previous.dir.z)<-.6;
   if(!other||other.team!==actor.team||!sameFloor(actor,other)||gap(actor,other)>3.7||behind){this.leases.delete(actor.id);}
   else if(this.now-previous.started>=3){this.leases.delete(actor.id);this.cooldowns.set(actor.id,this.now+1.1);return {mode:'recover',speed:1};}
   else{
    if(previous.retreat&&previous.target&&gap(actor,previous.target)<.18&&this.now-previous.retarget>.4){
     previous.target=this.yieldTarget(actor,other,previous.dir,previous.side);previous.retarget=this.now;
     previous.retreat=previous.target&&Math.abs((previous.target.x-actor.x)*previous.dir.z-(previous.target.z-actor.z)*previous.dir.x)<.8;
    }
    return {mode:'yield',target:previous.target,other:other.id,speed:.8,started:previous.started};
   }
  }
  if((this.cooldowns.get(actor.id)??0)>this.now)return {mode:'recover',speed:1};
  let conflict=null;
  for(const other of this.actors){
   if(other===actor||other.team!==actor.team||!sameFloor(actor,other))continue;
   const dx=other.x-actor.x,dz=other.z-actor.z,ahead=dx*dir.x+dz*dir.z,lateral=Math.abs(dx*dir.z-dz*dir.x),distance=Math.hypot(dx,dz);
   if(ahead<.15||ahead>2.5||lateral>.8||distance>2.7)continue;
   const otherDir=this.otherDirection(other),dot=otherDir?dir.x*otherDir.x+dir.z*otherDir.z:0;
   if(otherDir&&dot>-.5&&dot<.5)continue;
   if(!this.walkLine(actor,other,.38))continue;
   if(!conflict||distance<conflict.distance)conflict={other,otherDir,dot,distance,ahead};
  }
  if(!conflict||!this.narrow(actor,dir)){this.queues.delete(actor.id);return {mode:'clear',speed:1};}
  const {other,otherDir,dot,ahead}=conflict;
  if(otherDir&&dot>.5){
   // Follow the leading teammate without lateral weaving. A little hysteresis
   // comes from slowing before reaching the hard body sweep's safety radius.
   const speed=Math.max(0,Math.min(1,(ahead-1.18)/.9));let queue=this.queues.get(actor.id);
   if(!queue||queue.other!==other.id||gap(queue.position,other)>.3||speed>.2){queue={other:other.id,at:this.now,position:pos(other)};this.queues.set(actor.id,queue);}
   if(this.now-queue.at>=2.5){this.queues.delete(actor.id);this.cooldowns.set(actor.id,this.now+1.1);return {mode:'recover',speed:1};}
   return {mode:'queue',other:other.id,speed};
  }
  this.queues.delete(actor.id);
  const human=other.human||other.id===0,stationary=!otherDir||['plant','defuse'].includes(other.ai?.state);
  if(!human&&!stationary&&actor.id<other.id)return {mode:'priority',other:other.id,speed:1};
  const side=actor.id%2?1:-1,target=this.yieldTarget(actor,other,dir,side),lease={other:other.id,started:this.now,retarget:this.now,side,dir,target,retreat:target&&Math.abs((target.x-actor.x)*dir.z-(target.z-actor.z)*dir.x)<.8};
  this.leases.set(actor.id,lease);return {mode:'yield',target,other:other.id,speed:.8,started:this.now};
 }
}
