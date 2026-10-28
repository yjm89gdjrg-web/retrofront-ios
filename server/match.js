import {Game} from '../src/game.js';
import {WEAPONS,sanitizeProfile} from '../src/catalog.js';

// The existing simulation remains the authority. Each human owns only these
// per-player fields; round timers, actors, damage and objectives are shared.
const PRIVATE=['profile','weapons','slot','aim','cooldown','reloading','ammo','interact','backpackLocked','activeBackpack','killChain','jumpHeld','spectator'];
const ACTOR=['id','team','character','weapon','x','y','z','vy','grounded','hp','yaw','pitch','dead','kills','deathTime','human','name'];
const WORLD=['round','phase','phaseTime','time','bomb','winner','reason','elapsed','score'];
const pick=(value,keys)=>Object.fromEntries(keys.map(k=>[k,value[k]]));
const localEvents=new Set(['shot','switch','reload','hit','hurt','backpack','notice']);

export class RoomMatch extends Game {
  constructor(members,difficulty,seed=Date.now()>>>0){
    super({...members[0].profile,side:members[0].side,difficulty},seed);
    this.members=members;this.difficulty=difficulty;this.humans=new Map();this.initializeHumans();
  }
  emit(type,data={}){super.emit(type,{...data,...(localEvents.has(type)?{viewer:this.player?.id}:{} )});}
  beginRound(){if(this.members?.length)this.profile=sanitizeProfile({...this.members[0].profile,side:this.members[0].side,difficulty:this.difficulty});super.beginRound();if(this.members)this.initializeHumans();}
  initializeHumans(){
    this.humans.clear();const actors=[this.player,...this.bots];
    for(const [index,member] of this.members.entries()){
      const actor=index===0?this.player:actors.find(a=>!a.human&&a.team===member.side);
      const profile=sanitizeProfile({...member.profile,side:member.side,difficulty:this.difficulty});
      Object.assign(actor,{human:true,name:member.name,character:profile.character,weapon:profile.primary,vy:0,grounded:true,pitch:0,kills:0});
      const weapons=[profile.primary,profile.secondary,profile.melee];
      this.humans.set(member.key,{id:actor.id,state:{profile,weapons,slot:0,aim:false,cooldown:0,reloading:0,ammo:weapons.map(id=>({clip:WEAPONS[id].clip,reserve:WEAPONS[id].reserve})),interact:0,backpackLocked:false,activeBackpack:profile.activeBackpack,killChain:{count:0,last:-Infinity},jumpHeld:false,spectator:{mode:'follow',x:actor.x,y:actor.y+2,z:actor.z,yaw:actor.yaw,pitch:0}},input:{},commands:[]});
    }
    Object.assign(this,this.humans.values().next().value.state);
  }
  withHuman(human,fn){
    const player=this.player,bots=this.bots,previous=pick(this,PRIVATE);
    const actor=[player,...bots].find(a=>a.id===human.id);
    this.player=actor;this.bots=[player,...bots].filter(a=>a!==actor);Object.assign(this,human.state);
    try{return fn();}finally{human.state=pick(this,PRIVATE);this.player=player;this.bots=bots;Object.assign(this,previous);}
  }
  damage(actor,amount,attacker,details){
    const wasDead=actor.dead,hp=actor.hp;super.damage(actor,amount,attacker,details);
    if(actor.human&&actor!==this.player&&actor.hp<hp)this.events.push({type:'hurt',viewer:actor.id});
    if(actor.human&&!wasDead&&actor.dead){
      const human=[...this.humans.values()].find(h=>h.id===actor.id);
      if(human)Object.assign(human.state,{reloading:0,aim:false,interact:0,killChain:{count:0,last:-Infinity},backpackLocked:true});
    }
  }
  inputFor(key,input,now){
    const human=this.humans.get(key);if(!human||!input||typeof input!=='object')return;
    const number=(n,min,max)=>Number.isFinite(n)?Math.max(min,Math.min(max,n)):0;
    human.input={x:number(input.x,-1,1),z:number(input.z,-1,1),yaw:number(input.yaw,-1e6,1e6),pitch:number(input.pitch,-1.25,1.25),aim:input.aim===true,fire:input.fire===true,trigger:human.input.trigger||input.trigger===true,interact:input.interact===true};human.lastInput=now;
  }
  command(key,action,value){const h=this.humans.get(key);if(h&&h.commands.length<8&&['jump','reload','switch','backpack'].includes(action))h.commands.push({action,value});}
  endRound(winner,reason){
    const wasLive=this.phase==='live';super.endRound(winner,reason);
    if(wasLive)for(const human of this.humans?.values()??[]){human.state.reloading=0;human.state.interact=0;}
  }
  update(dt,now=performance.now()){
    if(this.phase==='finished')return;dt=Math.max(0,Math.min(.05,dt));this.elapsed+=dt;
    const phase=this.phase;
    for(const human of this.humans.values())this.withHuman(human,()=>{
      const fresh=now-(human.lastInput??-Infinity)<350,input=fresh?human.input:{};
      if(fresh){this.player.yaw=input.yaw;this.player.pitch=input.pitch;this.aim=input.aim&&!this.player.dead&&this.slot!==2;}
      for(const {action,value} of human.commands.splice(0)){
        if(action==='jump')this.jump();if(action==='reload')this.reload();
        if(action==='switch')this.switchWeapon(value);
        if(action==='backpack'){
          if(this.selectBackpack(value)){const member=this.members.find(m=>this.humans.get(m.key)===human);if(member)member.profile=this.profile;}
          else this.emit('notice',{message:'当前无法换包，请在下回合出生区更换'});
        }
      }
      if(this.phase==='live')this.updatePlayer(dt,input);
      else if(this.phase==='over'){this.movePlayer(Math.min(dt,Math.max(0,this.phaseTime)),input);this.updateVertical(dt);}
      human.input.trigger=false;
    });
    const hostState=[...this.humans.values()].find(h=>h.id===this.player.id)?.state;
    if(hostState)Object.assign(this,hostState);
    // A lethal shot may have changed the phase during the player updates.
    if(phase!==this.phase)return;
    if(phase==='ready'||phase==='over'){
      this.phaseTime-=dt;if(this.phaseTime<=1e-8){
        if(phase==='ready'){this.phase='live';this.emit('start');}
        else if(this.score[this.winner]>=3){this.phase='finished';this.emit('matchEnd',{winner:this.winner,reason:this.reason});}
        else this.beginRound();
      }
    }else this.updateWorld(dt);
  }
  snapshot(key,events=[]){
    const human=this.humans.get(key);if(!human)return null;
    const id=n=>n===human.id?0:n===0?human.id:n;
    const actors=[this.player,...this.bots].map(a=>({...pick(a,ACTOR),id:id(a.id)}));
    const visible=[];
    for(const source of events){
      let e={...source};
      if(e.viewer!==undefined&&e.viewer!==human.id){
        if(e.type!=='shot')continue;
        e={type:'botShot',id:e.viewer,origin:e.origin,to:e.origin.map((n,i)=>n+e.dir[i]*e.distance),weapon:e.weapon};
      }
      delete e.viewer;for(const key of ['id','killer','attacker','target'])if(Number.isInteger(e[key]))e[key]=id(e[key]);
      if(e.type==='round')e.weapon=human.state.weapons[human.state.slot];
      visible.push(e);
    }
    const state=pick(human.state,PRIVATE.filter(k=>!['spectator','killChain','jumpHeld'].includes(k)));
    return {...pick(this,WORLD),...state,player:actors.find(a=>a.id===0),bots:actors.filter(a=>a.id!==0),events:visible};
  }
}
