import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {WEAPONS} from '../src/catalog.js';
import {fireOrigin,warehouseNorth} from './map-fixtures.mjs';

const feedback=g=>g.events.filter(e=>e.type==='corpseHit');
const pointAt=(origin,dir,distance)=>origin.map((n,i)=>n+dir[i]*distance);
function aimedGame({friendly=false,liveTarget=false,profile={}}={}){
  const g=new Game({primary:'ak',...profile});g.phase='live';g.events=[];g.random=()=>.5;
  Object.assign(g.player,{...fireOrigin,yaw:0,pitch:0});
  const corpse=friendly?g.aliveAllies[0]:g.aliveEnemies[1],enemy=g.aliveEnemies[0];
  Object.assign(corpse,{x:fireOrigin.x,y:fireOrigin.y,z:fireOrigin.z-2,dead:true,hp:0,deathTime:0});
  Object.assign(enemy,{x:fireOrigin.x+(liveTarget?0:10),y:fireOrigin.y,z:fireOrigin.z-4,hp:100});
  g.bots=[corpse,enemy];return {g,corpse,enemy};
}
function installHit(g,corpse,distance=1.5){
  g.traceCorpses=(origin,dir,maxDistance)=>[{id:corpse.id,team:corpse.team,character:corpse.character,distance,position:pointAt(origin,dir,distance)}];
}

test('a confirmed corpse surface sprays before a live victim without shortening or changing the live shot',()=>{
  const {g,corpse,enemy}=aimedGame({liveTarget:true}),control=aimedGame({liveTarget:true});
  let query;
  g.traceCorpses=(origin,dir,maxDistance)=>{
    query={origin:[...origin],dir:[...dir],maxDistance};
    const hit={id:corpse.id,distance:1.5,position:pointAt(origin,dir,1.5)};
    // The callback receives copies, so a visual query cannot change the actual bullet.
    origin.fill(99);dir.fill(99);return [hit];
  };
  assert.equal(g.fire(),true);assert.equal(control.g.fire(),true);
  const shot=g.events.find(e=>e.type==='shot'),hit=feedback(g)[0];
  assert.deepEqual(shot,control.g.events.find(e=>e.type==='shot'));
  assert.equal(query.maxDistance,shot.distance);assert.ok(query.maxDistance>1.5);
  assert.deepEqual(hit.position,pointAt(query.origin,query.dir,1.5));
  assert.deepEqual(hit.direction,query.dir.map(n=>n/Math.hypot(...query.dir)));
  assert.equal(hit.id,corpse.id);assert.equal(hit.team,corpse.team);assert.equal(hit.character,corpse.character);
  assert.equal(hit.attacker,g.player.id);assert.equal(hit.attackerTeam,g.player.team);assert.equal(hit.weapon,'ak');assert.equal(hit.corpse,true);assert.equal(hit.melee,false);
  for(const key of ['headshot','damage','fatal','reward','killer'])assert.equal(key in hit,false);
  assert.equal(enemy.hp,control.enemy.hp);assert.equal(enemy.hp,100-WEAPONS.ak.damage*2.8);
  assert.equal(g.events.filter(e=>e.type==='actorHit').length,1);assert.equal(g.events.filter(e=>e.type==='hit').length,1);
  assert.deepEqual(g.ammo,control.g.ammo);assert.equal(g.player.pitch,control.g.player.pitch);
});

test('repeat shots on a corpse produce repeat feedback with no damage, kills, rewards or score changes',()=>{
  const {g,corpse,enemy}=aimedGame();installHit(g,corpse);
  g.player.kills=2;g.killChain={count:2,last:4};g.score.attack=1;const baseline={kills:g.player.kills,chain:{...g.killChain},score:{...g.score},enemyHp:enemy.hp};
  for(let i=0;i<8;i++){g.cooldown=0;g.player.pitch=0;assert.equal(g.fire(),true);}
  assert.equal(feedback(g).length,8);assert.equal(corpse.hp,0);assert.equal(corpse.dead,true);assert.equal(corpse.deathTime,0);
  assert.equal(g.player.kills,baseline.kills);assert.deepEqual(g.killChain,baseline.chain);assert.deepEqual(g.score,baseline.score);assert.equal(enemy.hp,baseline.enemyHp);assert.equal(g.phase,'live');
  for(const type of ['actorHit','kill','hit','roundEnd','hurt'])assert.equal(g.events.filter(e=>e.type===type).length,0,type);
  g.damage(corpse,100,g.player,{weapon:'ak',position:[1,1,1],direction:[0,0,-1]});
  assert.equal(feedback(g).length,8);assert.equal(g.events.filter(e=>e.type==='kill').length,0);
});

test('friendly corpses and separate corpses spray once each while duplicate mesh hits are deduplicated',()=>{
  const {g,corpse,enemy}=aimedGame({friendly:true}),other={...corpse,id:99,team:enemy.team,character:'fox'};g.bots.push(other);
  let positions;
  g.traceCorpses=(origin,dir)=>{
    positions=[pointAt(origin,dir,1.2),pointAt(origin,dir,2)];
    return [{id:corpse.id,distance:1.2,position:positions[0]},{id:corpse.id,distance:1.3,position:pointAt(origin,dir,1.3)},{id:other.id,distance:2,position:positions[1]}];
  };
  g.fire();assert.deepEqual(feedback(g).map(e=>e.id),[corpse.id,other.id]);assert.equal(feedback(g)[0].team,g.player.team);
  const stored=feedback(g).map(e=>[...e.position]);positions[0].fill(90);positions[1].fill(90);assert.deepEqual(feedback(g).map(e=>e.position),stored,'events own their impact positions');
  assert.equal(enemy.hp,100);assert.equal(corpse.hp,0);assert.equal(other.hp,0);
});

