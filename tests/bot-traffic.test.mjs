import test from 'node:test';
import assert from 'node:assert/strict';
import {BotTraffic} from '../src/bot-traffic.js';
import {walkLine,projectWalkable,blocked} from '../src/map.js';
import {Game} from '../src/game.js';

const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const actor=(id,z,to,extra={})=>({id,x:0,y:0,z,team:'attack',dead:false,path:[{x:0,y:0,z:to}],...extra});
const open=(p,r=.4)=>Math.abs(p.z)<=9&&Math.abs(p.x)<(Math.abs(p.z)>3?4:.76)-r;
const corridorWalk=(a,b,r=.4)=>{for(let n=0;n<=50;n++){const t=n/50;if(!open({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t},r))return false;}return true;};
const fixture=()=>new BotTraffic({walkLine:corridorWalk,projectWalkable:p=>open(p)?{...p}:null});

function run(traffic,actors,seconds){
 const stats={yieldIds:new Set(),modes:new Set(),minGap:Infinity,maxStep:0,positions:[]};
 for(let frame=0;frame<seconds/.02;frame++){
  traffic.begin(actors,frame*.02,1);
  for(const a of actors){
   if(a.human||a.id===0||a.dead)continue;
   // Match navigation's mandatory-corner replanning after leaving a side
   // pocket; steering straight to the far goal would cross the doorpost.
   const point=corridorWalk(a,a.path[0])?a.path[0]:{x:0,y:0,z:Math.sign(a.z)*3.6},advice=traffic.decide(a,point);stats.modes.add(advice.mode);
   if(advice.mode==='yield')stats.yieldIds.add(a.id);
   const target=advice.mode==='yield'?advice.target:point;if(!target)continue;
   const dx=target.x-a.x,dz=target.z-a.z,d=Math.hypot(dx,dz),step=Math.min(d,4.2*.02*(advice.speed??1));if(d<.01)continue;
   const next={x:a.x+dx/d*step,y:0,z:a.z+dz/d*step};
   let safe=corridorWalk(a,next);
   for(const other of actors){
    if(other===a||other.dead)continue;
    const vx=next.x-a.x,vz=next.z-a.z,len=vx*vx+vz*vz,t=len?Math.max(0,Math.min(1,((other.x-a.x)*vx+(other.z-a.z)*vz)/len)):0;
    if(Math.hypot(a.x+vx*t-other.x,a.z+vz*t-other.z)<.84-1e-6)safe=false;
   }
   if(safe){stats.maxStep=Math.max(stats.maxStep,dist(a,next));Object.assign(a,next);}
  }
  for(let i=0;i<actors.length;i++)for(let j=i+1;j<actors.length;j++)stats.minGap=Math.min(stats.minGap,dist(actors[i],actors[j]));
  stats.positions.push(actors.map(a=>({x:a.x,z:a.z})));
 }
 return stats;
}

test('opposing teammates yield with stable priority and pass a one-person corridor without body or wall crossing',()=>{
 const traffic=fixture(),a=actor(1,-2,7),b=actor(2,2,-7),stats=run(traffic,[a,b],8);
 assert.deepEqual([...stats.yieldIds],[2]);assert.ok(a.z>3,'priority actor passes');assert.ok(b.z<-3,`yielding actor resumes its independent route: ${JSON.stringify({a,b,leases:[...traffic.leases]})}`);
 assert.ok(stats.minGap>=.84-1e-6);assert.ok(stats.maxStep<=4.2*.02+1e-8);
 for(const frame of stats.positions)for(const p of frame)assert.ok(open(p),'all movement stays inside walkable geometry');
 assert.ok(traffic.probes.size<=128);assert.ok(traffic.leases.size<=2);
});

test('same-direction followers queue without taking an alternating side or overtaking',()=>{
 const traffic=fixture(),rear=actor(1,-2,8),front=actor(2,-.4,8),stats=run(traffic,[rear,front],.8);
 assert.ok(stats.modes.has('queue'));assert.equal(stats.yieldIds.size,0);assert.equal(rear.x,0);assert.equal(front.x,0);
 assert.ok(front.z>rear.z);assert.ok(stats.minGap>=1.18-1e-5);
});

test('open spaces do not become single-file routes and enemies or other floors do not cooperate',()=>{
 const traffic=new BotTraffic({walkLine:()=>true,projectWalkable:p=>({...p})}),a=actor(4,0,5),b=actor(2,2,-5);
 traffic.begin([a,b],0,1);assert.equal(traffic.decide(a,a.path[0]).mode,'clear');
 const narrow=fixture();
 for(const other of [{...b,team:'defend'},{...b,y:3}]){narrow.begin([a,other],0,1);assert.equal(narrow.decide(a,a.path[0]).mode,'clear');}
});

test('a stationary player has priority and yielding never changes the player or task path',()=>{
 const traffic=fixture(),bot=actor(1,-1,7),player=actor(0,.6,.6,{path:[],human:true}),before=structuredClone(player),path=structuredClone(bot.path);
 traffic.begin([bot,player],0,1);const advice=traffic.decide(bot,bot.path[0]);assert.equal(advice.mode,'yield');assert.equal(advice.other,0);
 assert.deepEqual(player,before);assert.deepEqual(bot.path,path);assert.ok(advice.target.z<bot.z||Math.abs(advice.target.x)>0);
});

