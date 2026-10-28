import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { MAP, blocked, clearLine, walkLine, planRoute } from '../src/map.js';
import {fireOrigin,openLane,nearWarehouseWall,warehouse} from './map-fixtures.mjs';
const siteA={x:MAP.sites[0].x,y:MAP.sites[0].y,z:MAP.sites[0].z};

const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const tick=(g,seconds)=>{for(let n=0;n<Math.ceil(seconds/.02)&&g.phase==='live';n++)g.update(.02);};
function isolated(side='attack'){
  const g=new Game({side});g.phase='live';g.bots=g.aliveAllies;g.checkElimination=()=>{};return g;
}
test('routes project blocked destinations and every segment clears the actor footprint',()=>{
  for(const from of Object.values(MAP.spawn))for(const to of [...MAP.sites,{x:warehouse.x,y:0,z:warehouse.z},openLane]){
    const route=planRoute(from,to);assert.ok(route.points.length);assert.equal(blocked(route.goal.x,route.goal.z,.45),false);
    let previous=from;for(const p of route.points){assert.ok(walkLine(previous,p,.38));previous=p;}
    if(!blocked(to.x,to.z,.45,to.y))assert.ok(dist(route.goal,to)<.01);else assert.equal(route.complete,false);
  }
});
test('teammates advance on independent lanes when the player stays at spawn',()=>{
  const g=isolated(),initial={...g.player};tick(g,38);
  assert.deepEqual(g.player,initial);for(const b of g.bots){assert.ok(dist(b,g.player)>15);assert.ok(['advance','take-site'].includes(b.ai.state));assert.notEqual(b.ai.reason,'follow carrier in open formation');}
  assert.equal(new Set(g.bots.map(b=>b.site)).size,2);
});
test('moving the player to another lane does not drag teammates or replace their assignments',()=>{
  const g=isolated();tick(g,15);const assignments=g.bots.map(b=>({...b.ai.assignment}));Object.assign(g.player,MAP.sites[1]);tick(g,3);
  for(const [i,b] of g.bots.entries()){assert.equal(b.ai.assignment.site,assignments[i].site);assert.deepEqual(b.ai.assignment.lane,assignments[i].lane);assert.notEqual(b.ai.state,'escort');}
});
test('defenders hold different site positions without continually recalculating paths',()=>{
  const g=isolated('defend');g.player.dead=true;tick(g,30);
  const points=g.bots.map(b=>({x:b.x,z:b.z})),plans=g.bots.map(b=>b.ai.plans);tick(g,10);
  for(const [i,bot] of g.bots.entries()){assert.equal(bot.ai.state,'guard');assert.ok(dist(bot,points[i])<.05);assert.equal(bot.ai.plans,plans[i]);}
  assert.ok(new Set(g.bots.map(b=>b.site)).size===2);for(const [i,a] of g.bots.entries())for(const b of g.bots.slice(i+1))assert.ok(dist(a,b)>1.04);
});
test('planting or defusing bots do not shoot during the interaction',()=>{
  for(const side of ['attack','defend']){
    const g=isolated(side);g.player.dead=true;const bot=g.bots[0];g.bots=[bot];Object.assign(bot,{x:MAP.sites[0].x,y:MAP.sites[0].y,z:MAP.sites[0].z,site:0,yaw:Math.PI,cooldown:0});
    const enemy={id:90,team:side==='attack'?'defend':'attack',x:19.2,y:2.4,z:-36,hp:100,dead:false,yaw:0,cooldown:999,site:0,path:[]};g.bots.push(enemy);
    assert.equal(blocked(enemy.x,enemy.z),false);assert.equal(clearLine(bot,enemy),true);assert.ok(dist(bot,enemy)>8);
    if(side==='defend')g.plant(MAP.sites[0].x,MAP.sites[0].z,'A');tick(g,.8);
    assert.equal(bot.ai.state,side==='attack'?'plant':'defuse');assert.equal(g.events.some(e=>e.type==='botShot'&&e.id===bot.id),false);
  }
});
test('one defender defuses while teammates cover, and progress resets on reassignment',()=>{
  const g=isolated('defend');g.player.dead=true;for(const b of g.bots)Object.assign(b,siteA);g.plant(siteA.x,siteA.z,'A');tick(g,2);
  assert.equal(g.bots.filter(b=>b.ai.state==='defuse').length,1);
  const old=g.defuserId;g.damage(g.bots.find(b=>b.id===old),100);tick(g,1.5);assert.notEqual(g.defuserId,old);assert.equal(g.winner,null);assert.ok(g.botDefuse<1.6);tick(g,5);assert.equal(g.winner,'defend');
});
test('planting triggers immediate retake even when an old guard route is active',()=>{
  const g=isolated('defend');g.player.dead=true;tick(g,.1);g.plant(siteA.x,siteA.z,'A');tick(g,.02);
  const bot=g.bots.find(b=>b.id===g.defuserId);assert.equal(bot.ai.state,'retake');assert.deepEqual(bot.ai.request,siteA);
});
test('bots remember a seen position briefly, without tracking an enemy behind cover',()=>{
  const g=isolated('defend');const bot=g.bots[0];Object.assign(bot,{...openLane,yaw:Math.PI,cooldown:999});g.bots=[bot];
  const enemy={...g.player,id:90,team:'attack',x:openLane.x,y:openLane.y,z:openLane.z+3,hp:100,dead:false,cooldown:999,path:[],site:0};g.bots.push(enemy);tick(g,.2);
  const memory={x:bot.ai.memory.x,z:bot.ai.memory.z};Object.assign(enemy,MAP.spawn.attack);tick(g,.3);
  assert.deepEqual({x:bot.ai.memory.x,z:bot.ai.memory.z},memory);assert.equal(g.events.some(e=>e.type==='botShot'&&e.id===bot.id),false);
  enemy.dead=true;tick(g,5);assert.equal(bot.ai.memory,null);assert.equal(bot.ai.state,'guard');
});
test('rear contacts need awareness or damage and firing has a reaction delay',()=>{
  const g=isolated('defend');const bot=g.bots[0];Object.assign(bot,{...fireOrigin,yaw:0,cooldown:0});g.bots=[bot];
  const enemy={...g.player,id:90,team:'attack',x:fireOrigin.x,y:fireOrigin.y,z:fireOrigin.z+8,hp:100,dead:false,cooldown:999,path:[],site:0};g.bots.push(enemy);g.random=()=>0;
  tick(g,.1);assert.equal(bot.ai.targetId,null);g.damage(bot,1,enemy);tick(g,.1);assert.equal(g.events.some(e=>e.type==='botShot'&&e.id===bot.id),false);
  tick(g,1);assert.ok(g.events.some(e=>e.type==='botShot'&&e.id===bot.id));
});
test('seeded rounds preserve walkability, finite positions and bounded replanning',()=>{
  for(const side of ['attack','defend'])for(const difficulty of ['easy','normal','hard'])for(let seed=1;seed<=8;seed++){
    const g=new Game({side,difficulty},seed);g.phase='live';g.player.dead=true;
    for(let n=0;n<8000&&g.phase==='live';n++){
      g.update(.02);for(const b of g.aliveBots){assert.ok(Number.isFinite(b.x)&&Number.isFinite(b.z));assert.equal(blocked(b.x,b.z,.38,b.y),false,`${side} ${seed} ${b.id}`);for(const other of g.aliveBots)if(other.id>b.id&&Math.abs(other.y-b.y)<1.8)assert.ok(dist(b,other)>=.84-1e-5,`${side} ${seed}: ${b.id} overlaps ${other.id}`);}
    }
    assert.notEqual(g.phase,'live');for(const b of g.bots)if(b.ai)assert.ok(b.ai.plans<160,`${side} ${difficulty} ${seed} ${b.id}: ${b.ai.plans}`);
  }
});
test('short corner occlusions do not cause frame-by-frame combat and escort reversals',()=>{
  const g=new Game({side:'defend'},3);g.phase='live';g.player.dead=true;const bot=g.bots[2];let changes=0,previous='';
  for(let n=0;n<3500&&g.phase==='live';n++){g.update(.02);if(bot.ai.state!==previous){changes++;previous=bot.ai.state;}}
  assert.ok(changes<60,`excessive behavior changes: ${changes}`);assert.ok(bot.ai.plans<70,`excessive replanning: ${bot.ai.plans}`);
});
test('a stalled moving bot requests recovery then continues toward the objective',()=>{
  const g=isolated();g.player.dead=true;g.bots=g.bots.slice(0,1);const bot=g.bots[0];Object.assign(bot,MAP.lanes.aShort);const start={x:bot.x,y:bot.y,z:bot.z};
  // Reproduce sustained external movement obstruction without introducing map mutations.
  for(let n=0;n<55;n++){g.update(.02);Object.assign(bot,start);}
  assert.ok(bot.ai.recoveries>=1);tick(g,30);assert.ok(g.bomb);assert.ok(dist(bot,start)>10);
});
test('A-platform ledge corners remain mandatory until the next segment is walkable',()=>{
  const g=isolated();g.player.dead=true;g.bots=g.bots.slice(0,1);const bot=g.bots[0];
  Object.assign(bot,MAP.lanes.aShort);tick(g,.02);
  Object.assign(bot,{x:34.023583,y:3.2,z:-42.744028});
  assert.equal(walkLine(bot,{x:32.8,y:3.2,z:-43.2},.4),false);
  tick(g,15);assert.ok(g.bomb);assert.equal(g.bomb.site,'A');assert.ok(bot.ai.plans<10);
  assert.equal(blocked(bot.x,bot.z,.4,bot.y),false);
});

