import { WEAPONS, BOT_CHARACTERS, sanitizeProfile, selectBackpack as selectProfileBackpack } from './catalog.js';
import { MAP, moveActor, traceWorld, raySphere, floorAt } from './map.js';
import {standingBlocked} from './bsp-collision.js';
import { updateBotTeam, notifyBotHit } from './bot-ai.js';
import { recordPlayerKill } from './kill-feedback.js';
export class Game {
  constructor(profile={},seed=1234567) {
    this.profile=sanitizeProfile(profile);this.seed=seed;this.score={attack:0,defend:0};this.round=0;this.events=[];this.paused=false;this.beginRound();
  }
  random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
  emit(type,data={}){this.events.push({type,...data});}
  beginRound(){
    this.killChain={count:0,last:-Infinity};
    this.teamIntel={};
    this.jumpHeld=false;
    this.backpackLocked=false;this.activeBackpack=this.profile.activeBackpack;
    this.round++;this.phase='ready';this.phaseTime=3;this.time=120;this.bomb=null;this.winner=null;this.reason='';this.interact=0;this.botPlant=0;this.botDefuse=0;this.defuserId=null;this.planterId=null;this.elapsed=0;
    const side=this.profile.side,spawn=MAP.spawn[side],enemy=side==='attack'?'defend':'attack';
    this.player={id:0,team:side,character:this.profile.character,weapon:this.profile.primary,x:spawn.x,y:spawn.y,z:spawn.z,vy:0,grounded:true,hp:100,yaw:MAP.spawnYaw[side],pitch:0,dead:false,kills:0};
    this.spectator={mode:'follow',x:spawn.x,y:spawn.y+2,z:spawn.z,yaw:this.player.yaw,pitch:0};
    const makeBot=(team,[x,z,y],formationIndex,id)=>({id,team,formationIndex,character:BOT_CHARACTERS[formationIndex%BOT_CHARACTERS.length],weapon:team==='attack'?'ak':'m4',x,y,z,hp:100,dead:false,yaw:MAP.spawnYaw[team],cooldown:.7+formationIndex*.3,nav:0,path:[],site:formationIndex<3?0:1,alert:0});
    this.bots=MAP.teamSpawns[enemy].map((point,i)=>makeBot(enemy,point,i,i+1));
    this.bots.push(...MAP.teamSpawns[side].slice(1).map((point,i)=>makeBot(side,point,i+1,MAP.teamSize+i+1)));
    this.weapons=[this.profile.primary,this.profile.secondary,this.profile.melee];this.slot=0;this.aim=false;this.cooldown=0;this.reloading=0;
    this.ammo=this.weapons.map(id=>({clip:WEAPONS[id].clip,reserve:WEAPONS[id].reserve}));
    this.emit('round',{round:this.round,weapon:this.weapon.id});
  }
  get weapon(){return WEAPONS[this.weapons[this.slot]];}
  get canSelectBackpack(){
    const p=this.player,spawn=MAP.spawn[p.team];
    return !p.dead&&!this.backpackLocked&&['ready','live'].includes(this.phase)&&Math.hypot(p.x-spawn.x,p.z-spawn.z)<=3.5&&Math.abs(p.y-spawn.y)<.7&&p.grounded;
  }
  selectBackpack(index){
    if(this.paused||!this.canSelectBackpack||index===this.activeBackpack||!selectProfileBackpack(this.profile,index))return false;
    this.activeBackpack=index;this.weapons=[this.profile.primary,this.profile.secondary,this.profile.melee];this.slot=0;
    this.ammo=this.weapons.map(id=>({clip:WEAPONS[id].clip,reserve:WEAPONS[id].reserve}));this.player.weapon=this.weapon.id;
    this.aim=false;this.reloading=0;this.interact=0;this.cooldown=.35;
    this.emit('switch',{weapon:this.weapon.id,slot:0,duration:.35});this.emit('backpack',{index});return true;
  }
  get aliveBots(){return this.bots.filter(b=>!b.dead);}
  get aliveAllies(){return this.aliveBots.filter(b=>b.team===this.player.team);}
  get aliveEnemies(){return this.aliveBots.filter(b=>b.team!==this.player.team);}
  get objective(){
    if(this.bomb)return this.player.team==='attack'?'守住装置，阻止拆除':'前往闪烁点，长按拆除';
    return this.player.team==='attack'?'携带装置前往 A / B 区域':'阻止敌方在 A / B 安放装置';
  }
  get interaction(){
    if(this.phase!=='live'||this.player.dead||!this.player.grounded)return null;
    if(this.player.team==='attack'&&!this.bomb){const site=MAP.sites.find(s=>Math.hypot(this.player.x-s.x,this.player.z-s.z)<s.r&&Math.abs(this.player.y-s.y)<.7);if(site)return {kind:'plant',duration:3,label:`长按安放 · ${site.id} 区`,site};}
    if(this.player.team==='defend'&&this.bomb&&Math.hypot(this.player.x-this.bomb.x,this.player.z-this.bomb.z)<2.5&&Math.abs(this.player.y-this.bomb.y)<.7)return {kind:'defuse',duration:5,label:'长按拆除'};
    return null;
  }
  switchWeapon(slot){
    if(this.paused||this.player.dead||!['ready','live'].includes(this.phase)||!Number.isInteger(slot))return;
    const next=((slot%3)+3)%3;if(next===this.slot)return;
    this.slot=next;this.player.weapon=this.weapon.id;this.reloading=0;this.cooldown=.35;this.aim=false;this.emit('switch',{weapon:this.weapon.id,slot:this.slot,duration:.35});
  }
  get canReload(){const a=this.ammo[this.slot];return !this.paused&&this.phase==='live'&&!this.player.dead&&this.slot!==2&&this.reloading<=0&&a.clip<this.weapon.clip&&a.reserve>0;}
  reload(){if(!this.canReload)return false;this.reloading=this.weapon.reload;if(this.weapon.scoped)this.aim=false;this.emit('reload',{weapon:this.weapon.id,duration:this.weapon.reload});return true;}
  jump(){
    const p=this.player;if(this.paused||p.dead||!['live','over'].includes(this.phase)||!p.grounded)return false;
    p.vy=8.3;p.grounded=false;this.interact=0;return true;
  }
  updateVertical(dt){
    const p=this.player;if(p.dead)return;
    if(p.grounded){const ground=floorAt(p.x,p.z,p.y,.46,.12,.4);if(ground!==null){p.y=ground;p.vy=0;return;}p.grounded=false;}
    p.vy-=20.5*dt;const delta=p.vy*dt,steps=Math.max(1,Math.ceil(Math.abs(delta)/.06));
    for(let i=0;i<steps;i++){
      const next=p.y+delta/steps;
      if(p.vy<=0){const ground=floorAt(p.x,p.z,p.y,.06,Math.abs(delta/steps)+.5,.4);if(ground!==null&&next<=ground+.012){p.y=ground;p.vy=0;p.grounded=true;return;}}
      if(standingBlocked(p.x,p.z,next,.4)){let safe=p.y,solid=next;for(let j=0;j<7;j++){const mid=(safe+solid)/2;if(standingBlocked(p.x,p.z,mid,.4))solid=mid;else safe=mid;}p.y=safe;p.grounded=p.vy<=0;p.vy=0;return;}
      p.y=next;
    }
  }
  fire(){
    if(this.phase!=='live'||this.paused||this.player.dead||this.cooldown>0||this.reloading>0)return false;
    const w=this.weapon,a=this.ammo[this.slot];if(a.clip<=0&&this.slot!==2){this.reload();return false;}
    if(this.slot!==2)a.clip--;this.cooldown=w.interval;this.interact=0;
    this.backpackLocked=true;
    const spread=w.spread*(this.aim?.16:1),yaw=this.player.yaw+(this.random()-.5)*spread,pitch=this.player.pitch+(this.random()-.5)*spread;
    const dir=[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)],origin=[this.player.x,this.player.y+1.6,this.player.z];
    let distance=Math.min(w.range,traceWorld(origin,dir,w.range)),target=null,head=false;
    for(const bot of this.aliveBots){
      for(const [y,r,isHead]of [[1.65,.26,true],[1.1,.43,false],[.5,.34,false]]){
        const hit=raySphere(origin,dir,[bot.x,bot.y+y,bot.z],r);if(hit<distance){distance=hit;target=bot;head=isHead;}
      }
    }
    const recoil=w.slot==='melee'?0:w.recoil*(this.aim?.65:1);
    this.emit('shot',{origin,dir,distance,weapon:w.id,recoil});
    // Corpses provide surface feedback only; they never shorten the live shot or receive damage.
    if(typeof this.traceCorpses==='function'&&Number.isFinite(distance)&&distance>0){
      const hits=this.traceCorpses([...origin],[...dir],distance),seen=new Set(),length=Math.hypot(...dir);
      if(Array.isArray(hits)&&length>1e-8)for(const hit of hits){
        const actor=hit&&this.bots.find(b=>b.id===hit.id),point=hit?.position;
        if(!actor?.dead||seen.has(actor.id)||!Number.isFinite(hit.distance)||hit.distance<=0||hit.distance>distance||!Array.isArray(point)||point.length!==3||!point.every(Number.isFinite))continue;
        seen.add(actor.id);
        this.emit('corpseHit',{id:actor.id,team:actor.team,character:actor.character,attacker:this.player.id,attackerTeam:this.player.team,weapon:w.id,position:[...point],direction:dir.map(n=>n/length),melee:w.slot==='melee',corpse:true});
      }
    }
    if(target&&target.team!==this.player.team){this.damage(target,w.damage*(head?2.8:1),this.player,{headshot:head,melee:w.slot==='melee',weapon:w.id,position:origin.map((n,i)=>n+dir[i]*distance),direction:dir});this.emit('hit',{head});target.alert=5;}
    this.player.pitch=Math.min(1.2,this.player.pitch+recoil);return true;
  }
  damage(actor,amount,attacker=null,details={}){
    if(actor.dead||this.phase!=='live'||(attacker&&actor.team===attacker.team))return;const previousHp=actor.hp;actor.hp=Math.max(0,actor.hp-amount);
    const loss=previousHp-actor.hp,point=details.position,direction=details.direction;
    if(actor===this.player&&loss>0)this.backpackLocked=true;
    // Weapon callers provide their confirmed impact; environmental damage has no blood burst.
    if(attacker&&WEAPONS[details.weapon]&&Number.isFinite(amount)&&amount>0&&Number.isFinite(loss)&&loss>0&&Array.isArray(point)&&point.length===3&&point.every(Number.isFinite)&&Array.isArray(direction)&&direction.length===3&&direction.every(Number.isFinite)){
      const length=Math.hypot(...direction);
      if(length>1e-8)this.emit('actorHit',{id:actor.id,team:actor.team,character:actor.character,attacker:attacker.id,attackerTeam:attacker.team,weapon:details.weapon,position:[...point],direction:direction.map(n=>n/length),headshot:!!details.headshot,melee:!!details.melee,damage:loss,fatal:actor.hp===0});
    }
    if(actor===this.player)this.emit('hurt');
    else if(attacker)notifyBotHit(actor,attacker);
    if(attacker)this.teamIntel[actor.team]={x:actor.x,y:actor.y,z:actor.z,expires:this.elapsed+6};
    if(actor.hp===0){
      actor.dead=true;actor.deathTime=this.elapsed;let reward;
      if(attacker===this.player&&actor.team!==attacker.team){this.player.kills++;reward=recordPlayerKill(this.killChain,this.elapsed,{...details,character:attacker.character});}
      if(actor===this.player){this.reloading=0;this.aim=false;this.interact=0;this.killChain={count:0,last:-Infinity};}
      this.emit('kill',{id:actor.id,team:actor.team,character:actor.character,position:[actor.x,actor.y+1.25,actor.z],killer:attacker?.id??null,killerTeam:attacker?.team??null,...(reward?{reward}:{})});this.checkElimination();
    }
  }
  checkElimination(){
    const alive=[this.player,...this.bots].filter(a=>!a.dead);
    const attackAlive=alive.some(a=>a.team==='attack'),defendAlive=alive.some(a=>a.team==='defend');
    if(!defendAlive)this.endRound('attack','防守方已被消灭');
    else if(!attackAlive&&!this.bomb)this.endRound('defend','进攻方已被消灭');
  }
  plant(x,z,site,y=floorAt(x,z,MAP.sites.find(s=>s.id===site)?.y??0)){if(this.bomb||this.phase!=='live')return;this.bomb={x,y:y??0,z,site,time:35};this.interact=0;this.botPlant=0;this.emit('plant',{site});}
  endRound(winner,reason){
    if(this.phase!=='live')return;this.winner=winner;this.reason=reason;this.score[winner]++;this.phase='over';this.phaseTime=3;
    this.reloading=0;this.interact=0;this.emit('roundEnd',{winner,reason});
  }
  setSpectatorMode(mode,view=this.player){
    if(!this.player.dead||this.paused||this.phase==='finished'||!['follow','free'].includes(mode))return;
    if(mode==='free'&&this.spectator.mode!=='free'){
      for(const key of ['x','z','yaw','pitch'])if(Number.isFinite(view[key]))this.spectator[key]=view[key];
      this.spectator.y=Number.isFinite(view.y)?view.y:2;
    }
    this.spectator.mode=mode;
  }
  updateSpectator(dt,input){
    if(!this.player.dead||this.spectator.mode!=='free')return;
    const s=this.spectator,mx=input.x||0,mz=input.z||0,up=input.rise||0,len=Math.max(1,Math.hypot(mx,mz,up)),speed=6*dt/len;
    const edge=MAP.size/2;
    s.x=Math.max(-edge,Math.min(edge,s.x+(Math.cos(s.yaw)*mx-Math.sin(s.yaw)*mz*Math.cos(s.pitch))*speed));
    s.z=Math.max(-edge,Math.min(edge,s.z+(Math.sin(s.yaw)*mx+Math.cos(s.yaw)*mz*Math.cos(s.pitch))*speed));
    s.y=Math.max(MAP.bounds.min[1]+.65,Math.min(MAP.bounds.max[1]+5,s.y+(up-Math.sin(s.pitch)*mz)*speed));
  }
  movePlayer(dt,input){
    const p=this.player;if(p.dead)return;
    const mx=input.x||0,mz=input.z||0,len=Math.max(1,Math.hypot(mx,mz)),speed=(this.slot===2?5.3:4.2)*(this.aim?.6:1);
    moveActor(p,(Math.cos(p.yaw)*mx-Math.sin(p.yaw)*mz)/len*speed*dt,(Math.sin(p.yaw)*mx+Math.cos(p.yaw)*mz)/len*speed*dt);
  }
  update(dt,input={}){
    if(this.paused||this.phase==='finished')return;
    dt=Math.min(Math.max(dt,0),.05);this.elapsed+=dt;
    if(input.jump&&!this.jumpHeld)this.jump();this.jumpHeld=!!input.jump;
    this.updateSpectator(dt,input);
    if(this.phase==='ready'||this.phase==='over'){
      if(this.phase==='over'){const moveTime=Math.min(dt,Math.max(0,this.phaseTime));this.movePlayer(moveTime,input);this.updateVertical(moveTime);}
      this.phaseTime-=dt;if(this.phaseTime<=1e-8){if(this.phase==='ready'){this.phase='live';this.emit('start');}else if(this.score[this.winner]>=3){this.phase='finished';this.emit('matchEnd',{winner:this.winner,reason:this.reason});}else this.beginRound();}return;
    }
    this.updatePlayer(dt,input);
    this.updateWorld(dt);
  }
  updatePlayer(dt,input){
    this.cooldown=Math.max(0,this.cooldown-dt);
    if(this.reloading>0){this.reloading-=dt;if(this.reloading<=0){const a=this.ammo[this.slot],n=Math.min(this.weapon.clip-a.clip,a.reserve);a.clip+=n;a.reserve-=n;this.reloading=0;}}
    const p=this.player;
    if(!p.dead){
      if(!input.interact)this.movePlayer(dt,input);
      this.updateVertical(dt);
      const spawn=MAP.spawn[p.team];if(Math.hypot(p.x-spawn.x,p.z-spawn.z)>3.5||Math.abs(p.y-spawn.y)>.7)this.backpackLocked=true;
      // Preserve taps that begin and end between two animation frames.
      if((input.fire||input.trigger)&&(this.weapon.auto||input.trigger))this.fire();
      const action=this.interaction;
      if(input.interact&&action&&!input.fire&&!this.reloading){this.interact+=dt;if(this.interact>=action.duration){if(action.kind==='plant')this.plant(p.x,p.z,action.site.id);else this.endRound('defend','装置已成功拆除');}}
      else this.interact=0;
    }
  }
  updateWorld(dt){
    if(this.phase!=='live')return;
    this.updateBots(dt);
    if(this.phase!=='live')return;
    if(this.bomb){this.bomb.time-=dt;if(this.bomb.time<=0)this.endRound('attack','装置引爆');}
    else{this.time-=dt;if(this.time<=0)this.endRound('defend','回合时间耗尽');}
    this.checkElimination();
  }
  updateBots(dt){updateBotTeam(this,dt);}
}