test('yield leases expire into normal recovery and release after death, passing or a new round',()=>{
 const traffic=fixture(),a=actor(4,-1,7),b=actor(2,1,-7);traffic.begin([a,b],0,1);assert.equal(traffic.decide(a,a.path[0]).mode,'yield');
 traffic.begin([a,b],3.01,1);assert.equal(traffic.decide(a,a.path[0]).mode,'recover');assert.equal(traffic.leases.size,0);
 traffic.begin([a,b],3.2,1);assert.equal(traffic.decide(a,a.path[0]).mode,'recover');
 traffic.begin([a,b],4.2,1);assert.equal(traffic.decide(a,a.path[0]).mode,'yield');
 b.dead=true;traffic.begin([a,b],4.3,1);assert.equal(traffic.leases.size,0);assert.equal(traffic.decide(a,a.path[0]).mode,'clear');
 b.dead=false;traffic.begin([a,b],4.4,2);assert.equal(traffic.cooldowns.size,0);assert.equal(traffic.decide(a,a.path[0]).mode,'yield');
 b.z=-2;traffic.begin([a,b],4.5,2);assert.equal(traffic.decide(a,a.path[0]).mode,'clear');assert.equal(traffic.leases.size,0);
});

test('a queue behind a blocked leader eventually permits the normal stuck-recovery window',()=>{
 const traffic=fixture(),rear=actor(4,-1,7),front=actor(2,.2,7);
 traffic.begin([rear,front],0,1);assert.equal(traffic.decide(rear,rear.path[0]).mode,'queue');
 traffic.begin([rear,front],2.6,1);assert.equal(traffic.decide(rear,rear.path[0]).mode,'recover');
 traffic.begin([rear,front],3.6,1);assert.equal(traffic.decide(rear,rear.path[0]).mode,'recover','normal 0.9-second stuck recovery has time to run');
});

test('real map open lane is unrestricted and projected narrow-lane advice remains walkable',()=>{
 const traffic=new BotTraffic({walkLine,projectWalkable}),a={...actor(4,6,10),x:27},b={...actor(2,8,2),x:27};
 a.path[0].x=27;b.path[0].x=27;traffic.begin([a,b],0,1);assert.equal(traffic.decide(a,a.path[0]).mode,'clear');
 const passages=[{name:'middle-door approach',p:{x:-3,y:0,z:-11.8},dir:{x:Math.SQRT1_2,z:Math.SQRT1_2}},{name:'B-cave corner',p:{x:-51,y:.8,z:-4.2},dir:{x:Math.SQRT1_2,z:Math.SQRT1_2}}];
 for(const {name,p,dir} of passages){
  const end=projectWalkable({x:p.x+dir.x*1.8,y:p.y,z:p.z+dir.z*1.8});assert.ok(walkLine(p,end,.4),name);
  const bot={...actor(4,0,0),...p,path:[end]},other={...actor(2,0,0),...end,path:[p]};traffic.begin([bot,other],0,1);
  assert.ok(traffic.narrow(p,dir),name);const advice=traffic.decide(bot,end);assert.equal(advice.mode,'yield',name);
  if(advice.target){assert.ok(walkLine(bot,advice.target,.4),name);assert.equal(blocked(advice.target.x,advice.target.z,.4,advice.target.y),false);}
 }
});

test('real Game navigation yields at B-cave entrance and resumes both independent assignments with bounded safe steps',()=>{
 const g=new Game({side:'attack'});g.phase='live';g.player.dead=true;g.bots=g.aliveAllies.slice(0,2);g.checkElimination=()=>{};g.update(.02);
 const starts=[{x:-46.8,y:.4,z:15},{x:-45,y:.4,z:15}],goals=[{x:-41.8,y:.4,z:15},{x:-48,y:.39,z:15.2}];
 for(const [i,bot] of g.bots.entries()){
  Object.assign(bot,starts[i]);bot.path=[];
  Object.assign(bot.ai,{assignment:{site:0,lane:{...goals[i]},stage:0,role:'entry'},key:null,goal:null,request:null,repath:0,progressTime:0,progress:{...starts[i]}});
 }
 let minGap=Infinity,maxStep=0;
 for(let n=0;n<400;n++){
  const before=g.bots.map(b=>({x:b.x,z:b.z}));g.update(.02);minGap=Math.min(minGap,dist(g.bots[0],g.bots[1]));
  for(const [i,bot] of g.bots.entries()){
   maxStep=Math.max(maxStep,dist(bot,before[i]));assert.equal(blocked(bot.x,bot.z,.38,bot.y),false);
   assert.deepEqual(bot.ai.assignment.lane,goals[i],'yielding never replaces the independent task');
  }
 }
 assert.ok(g.bots[1].ai.yields>=1,'actual navigate path must trigger cooperative yielding');
 assert.ok(g.bots.every(b=>b.ai.assignment.stage===1),'both bots reach their own lane and continue their original tasks');
 assert.ok(g.bots.every(b=>b.ai.traffic?.mode!=='yield'),'neither bot remains waiting after passing');
 assert.ok(minGap>=.84-1e-5,`minimum body gap: ${minGap}`);
 assert.ok(maxStep<=.12+1e-6,`navigation plus standing separation stays inside the speed budget: ${maxStep}`);
});