for(const [label,start,count] of [['coincident pair',openLane,2],['near warehouse wall',nearWarehouseWall,2],['coincident trio',openLane,3]]){
  test(`stationary shooters separate safely: ${label}`,()=>{
    const g=isolated();Object.assign(g.player,{team:'defend',x:start.x,z:start.z-6,hp:10000});
    g.bots=g.bots.slice(0,count);
    for(const b of g.bots)Object.assign(b,{...start,yaw:0,cooldown:0});
    const shots=new Set();
    for(let n=0;n<150;n++){
      const positions=g.bots.map(b=>({x:b.x,z:b.z}));g.events=[];g.update(.02);
      for(const [i,b] of g.bots.entries()){assert.equal(blocked(b.x,b.z,.38,b.y),false);assert.ok(dist(b,positions[i])<.13,'movement and separation stay within their combined per-frame speed budget');}
      for(const event of g.events.filter(e=>e.type==='botShot')){
        shots.add(event.id);const shooter=g.bots.find(b=>b.id===event.id);
        for(const b of g.bots)if(b!==shooter)assert.ok(dist(shooter,b)>=.84-1e-5,'must separate before firing');
      }
    }
    for(const b of g.bots)for(const other of g.bots)if(b.id<other.id)assert.ok(dist(b,other)>=1.04,`${b.id}/${other.id} gap: ${dist(b,other)}`);
    assert.ok(shots.size>=2,'shooters should resume combat after separating');
  });
}
test('separation yields around a player without pushing the player or causing idle jitter',()=>{
  const g=isolated('defend');tick(g,30);const bot=g.bots[0];Object.assign(g.player,{x:bot.x,y:bot.y,z:bot.z});const player={x:g.player.x,z:g.player.z};
  tick(g,2);assert.deepEqual({x:g.player.x,z:g.player.z},player);assert.ok(dist(bot,g.player)>=1.04);
  const settled={x:bot.x,y:bot.y,z:bot.z};tick(g,2);assert.ok(dist(bot,settled)<.03);
});
test('crowd separation preserves a defuser position and ignores dead bodies',()=>{
  const g=isolated('defend');g.player.dead=true;for(const b of g.bots)Object.assign(b,siteA);g.plant(siteA.x,siteA.z,'A');tick(g,2);
  const defuser=g.bots.find(b=>b.id===g.defuserId),other=g.bots.find(b=>b!==defuser);
  assert.deepEqual({x:defuser.x,y:defuser.y,z:defuser.z},siteA);assert.ok(g.botDefuse>1.9);assert.ok(dist(defuser,other)>1.04);
  Object.assign(other,{...siteA,dead:true});tick(g,1);assert.deepEqual({x:defuser.x,y:defuser.y,z:defuser.z},siteA);assert.ok(g.botDefuse>2.9);
});
