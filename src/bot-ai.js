import { MAP, clearLine, walkLine, planRoute, projectWalkable, floorAt, raySphere } from './map.js';
import {BotTraffic} from './bot-traffic.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const angle=(a,b)=>Math.atan2(b.x-a.x,-(b.z-a.z));
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const position=a=>({x:a.x,y:a.y,z:a.z});
const sameFloor=(a,b)=>Math.abs((a.y??0)-(b.y??0))<1.8;
const BODY_GAP=.84,STANDING_GAP=1.05;
const TUNING={easy:{damage:9,interval:1.05,accuracy:.40,speed:3.8,reaction:.48},normal:{damage:12,interval:.72,accuracy:.57,speed:4.2,reaction:.32},hard:{damage:17,interval:.5,accuracy:.72,speed:4.8,reaction:.22}};
const trafficByGame=new WeakMap();

function brain(bot){
  return bot.ai??= {state:'spawn',reason:'round start',clock:0,scan:0,targetId:null,reaction:0,memory:null,goal:null,key:null,arrived:false,repath:0,plans:0,recoveries:0,progressTime:0,progress:position(bot),history:[]};
}
function transition(bot,state,reason){
  const ai=brain(bot);if(ai.state===state)return;
  ai.state=state;ai.reason=reason;ai.history.push({time:ai.clock,state,reason});if(ai.history.length>12)ai.history.shift();
}
export function notifyBotHit(bot,attacker){
  const ai=brain(bot);ai.memory={...position(attacker),expires:ai.clock+4};ai.scan=0;
}
function perceive(game,bot,dt,tuning){
  const ai=brain(bot);ai.clock+=dt;ai.scan-=dt;ai.reaction=Math.max(0,ai.reaction-dt);
  if(ai.scan<=0){
    ai.scan=.16+(bot.id%3)*.02;
    const visible=[game.player,...game.bots].filter(a=>!a.dead&&a.team!==bot.team&&distance(bot,a)<26&&
      (distance(bot,a)<4.5||Math.abs(wrap(angle(bot,a)-bot.yaw))<Math.PI*.52)&&clearLine(bot,a));
    visible.sort((a,b)=>distance(bot,a)-distance(bot,b));
    const previous=visible.find(a=>a.id===ai.targetId),enemy=previous&&distance(bot,previous)<distance(bot,visible[0])*1.4?previous:visible[0];
    if(enemy?.id!==ai.targetId){ai.targetId=enemy?.id??null;ai.reaction=tuning.reaction;}
  }
  const enemy=[game.player,...game.bots].find(a=>a.id===ai.targetId&&!a.dead&&a.team!==bot.team);
  // Never keep tracking an actor through cover between perception updates.
  if(enemy&&distance(bot,enemy)<26&&clearLine(bot,enemy)){
    ai.lastContact=ai.clock;ai.memory={...position(enemy),expires:ai.clock+4};bot.lastKnown=position(enemy);bot.alert=4;return enemy;
  }
  bot.alert=Math.max(0,(ai.memory?.expires??0)-ai.clock);if(!bot.alert)ai.memory=null;return null;
}
// Pick an open cover position in the same local corridor.
function nearbySlot(center,dx,dz){
  const yaw=Math.atan2(dz,dx),radius=Math.hypot(dx,dz);
  for(const scale of [1,.65,.35])for(const offset of [0,.5,-.5,1,-1,Math.PI]){
    const p=projectWalkable({x:center.x+Math.cos(yaw+offset)*radius*scale,y:center.y,z:center.z+Math.sin(yaw+offset)*radius*scale});
    if(!p)continue;
    if(walkLine(center,p,.45))return p;
  }
  return projectWalkable(center);
}
function guardSlot(bot,center){
  const site=MAP.sites.find(s=>s===center||s.id===center.site),points=site?.guardPoints;
  return points?.length?points[(bot.formationIndex??bot.id)%points.length]:nearbySlot(center,(bot.id%2?1:-1)*(2+bot.id%3*.65),2.3+bot.id%3*.45);
}
function friendInLine(game,bot,enemy){
  const dx=enemy.x-bot.x,dz=enemy.z-bot.z,length=dx*dx+dz*dz;
  return [game.player,...game.bots].some(a=>{
    if(a===bot||a.dead||a.team!==bot.team||!length||!sameFloor(a,bot))return false;
    const t=((a.x-bot.x)*dx+(a.z-bot.z)*dz)/length;
    return t>0&&t<1&&Math.hypot(a.x-bot.x-t*dx,a.z-bot.z-t*dz)<.55;
  });
}
function turn(bot,target,dt){const delta=wrap(angle(bot,target)-bot.yaw);bot.yaw=wrap(bot.yaw+Math.max(-5*dt,Math.min(5*dt,delta)));}
function stop(bot){bot.path=[];const ai=brain(bot);ai.key=null;ai.goal=null;ai.arrived=false;ai.progressTime=0;ai.progress=position(bot);}