test('native walls and living friendly blockers cap the query and reject corpse points beyond the shot endpoint',()=>{
  const wall=aimedGame();Object.assign(wall.g.player,{...warehouseNorth,yaw:0,pitch:0});let wallLimit;
  wall.g.traceCorpses=(origin,dir,maxDistance)=>{wallLimit=maxDistance;return [{id:wall.corpse.id,distance:8,position:pointAt(origin,dir,8)}];};
  wall.g.fire();assert.ok(wallLimit<8);assert.equal(feedback(wall.g).length,0);
  const friendly=aimedGame({liveTarget:true}),ally=new Game().aliveAllies[0];Object.assign(ally,{...fireOrigin,z:fireOrigin.z-2});friendly.g.bots.unshift(ally);let friendlyLimit;
  friendly.g.traceCorpses=(origin,dir,maxDistance)=>{friendlyLimit=maxDistance;return [{id:friendly.corpse.id,distance:3,position:pointAt(origin,dir,3)}];};
  friendly.g.fire();assert.ok(friendlyLimit<2);assert.equal(feedback(friendly.g).length,0);assert.equal(ally.hp,100);assert.equal(friendly.enemy.hp,100);
});

test('knife hits support friendly corpse feedback only within the actual melee range',()=>{
  const {g,corpse}=aimedGame({friendly:true,profile:{melee:'knife'}});g.switchWeapon(2);g.cooldown=0;g.events=[];let limit;
  g.traceCorpses=(origin,dir,maxDistance)=>{limit=maxDistance;return [{id:corpse.id,distance:1.2,position:pointAt(origin,dir,1.2)},{id:corpse.id,distance:3,position:pointAt(origin,dir,3)}];};
  g.fire();assert.equal(limit,WEAPONS.knife.range);assert.equal(feedback(g).length,1);assert.equal(feedback(g)[0].weapon,'knife');assert.equal(feedback(g)[0].melee,true);assert.equal(g.ammo[2].clip,1);
  g.cooldown=0;g.traceCorpses=(origin,dir)=>[{id:corpse.id,distance:3,position:pointAt(origin,dir,3)}];g.fire();assert.equal(feedback(g).length,1);
});

test('missing, malformed, nonfinite, living and unknown corpse reports are ignored without breaking fire',()=>{
  const {g,corpse,enemy}=aimedGame();g.traceCorpses=(origin,dir)=>{
    const valid={id:corpse.id,distance:1,position:pointAt(origin,dir,1)};
    return [null,{},...[-1,0,NaN,Infinity].map(distance=>({...valid,distance})),{...valid,position:[NaN,0,0]},{...valid,position:[0,0]},{...valid,position:null},{...valid,id:enemy.id},{...valid,id:800},{...valid,id:g.player.id}];
  };
  assert.equal(g.fire(),true);assert.equal(feedback(g).length,0);
  for(const result of [undefined,null,{},'not-hits']){g.cooldown=0;g.traceCorpses=()=>result;assert.equal(g.fire(),true);assert.equal(feedback(g).length,0);}
  delete g.traceCorpses;g.cooldown=0;assert.equal(g.fire(),true);assert.equal(feedback(g).length,0);
});

test('inactive combat never runs corpse queries or consumes ammunition',()=>{
  for(const state of ['ready','over','finished','paused','dead','cooldown','reload']){
    const {g,corpse}=aimedGame();let calls=0;g.traceCorpses=()=>{calls++;return [{id:corpse.id,distance:1,position:[0,0,0]}];};
    if(state==='paused')g.paused=true;else if(state==='dead')g.player.dead=true;else if(state==='cooldown')g.cooldown=.5;else if(state==='reload')g.reloading=.5;else g.phase=state;
    const ammo=g.ammo[0].clip;assert.equal(g.fire(),false,state);assert.equal(calls,0,state);assert.equal(feedback(g).length,0,state);assert.equal(g.ammo[0].clip,ammo,state);
  }
});

test('a round reset rejects stale corpse ids that now refer to living actors',()=>{
  const {g,corpse}=aimedGame();const oldId=corpse.id;installHit(g,corpse);g.fire();assert.equal(feedback(g).length,1);
  g.beginRound();g.phase='live';g.events=[];Object.assign(g.player,{...fireOrigin,yaw:0,pitch:0});for(const bot of g.bots)bot.x=fireOrigin.x+10;
  assert.equal(g.bots.find(b=>b.id===oldId).dead,false);g.fire();assert.equal(feedback(g).length,0);assert.equal(g.events.filter(e=>e.type==='kill').length,0);
});

test('the optional corpse query preserves original random draws, ammo, recoil and shot endpoints',()=>{
  const withFeedback=aimedGame(),control=aimedGame();delete withFeedback.g.random;delete control.g.random;installHit(withFeedback.g,withFeedback.corpse);
  withFeedback.g.fire();control.g.fire();assert.equal(withFeedback.g.seed,control.g.seed);
  assert.deepEqual(withFeedback.g.events.find(e=>e.type==='shot'),control.g.events.find(e=>e.type==='shot'));
  assert.deepEqual(withFeedback.g.ammo,control.g.ammo);assert.equal(withFeedback.g.player.pitch,control.g.player.pitch);assert.equal(withFeedback.g.cooldown,control.g.cooldown);
});
