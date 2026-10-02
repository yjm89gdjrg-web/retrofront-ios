import { WEAPONS, sanitizeProfile } from './catalog.js';
import { MAP, clearLine, moveActor, findPath, rayBox, raySphere } from './map.js';
export class Game {
  constructor(profile={},seed=1234567) {
    this.profile=sanitizeProfile(profile);this.seed=seed;this.score={attack:0,defend:0};this.round=0;this.events=[];this.paused=false;this.beginRound();
  }
  random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
  emit(type,data={}){this.events.push({type,...data});}
  beginRound(){
    this.round++;this.phase='ready';this.phaseTime=3;this.time=95;this.bomb=null;this.winner=null;this.reason='';this.interact=0;this.botPlant=0;this.botDefuse=0;this.defuserId=null;this.elapsed=0;
    const side=this.profile.side,spawn=MAP.spawn[side],enemy=side==='attack'?'defend':'attack';
    this.player={id:0,team:side,x:spawn.x,z:spawn.z,hp:100,yaw:side==='attack'?0:Math.PI,pitch:0,dead:false,kills:0};
    const locations=enemy==='defend'?[[-13,-12],[13,-12],[0,-17]]:[[-2,17],[2,17],[0,15]];
    this.bots=locations.map(([x,z],i)=>({id:i+1,team:enemy,x,z,hp:100,dead:false,yaw:enemy==='attack'?0:Math.PI,cooldown:1.2+i*.5,nav:0,path:[],site:i%2,alert:0}));
    this.weapons=[this.profile.primary,'usp','knife'];this.slot=0;this.aim=false;this.cooldown=0;this.reloading=0;
    this.ammo=this.weapons.map(id=>({clip:WEAPONS[id].clip,reserve:WEAPONS[id].reserve}));
    this.emit('round',{round:this.round});
  }
  get weapon(){return WEAPONS[this.weapons[this.slot]];}
  get aliveBots(){return this.bots.filter(b=>!b.dead);}
  get objective(){
    if(this.bomb)return this.player.team==='attack'?'守住装置，阻止拆除':'前往闪烁点，长按拆除';
    return this.player.team==='attack'?'携带装置前往 A / B 区域':'阻止敌方在 A / B 安放装置';
  }
  get interaction(){
    if(this.phase!=='live'||this.player.dead)return null;
    if(this.player.team==='attack'&&!this.bomb){const site=MAP.sites.find(s=>Math.hypot(this.player.x-s.x,this.player.z-s.z)<s.r);if(site)return {kind:'plant',duration:3,label:`长按安放 · ${site.id} 区`,site};}
    if(this.player.team==='defend'&&this.bomb&&Math.hypot(this.player.x-this.bomb.x,this.player.z-this.bomb.z)<2.5)return {kind:'defuse',duration:5,label:'长按拆除'};
    return null;
  }
  switchWeapon(slot){
    if(this.player.dead||!['ready','live'].includes(this.phase))return;
    this.slot=(slot+3)%3;this.reloading=0;this.cooldown=.2;this.aim=false;this.emit('switch');
  }
  reload(){const a=this.ammo[this.slot];if(this.phase!=='live'||this.player.dead||this.slot===2||this.reloading>0||a.clip>=this.weapon.clip||a.reserve<=0)return;this.reloading=this.weapon.reload;this.emit('reload');}
  fire(){
    if(this.phase!=='live'||this.paused||this.player.dead||this.cooldown>0||this.reloading>0)return false;
    const w=this.weapon,a=this.ammo[this.slot];if(a.clip<=0&&this.slot!==2){this.reload();return false;}
    if(this.slot!==2)a.clip--;this.cooldown=w.interval;this.interact=0;
    const spread=w.spread*(this.aim?.16:1),yaw=this.player.yaw+(this.random()-.5)*spread,pitch=this.player.pitch+(this.random()-.5)*spread;
    const dir=[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)],origin=[this.player.x,1.6,this.player.z];
    let distance=w.range,target=null,head=false;
    for(const wall of MAP.obstacles)distance=Math.min(distance,rayBox(origin,dir,wall));
    for(const bot of this.aliveBots){
      for(const [y,r,isHead]of [[1.65,.26,true],[1.1,.43,false],[.5,.34,false]]){
        const hit=raySphere(origin,dir,[bot.x,y,bot.z],r);if(hit<distance){distance=hit;target=bot;head=isHead;}
      }
    }
    this.emit('shot',{origin,dir,distance,weapon:w.id});
    if(target){this.damage(target,w.damage*(head?2.8:1));this.emit('hit',{head});target.alert=5;}
    this.player.pitch=Math.min(1.2,this.player.pitch+w.recoil*(this.aim?.65:1));return true;
  }
  damage(actor,amount){
    if(actor.dead||this.phase!=='live')return;actor.hp=Math.max(0,actor.hp-amount);
    if(actor===this.player)this.emit('hurt');
    if(actor.hp===0){actor.dead=true;if(actor!==this.player)this.player.kills++;this.emit('kill',{id:actor.id});this.checkElimination();}
  }
  checkElimination(){
    const playerAlive=!this.player.dead,botAlive=this.aliveBots.length>0;
    const attackAlive=this.player.team==='attack'?playerAlive:botAlive;
    const defendAlive=this.player.team==='defend'?playerAlive:botAlive;
    if(!defendAlive)this.endRound('attack','防守方已被消灭');
    else if(!attackAlive&&!this.bomb)this.endRound('defend','进攻方已被消灭');
  }
  plant(x,z,site){if(this.bomb||this.phase!=='live')return;this.bomb={x,z,site,time:35};this.interact=0;this.botPlant=0;this.emit('plant',{site});}
  endRound(winner,reason){
    if(this.phase!=='live')return;this.winner=winner;this.reason=reason;this.score[winner]++;this.phase=this.score[winner]>=3?'finished':'over';this.phaseTime=4;
    this.emit(this.phase==='finished'?'matchEnd':'roundEnd',{winner,reason});
  }
  update(dt,input={}){
    if(this.paused||this.phase==='finished')return;
    dt=Math.min(Math.max(dt,0),.05);this.elapsed+=dt;
    if(this.phase==='ready'||this.phase==='over'){
      this.phaseTime-=dt;if(this.phaseTime<=0){if(this.phase==='ready'){this.phase='live';this.emit('start');}else this.beginRound();}return;
    }
    this.cooldown=Math.max(0,this.cooldown-dt);
    if(this.reloading>0){this.reloading-=dt;if(this.reloading<=0){const a=this.ammo[this.slot],n=Math.min(this.weapon.clip-a.clip,a.reserve);a.clip+=n;a.reserve-=n;this.reloading=0;}}
    const p=this.player;
    if(!p.dead){
      const mx=input.x||0,mz=input.z||0,len=Math.max(1,Math.hypot(mx,mz)),speed=(this.slot===2?5.3:4.2)*(this.aim?.6:1);
      if(!input.interact)moveActor(p,(Math.cos(p.yaw)*mx-Math.sin(p.yaw)*mz)/len*speed*dt,(Math.sin(p.yaw)*mx+Math.cos(p.yaw)*mz)/len*speed*dt);
      // Preserve taps that begin and end between two animation frames.
      if((input.fire||input.trigger)&&(this.weapon.auto||input.trigger))this.fire();
      const action=this.interaction;
      if(input.interact&&action&&!input.fire&&!this.reloading){this.interact+=dt;if(this.interact>=action.duration){if(action.kind==='plant')this.plant(p.x,p.z,action.site.id);else this.endRound('defend','装置已成功拆除');}}
      else this.interact=0;
    }
    if(this.phase!=='live')return;
    this.updateBots(dt);
    if(this.phase!=='live')return;
    if(this.bomb){this.bomb.time-=dt;if(this.bomb.time<=0)this.endRound('attack','装置引爆');}
    else{this.time-=dt;if(this.time<=0)this.endRound('defend','回合时间耗尽');}
    this.checkElimination();
  }
  updateBots(dt){
    const tuning={easy:{damage:9,interval:1.05,accuracy:.40,speed:2},normal:{damage:12,interval:.72,accuracy:.57,speed:2.4},hard:{damage:17,interval:.5,accuracy:.72,speed:2.8}}[this.profile.difficulty];
    let planting=false,defusing=false;
    const candidate=this.bomb?this.aliveBots.filter(b=>b.team==='defend').sort((a,b)=>Math.hypot(a.x-this.bomb.x,a.z-this.bomb.z)-Math.hypot(b.x-this.bomb.x,b.z-this.bomb.z))[0]:null;
    if(candidate?.id!==this.defuserId){this.botDefuse=0;this.defuserId=candidate?.id??null;}
    for(const bot of this.aliveBots){
      bot.cooldown-=dt;bot.nav-=dt;bot.alert=Math.max(0,bot.alert-dt);
      const p=this.player,dist=Math.hypot(p.x-bot.x,p.z-bot.z),sees=!p.dead&&dist<26&&clearLine(bot,p);
      let target=null,stopped=false;
      if(sees){
        bot.yaw=Math.atan2(p.x-bot.x,-(p.z-bot.z));bot.alert=4;
        if(bot.cooldown<=0){bot.cooldown=tuning.interval+this.random()*.4;this.emit('botShot',{id:bot.id});if(this.random()<tuning.accuracy*Math.min(1,12/Math.max(1,dist)))this.damage(p,tuning.damage);}
        if(dist>13)target=p;else stopped=true;
      }
      if(this.phase!=='live')break;
      if(bot.team==='defend'){
        if(this.bomb){
          if(bot===candidate){target=this.bomb;stopped=false;if(Math.hypot(bot.x-target.x,bot.z-target.z)<1.8){stopped=true;defusing=true;this.botDefuse+=dt;if(this.botDefuse>=5)this.endRound('defend','电脑守卫拆除了装置');}}
          else if(!sees)target=this.bomb;
        }else if(!sees){target=bot.alert>0?p:MAP.sites[bot.site];if(this.elapsed>25&&bot.id===3)target=p;}
      }else if(!this.bomb){
        if(!sees){target=MAP.sites[bot.site];if(Math.hypot(bot.x-target.x,bot.z-target.z)<2.5){stopped=true;if(!planting){planting=true;this.botPlant+=dt;if(this.botPlant>=3)this.plant(bot.x,bot.z,target.id);}}}
      }else if(!sees){target={x:this.bomb.x+(bot.id%2?3:-3),z:this.bomb.z+3};}
      if(target&&!stopped){
        if(bot.nav<=0){bot.path=findPath(bot,target);bot.nav=.9+this.random()*.4;}
        const waypoint=bot.path[0];if(waypoint){const dx=waypoint.x-bot.x,dz=waypoint.z-bot.z,d=Math.hypot(dx,dz);if(d<.25)bot.path.shift();else{if(!sees)bot.yaw=Math.atan2(dx,-dz);moveActor(bot,dx/d*tuning.speed*dt,dz/d*tuning.speed*dt);}}
      }
    }
    if(!planting)this.botPlant=0;if(!defusing)this.botDefuse=0;
  }
}