function actors(game){return [game.player,...game.bots].filter(a=>!a.dead);}
function canStep(bot,next,others){
  if(!walkLine(bot,next,.38))return false;
  const dx=next.x-bot.x,dz=next.z-bot.z,length=dx*dx+dz*dz;
  if(length<1e-12)return false;
  return others.every(other=>{
    if(other===bot||!sameFloor(other,bot))return true;
    const before=distance(bot,other),t=Math.max(0,Math.min(1,((other.x-bot.x)*dx+(other.z-bot.z)*dz)/length));
    const closest=Math.hypot(bot.x+dx*t-other.x,bot.z+dz*t-other.z);
    // Existing overlap may escape, but no move may deepen it or cross a body.
    return closest+1e-6>=Math.min(BODY_GAP,before);
  });
}
function stepBot(game,bot,dx,dz){
  if(bot.fallTarget!==undefined)return false;
  const x=bot.x+dx,z=bot.z+dz,y=floorAt(x,z,bot.y,.46,1,.4),next={x,y,z};if(y===null)return false;
  if(!canStep(bot,next,actors(game)))return false;
  // The complete segment has already passed wall and body sweeps.
  const oldY=bot.y;Object.assign(bot,next);if(oldY-y>.46){bot.y=oldY;bot.fallTarget=y;bot.fallVelocity=0;}return true;
}
function separateStandingBots(game,dt){
  const all=actors(game),budget=new Map(game.aliveBots.map(b=>[b.id,1.8*dt]));
  const movable=a=>a!==game.player&&!a.human&&a.fallTarget===undefined&&!['plant','defuse'].includes(a.ai?.state);
  const nudge=(bot,other,nx,nz,amount)=>{
    const step=Math.min(amount,budget.get(bot.id)??0);if(step<=1e-6)return;
    // Try the outward direction first, then slide along nearby walls.
    for(const turn of [0,Math.PI/4,-Math.PI/4,Math.PI/2,-Math.PI/2,Math.PI*.75,-Math.PI*.75,Math.PI]){
      const dx=(nx*Math.cos(turn)-nz*Math.sin(turn))*step,dz=(nx*Math.sin(turn)+nz*Math.cos(turn))*step;
      const next=projectWalkable({x:bot.x+dx,y:bot.y,z:bot.z+dz});if(!next)continue;
      if(distance(bot,next)>step+1e-6)continue;
      if(distance(next,other)<=distance(bot,other)+1e-6||!canStep(bot,next,all))continue;
      Object.assign(bot,next);budget.set(bot.id,budget.get(bot.id)-step);return;
    }
  };
  for(let pass=0;pass<2;pass++)for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){
    const a=all[i],b=all[j],gap=distance(a,b);if(!sameFloor(a,b)||gap>=STANDING_GAP||(!movable(a)&&!movable(b)))continue;
    // Actor IDs give coincident bodies a stable, opposing escape direction.
    const fallback=((Math.min(a.id,b.id)*7+Math.max(a.id,b.id)*11)%8)*Math.PI/4;
    const sign=a.id<b.id?1:-1,nx=gap>1e-5?(a.x-b.x)/gap:Math.cos(fallback)*sign,nz=gap>1e-5?(a.z-b.z)/gap:Math.sin(fallback)*sign;
    const amount=STANDING_GAP-gap;
    if(movable(a))nudge(a,b,nx,nz,amount/(movable(b)?2:1));
    if(movable(b))nudge(b,a,-nx,-nz,STANDING_GAP-distance(a,b));
  }
}

