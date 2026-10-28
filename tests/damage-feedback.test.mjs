import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {WEAPONS} from '../src/catalog.js';
import {fireOrigin,warehouseNorth,warehouseSouth} from './map-fixtures.mjs';

const blood=g=>g.events.filter(e=>e.type==='actorHit');
function aimedGame(profile={}){
  const g=new Game({primary:'ak',...profile});g.phase='live';g.events=[];g.random=()=>.5;
  Object.assign(g.player,{...fireOrigin,yaw:0,pitch:0});
  const victim=g.aliveEnemies[0];Object.assign(victim,{x:fireOrigin.x,y:fireOrigin.y,z:fireOrigin.z-4,hp:100});g.bots=[victim];
  return {g,victim};
}
function near(actual,expected,epsilon=1e-8){assert.equal(actual.length,expected.length);for(let i=0;i<actual.length;i++)assert.ok(Math.abs(actual[i]-expected[i])<epsilon,`${actual} != ${expected}`);}
function firstBotShot(g){for(let i=0;i<60&&!g.events.some(e=>e.type==='botShot');i++)g.updateBots(.02);return g.events.find(e=>e.type==='botShot');}
const weaponDetails={weapon:'ak',position:[1,1.1,2],direction:[0,0,-1]};

test('confirmed head hits report the exact entering surface, incoming direction and actual damage',()=>{
  const {g,victim}=aimedGame();g.fire();const shot=g.events.find(e=>e.type==='shot'),hit=blood(g)[0];
  assert.equal(blood(g).length,1);assert.equal(hit.id,victim.id);assert.equal(hit.attacker,g.player.id);assert.equal(hit.character,victim.character);assert.equal(hit.team,victim.team);assert.equal(hit.weapon,'ak');
  const headEntry=4-Math.sqrt(.26**2-.05**2);
  near(hit.position,[fireOrigin.x,fireOrigin.y+1.6,fireOrigin.z-headEntry]);
  near(hit.position,shot.origin.map((v,i)=>v+shot.dir[i]*shot.distance));near(hit.direction,[0,0,-1]);
  assert.equal(hit.headshot,true);assert.equal(hit.melee,false);assert.equal(hit.damage,WEAPONS.ak.damage*2.8);assert.equal(hit.fatal,false);
  assert.ok(g.events.indexOf(hit)<g.events.findIndex(e=>e.type==='hit'));
  const recorded=[...hit.position];victim.x+=4;assert.deepEqual(hit.position,recorded,'effect stays at the confirmed impact after victim movement');
});

test('body hits preserve ordinary damage and melee hits identify their close impact',()=>{
  const {g,victim}=aimedGame();g.player.pitch=Math.atan2(-.55,4);g.fire();const hit=blood(g)[0];
  assert.equal(hit.headshot,false);assert.equal(hit.damage,WEAPONS.ak.damage);assert.equal(victim.hp,100-WEAPONS.ak.damage);
  const center=[victim.x,victim.y+1.1,victim.z];assert.ok(Math.abs(Math.hypot(...hit.position.map((v,i)=>v-center[i]))-.43)<1e-8);
  const close=aimedGame({melee:'knife'});close.victim.z=close.g.player.z-1.5;close.g.switchWeapon(2);close.g.cooldown=0;close.g.events=[];close.g.fire();
  const melee=blood(close.g)[0];assert.equal(melee.weapon,'knife');assert.equal(melee.melee,true);assert.equal(melee.fatal,true);assert.equal(melee.damage,100);
});

test('fatal weapon impact precedes death and round end, and direct corpse damage remains ignored',()=>{
  const {g,victim}=aimedGame();victim.hp=1;g.fire();
  assert.equal(blood(g).length,1);assert.equal(blood(g)[0].damage,1);assert.equal(blood(g)[0].fatal,true);assert.equal(g.phase,'over');
  assert.ok(g.events.findIndex(e=>e.type==='actorHit')<g.events.findIndex(e=>e.type==='kill'));
  assert.ok(g.events.findIndex(e=>e.type==='kill')<g.events.findIndex(e=>e.type==='roundEnd'));
  g.phase='live';g.damage(victim,100,g.player,weaponDetails);assert.equal(blood(g).length,1);
});

test('friendly blockers, a wall, a missed aim and inactive combat never emit actorHit',()=>{
  const friendly=aimedGame(),ally=new Game().aliveAllies[0];Object.assign(ally,{x:fireOrigin.x,y:fireOrigin.y,z:fireOrigin.z-2});friendly.g.bots.unshift(ally);friendly.g.fire();
  assert.equal(ally.hp,100);assert.equal(friendly.victim.hp,100);assert.equal(blood(friendly.g).length,0);
  const wall=aimedGame();Object.assign(wall.g.player,{...warehouseNorth,yaw:0,pitch:0});Object.assign(wall.victim,warehouseSouth);wall.g.fire();assert.equal(wall.victim.hp,100);assert.equal(blood(wall.g).length,0);
  const miss=aimedGame();miss.g.player.yaw=Math.PI/2;miss.g.fire();assert.equal(miss.victim.hp,100);assert.equal(blood(miss.g).length,0);
  for(const state of ['ready','over','paused','dead']){
    const {g,victim}=aimedGame();if(state==='paused')g.paused=true;else if(state==='dead')g.player.dead=true;else g.phase=state;
    assert.equal(g.fire(),false);assert.equal(victim.hp,100);assert.equal(blood(g).length,0);
  }
});

test('environmental, unconfirmed, nonpositive and malformed impacts do not create blood events',()=>{
  for(const [amount,attacker,details]of [[10,null,weaponDetails],[10,'player',{}],[0,'player',weaponDetails],[-1,'player',weaponDetails],[10,'player',{...weaponDetails,position:[NaN,0,0]}],[10,'player',{...weaponDetails,direction:[0,0,0]}],[10,'player',{...weaponDetails,weapon:'explosion'}]]){
    const {g,victim}=aimedGame();g.damage(victim,amount,attacker==='player'?g.player:attacker,details);assert.equal(blood(g).length,0);
  }
  const {g,victim}=aimedGame();g.phase='ready';g.damage(victim,10,g.player,weaponDetails);assert.equal(victim.hp,100);assert.equal(blood(g).length,0);
});

test('bot-on-bot confirmed hits emit surface impacts while probabilistic misses emit only a shot',()=>{
  for(const accuracyRoll of [0,.99]){
    const g=new Game({difficulty:'hard'});g.phase='live';Object.assign(g.player,fireOrigin);
    const ally=g.aliveAllies[0],enemy=g.aliveEnemies[0];Object.assign(ally,{x:fireOrigin.x,y:fireOrigin.y,z:fireOrigin.z-2,yaw:0,cooldown:0});Object.assign(enemy,{x:fireOrigin.x,y:fireOrigin.y,z:fireOrigin.z-5,cooldown:999});g.bots=[ally,enemy];g.events=[];g.random=()=>accuracyRoll;
    const shot=firstBotShot(g);assert.ok(shot);assert.equal(shot.id,ally.id);assert.equal(shot.target,enemy.id);
    if(accuracyRoll===.99){assert.equal(enemy.hp,100);assert.equal(blood(g).length,0);continue;}
    const hit=blood(g)[0];assert.equal(hit.id,enemy.id);assert.equal(hit.attacker,ally.id);assert.equal(hit.weapon,ally.weapon);assert.equal(hit.damage,17);assert.equal(g.player.hp,100);
    assert.ok(Math.abs(Math.hypot(hit.position[0]-enemy.x,hit.position[1]-(enemy.y+1.1),hit.position[2]-enemy.z)-.43)<1e-8);
    const delta=shot.to.map((v,i)=>v-shot.origin[i]),length=Math.hypot(...delta);near(hit.direction,delta.map(v=>v/length));
    assert.ok(Math.hypot(...hit.position.map((v,i)=>v-shot.origin[i]))<length,'blood sits at the entry surface rather than behind the torso');
  }
});

test('a bot hit on the player retains hurt feedback and victim identity',()=>{
  const g=new Game({difficulty:'hard',character:'fox'});g.phase='live';Object.assign(g.player,fireOrigin);const enemy=g.aliveEnemies[0];Object.assign(enemy,{x:fireOrigin.x,y:fireOrigin.y,z:fireOrigin.z+3,yaw:0,cooldown:0});g.bots=[enemy];g.events=[];g.random=()=>0;
  assert.ok(firstBotShot(g));const hit=blood(g)[0];assert.equal(hit.id,0);assert.equal(hit.character,'fox');assert.equal(hit.attacker,enemy.id);assert.equal(hit.damage,17);assert.equal(g.player.hp,83);assert.equal(g.events.filter(e=>e.type==='hurt').length,1);
});