function navigate(game,bot,goal,key,radius,dt,speed,aiming){
  const ai=brain(bot);ai.repath=Math.max(0,ai.repath-dt);
  const changed=ai.key!==key,moved=!ai.request||distance(ai.request,goal)>1.1;
  if(changed||moved){ai.arrived=false;ai.goal=null;}
  const endpoint=ai.goal??goal;
  if(distance(bot,endpoint)<radius+(ai.arrived?.65:0)&&Math.abs(bot.y-(endpoint.y??bot.y))<.7){
    trafficByGame.get(game)?.release(bot.id);ai.traffic=null;
    ai.arrived=true;bot.path=[];ai.key=key;if(changed||moved)ai.request=position(goal);ai.progressTime=0;ai.progress=position(bot);return;
  }
  ai.arrived=false;
  if(changed||((moved||!bot.path.length||!walkLine(bot,bot.path[0],.38))&&ai.repath<=0)){
    // Rebuild only after a task change or when cover blocks the current route.
    if(!changed&&moved&&walkLine(bot,goal,.38)){bot.path=[position(goal)];ai.goal=position(goal);}
    else{const route=planRoute(bot,goal);bot.path=route.points;ai.goal=route.goal;ai.plans++;}
    ai.request=position(goal);ai.key=key;ai.repath=.4;
  }
  // Look ahead along the corridor instead of turning at every grid cell.
  while(bot.path.length>1&&walkLine(bot,bot.path[1],.4))bot.path.shift();
  // A close corner is still mandatory when skipping it would step off a ledge.
  while(bot.path.length&&distance(bot,bot.path[0])<.12&&
    (bot.path.length===1||walkLine(bot,bot.path[1],.4)))bot.path.shift();
  let point=bot.path[0];if(!point){trafficByGame.get(game)?.release(bot.id);ai.traffic=null;return;}
  if(ai.recoveryUntil>ai.clock)point=ai.recovery;
  const advice=trafficByGame.get(game)?.decide(bot,point)??{mode:'clear',speed:1};
  const wasYielding=ai.traffic?.mode==='yield';
  ai.traffic={mode:advice.mode,other:advice.other??null};
  if(wasYielding&&advice.mode!=='yield'){
    // A side pocket is off the original center route. Ask the real planner for
    // a safe re-entry corner instead of steering diagonally through a doorpost.
    bot.path=[];ai.key=null;ai.goal=null;ai.repath=0;ai.progressTime=0;ai.progress=position(bot);return;
  }
  if(advice.mode==='yield'&&!wasYielding)ai.yields=(ai.yields??0)+1;
  if(advice.mode==='yield'||advice.mode==='queue'){
    ai.trafficWait=(ai.trafficWait??0)+dt;
    ai.progressTime=0;ai.progress=position(bot);
    if(advice.mode==='yield'){
      // Deliberate yielding is separate from the route/assignment and does not
      // count as a stuck path. A bounded lease re-enables normal recovery.
      if(!advice.target)return;
      point=advice.target;
    }
    speed*=advice.speed;
    if(speed<.01)return;
  }
  const d=distance(bot,point);if(d<.01)return;
  let vx=(point.x-bot.x)/d,vz=(point.z-bot.z)/d;
  // Anticipate nearby bodies before the hard sweep and final standing separation.
  for(const other of [game.player,...game.bots]){
    if(other===bot||other.dead||!sameFloor(other,bot))continue;const gap=distance(bot,other);if(gap>=1||gap<.01)continue;
    const strength=(1-gap)*.7;vx+=(bot.x-other.x)/gap*strength;vz+=(bot.z-other.z)/gap*strength;
  }
  const length=Math.hypot(vx,vz),step=Math.min(speed*dt,d);
  const next={x:bot.x+vx/length*step,z:bot.z+vz/length*step};
  if(!stepBot(game,bot,next.x-bot.x,next.z-bot.z)){
    if(!stepBot(game,bot,(point.x-bot.x)/d*step,(point.z-bot.z)/d*step)){
      if(advice.mode==='yield'||advice.mode==='queue')return;
      const side=bot.id%2?1:-1;
      for(const sign of [side,-side])if(stepBot(game,bot,-vz/length*step*sign,vx/length*step*sign))break;
    }
  }
  if(!aiming)turn(bot,point,dt);
  ai.progressTime+=dt;
  if(ai.progressTime>=.9){
    if(distance(bot,ai.progress)<.18){
      ai.recoveries++;bot.path=[];ai.repath=0;
      const side=bot.id%2?1:-1;
      for(const sign of [side,-side]){const p=projectWalkable({x:bot.x-vz*sign*.65,y:bot.y,z:bot.z+vx*sign*.65});if(!p)continue;if(walkLine(bot,p,.4)){ai.recovery=p;ai.recoveryUntil=ai.clock+.6;break;}}
    }
    ai.progressTime=0;ai.progress=position(bot);
  }
}

export function updateBotTeam(game,dt){
  let traffic=trafficByGame.get(game);if(!traffic){traffic=new BotTraffic({walkLine,projectWalkable});trafficByGame.set(game,traffic);}
  traffic.begin(actors(game),game.elapsed,game.round);
  const tuning=TUNING[game.profile.difficulty],alive=game.aliveBots.filter(b=>!b.human);
  for(const bot of alive)if(bot.fallTarget!==undefined){bot.fallVelocity-=20.5*dt;bot.y=Math.max(bot.fallTarget,bot.y+bot.fallVelocity*dt);if(bot.y<=bot.fallTarget+.001){bot.y=bot.fallTarget;delete bot.fallTarget;delete bot.fallVelocity;}}
  const carrier=game.player.team==='attack'&&!game.player.dead?game.player:alive.find(b=>b.team==='attack');
  if(carrier?.id!==game.planterId){game.botPlant=0;game.planterId=carrier?.id??null;}
  let defuser=game.bomb?alive.find(b=>b.id===game.defuserId&&b.team==='defend'):null;
  if(game.bomb&&!defuser){
    const candidates=alive.filter(b=>b.team==='defend').map(bot=>({bot,length:planRoute(bot,game.bomb).length})).sort((a,b)=>a.length-b.length);
    defuser=candidates.find(c=>Number.isFinite(c.length))?.bot;
  }
  if(defuser?.id!==game.defuserId){game.botDefuse=0;game.defuserId=defuser?.id??null;}
  let planting=false,defusing=false;const shooters=[];
  for(const bot of alive){
    if(bot.dead||game.phase!=='live')continue;
    const ai=brain(bot),enemy=perceive(game,bot,dt,tuning);bot.cooldown-=dt;
    if(enemy)game.teamIntel[bot.team]={...position(enemy),expires:game.elapsed+6};
    // Plans are assigned once per round; moving the human never moves these goals.
    const index=bot.formationIndex??bot.id;
    if(!ai.assignment){
      const main=(game.seed+game.round)%2;
      const assigned=bot.team==='defend'?(index<3?0:1):(index<3?main:1-main);
      bot.site=assigned;const lane=assigned===1?MAP.lanes.bCave:(index%2?MAP.lanes.aShort:MAP.lanes.aLong);
      ai.assignment={site:assigned,lane,stage:0,role:bot.team==='defend'?'anchor':index%2?'support':'entry'};
    }
    const site=MAP.sites[bot.site],home=site;
    let state,reason,goal,radius=.65,interaction=null,watch;
    if(bot.team==='defend'){
      if(game.bomb){
        if(bot===defuser){state='retake';reason='assigned shortest route to bomb';goal=game.bomb;radius=1.4;
          if(distance(bot,game.bomb)<1.6&&Math.abs(bot.y-game.bomb.y)<.7){state='defuse';reason='at bomb';interaction='defuse';}
        }else{state='cover-defuser';reason='another defender handles bomb';goal=guardSlot(bot,game.bomb);}
        watch=MAP.sites.find(s=>s.id===game.bomb.site)?.watch??MAP.spawn.attack;
      }else{
        state='guard';reason='hold assigned site';goal=guardSlot(bot,home);watch=home.watch;
        const intel=game.teamIntel?.[bot.team];
        if(intel&&intel.expires>game.elapsed&&index%2===1){
          const threatened=MAP.sites.find(s=>distance(s,intel)<12);
          if(threatened&&threatened!==home){state='rotate';reason='teammate reported site pressure';goal=guardSlot(bot,threatened);watch=intel;}
        }
      }
    }else if(game.bomb){state='guard-bomb';reason='protect planted bomb';goal=guardSlot(bot,game.bomb);watch=MAP.spawn.defend;}
    else{
      const route=ai.assignment;
      if(distance(bot,site)<site.r+1&&Math.abs(bot.y-site.y)<.7)route.stage=1;
      if(route.stage===0&&distance(bot,route.lane)<2&&Math.abs(bot.y-route.lane.y)<.7)route.stage=1;
      if(route.stage===0){state='advance';reason='take assigned attack lane';goal=route.lane;radius=1.1;}
      else if(bot===carrier){state='advance';reason='carry bomb to assigned site';goal=site;radius=1.6;
        if(distance(bot,site)<2.4&&Math.abs(bot.y-site.y)<.7){state='plant';reason='inside planting zone';interaction='plant';}
      }else{state='take-site';reason='clear and hold assigned bomb site';goal=guardSlot(bot,site);watch=site.watch;}
    }

    const urgent=game.bomb&&bot===defuser&&game.bomb.time<7;
    // Objective tasks survive distant contact; nearby threats can interrupt interaction.
    const fight=enemy&&!urgent&&(interaction?distance(bot,enemy)<8:!(game.bomb&&bot===defuser&&distance(bot,enemy)>8));
    let aim=enemy??(ai.memory&&bot.alert>0?ai.memory:null);
    if(fight){
      state='engage';reason='visible opponent';interaction=null;
      const canChase=bot.team==='attack'&&!game.bomb&&distance(enemy,site)<18;
      if(distance(bot,enemy)>13&&canChase)goal=position(enemy);
      else goal=null;
      if(friendInLine(game,bot,enemy)){
        if(!ai.flank||ai.clock>ai.flankUntil){
          const dx=enemy.x-bot.x,dz=enemy.z-bot.z,d=Math.max(.01,distance(bot,enemy)),side=bot.id%2?1:-1;
          ai.flank=nearbySlot(bot,dz/d*side*1.5,-dx/d*side*1.5);ai.flankUntil=ai.clock+1.2;
        }
        goal=ai.flank;reason='clear teammate firing lane';radius=.3;
      }
    }else if(!enemy&&ai.memory&&ai.state==='engage'&&ai.clock-ai.lastContact<.8&&!urgent){
      // Brief occlusion at a corner must not reverse the current movement every frame.
      state='engage';reason='hold last contact briefly';interaction=null;goal=ai.flankUntil>ai.clock?ai.flank:null;radius=.3;
    }else if(!enemy&&ai.memory&&!game.bomb&&bot.team==='defend'&&distance(ai.memory,home)<10){
      state='investigate';reason='last seen position within site';goal=ai.memory;radius=1;
    }
    transition(bot,state,reason);
    if(interaction){
      traffic.release(bot.id);ai.traffic=null;
      stop(bot);
      if(interaction==='plant'){planting=true;game.botPlant+=dt;if(game.botPlant>=3)game.plant(bot.x,bot.z,site.id);}
      else{defusing=true;game.botDefuse+=dt;if(game.botDefuse>=5)game.endRound('defend','电脑守卫拆除了装置');}
    }else{
      if(goal)navigate(game,bot,goal,state,radius,dt,tuning.speed,!!aim);else{traffic.release(bot.id);ai.traffic=null;stop(bot);}
      if(enemy)shooters.push({bot,enemy});
    }
    if(aim)turn(bot,aim,dt);else if(ai.arrived&&watch)turn(bot,watch,dt);
  }
  if(game.phase==='live'){
    separateStandingBots(game,dt);
    for(const {bot,enemy} of shooters){
      if(game.phase!=='live')break;
      if(bot.dead||enemy.dead||bot.ai.reaction>0||bot.cooldown>0||!clearLine(bot,enemy)||Math.abs(wrap(angle(bot,enemy)-bot.yaw))>=.18||friendInLine(game,bot,enemy))continue;
      if(actors(game).some(a=>a!==bot&&a.team===bot.team&&sameFloor(a,bot)&&distance(a,bot)<BODY_GAP-1e-5))continue;
      bot.cooldown=tuning.interval+game.random()*.4;
      const origin=[bot.x,bot.y+1.35,bot.z],to=[enemy.x,enemy.y+1.2,enemy.z];
      game.emit('botShot',{id:bot.id,target:enemy.id,origin,to,team:bot.team,character:bot.character,weapon:bot.weapon});
      if(game.random()<tuning.accuracy*Math.min(1,12/Math.max(1,distance(bot,enemy)))){
        const delta=to.map((n,i)=>n-origin[i]),length=Math.hypot(...delta),direction=delta.map(n=>n/length);
        const hit=raySphere(origin,direction,[enemy.x,enemy.y+1.1,enemy.z],.43);
        game.damage(enemy,tuning.damage,bot,{weapon:bot.weapon,position:origin.map((n,i)=>n+direction[i]*hit),direction});
      }
    }
  }
  if(!planting)game.botPlant=0;if(!defusing)game.botDefuse=0;
}
