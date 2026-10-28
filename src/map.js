import {BSP,floorAt,stepPosition,traceWorld,standingBlocked} from './bsp-collision.js';
import {DESERT_NAV} from './generated/desert-nav.js';
import {nearbyNodeLookup} from './nav-candidates.js';
export {floorAt,traceWorld};
export const NAV_RADIUS=.45;
const cellSize=DESERT_NAV.cellSize,nodes=DESERT_NAV.nodes.map(([x,y,z,edges],index)=>({x,y,z,edges,index})),nearNodes=nearbyNodeLookup(nodes,cellSize);
const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z);
const height=p=>Number.isFinite(p.y)?p.y:floorAt(p.x,p.z,0);
export function blocked(x,z,r=.38,y){const ground=Number.isFinite(y)?y:floorAt(x,z,0,Infinity,Infinity,r);return ground===null||standingBlocked(x,z,ground,r);}
export function moveActor(a,dx,dz){
 if(!Number.isFinite(a.y))a.y=height(a)??0;
 const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.14));
 for(let i=0;i<n;i++){
  if(a.grounded===false){if(!standingBlocked(a.x+dx/n,a.z,a.y,.4))a.x+=dx/n;if(!standingBlocked(a.x,a.z+dz/n,a.y,.4))a.z+=dz/n;continue;}
  if(a.grounded===true){
   const step=(x,z)=>{const p=stepPosition(a,x,z,.4,.6);if(p)return p;if(!standingBlocked(x,z,a.y,.4)){a.grounded=false;return {x,y:a.y,z};}return null;};
   let p=step(a.x+dx/n,a.z+dz/n);if(!p){p=step(a.x+dx/n,a.z);if(p)Object.assign(a,p);p=step(a.x,a.z+dz/n);}if(p)Object.assign(a,p);continue;
  }
  let p=stepPosition(a,a.x+dx/n,a.z+dz/n,.4,Infinity);
  if(!p){p=stepPosition(a,a.x+dx/n,a.z,.4,Infinity);if(p)Object.assign(a,p);p=stepPosition(a,a.x,a.z+dz/n,.4,Infinity);}
  if(p)Object.assign(a,p);
 }
}
export function walkLine(a,b,r=NAV_RADIUS){
 if(!valid(a)||!valid(b))return false;
 const ay=height(a),by=height(b);if(ay===null||by===null||standingBlocked(a.x,a.z,ay,r)||standingBlocked(b.x,b.z,by,r))return false;
 let p={x:a.x,y:ay,z:a.z};const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.16));
 for(let i=1;i<=n;i++){p=stepPosition(p,a.x+(b.x-a.x)*i/n,a.z+(b.z-a.z)*i/n,r,1);if(!p)return false;}
 return Math.abs(p.y-by)<.15;
}
export function clearLine(a,b){
 if(!valid(a)||!valid(b))return false;
 const ay=height(a),by=height(b);if(ay===null||by===null)return false;
 const origin=[a.x,ay+1.45,a.z],delta=[b.x-a.x,by-ay,b.z-a.z],distance=Math.hypot(...delta);if(distance<.001)return true;
 return traceWorld(origin,delta.map(n=>n/distance),distance)>=distance-.03;
}
const point=n=>({x:n.x,y:n.y,z:n.z});
const metric=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z)+(Number.isFinite(a.y)?Math.abs(a.y-b.y)*2:0);
export function projectWalkable(p){
 if(!valid(p))return null;
 const y=floorAt(p.x,p.z,Number.isFinite(p.y)?p.y:0,Infinity,Infinity,NAV_RADIUS);
 const local=nearNodes(p);
 if(y!==null&&(!Number.isFinite(p.y)||Math.abs(p.y-y)<.6)&&local.some(n=>Math.hypot(n.x-p.x,n.z-p.z)<1.6&&Math.abs(n.y-y)<.6&&walkLine({x:p.x,y,z:p.z},n,.4)))return {x:p.x,y,z:p.z};
 let best=null,distance=Infinity;for(const n of local.length?local:nodes){const d=metric(p,n);if(d<distance){distance=d;best=n;}}
 return best?point(best):null;
}
export function planRoute(from,to){
 const empty={points:[],goal:null,complete:false,length:Infinity},goal=projectWalkable(to);if(!valid(from)||!goal)return empty;
 const startPoint={...from,y:height(from)};if(startPoint.y===null)return empty;
 if(walkLine(startPoint,goal,.4))return {points:[goal],goal,complete:metric(to,goal)<.6,length:Math.hypot(from.x-goal.x,from.z-goal.z)};
 const nearest=(p)=>nearNodes(p).sort((a,b)=>metric(p,a)-metric(p,b)).find(n=>walkLine(p,n,.4));
 const start=nearest(startPoint),end=nearest(goal);if(!start||!end)return empty;
 const costs=new Float64Array(nodes.length).fill(Infinity),parents=new Int32Array(nodes.length).fill(-1),closed=new Uint8Array(nodes.length),open=[];
 const push=(index,cost)=>{const item={index,cost};let i=open.length;open.push(item);while(i>0){const p=(i-1)>>1;if(open[p].cost<=cost)break;open[i]=open[p];i=p;}open[i]=item;};
 const pop=()=>{const first=open[0],last=open.pop();if(open.length){let i=0;while(i*2+1<open.length){let c=i*2+1;if(c+1<open.length&&open[c+1].cost<open[c].cost)c++;if(open[c].cost>=last.cost)break;open[i]=open[c];i=c;}open[i]=last;}return first.index;};
 costs[start.index]=0;push(start.index,0);let closest=start;
 while(open.length){const index=pop();if(closed[index])continue;closed[index]=1;const n=nodes[index];if(metric(n,goal)<metric(closest,goal))closest=n;if(index===end.index){closest=n;break;}
  for(const id of n.edges){const q=nodes[id],cost=costs[index]+Math.hypot(n.x-q.x,n.y-q.y,n.z-q.z);if(cost<costs[id]){costs[id]=cost;parents[id]=index;push(id,cost+Math.hypot(q.x-end.x,q.y-end.y,q.z-end.z));}}
 }
 const path=[];for(let i=closest.index;i>=0;i=parents[i])path.push(point(nodes[i]));path.reverse();const reached=closest.index===end.index;if(reached)path.push(goal);
 const smooth=[];let previous=startPoint,index=0;
 while(index<path.length){let far=index;while(far+1<path.length&&far<index+30&&walkLine(previous,path[far+1],.4))far++;if(Math.hypot(previous.x-path[far].x,previous.z-path[far].z)>.02)smooth.push(path[far]);previous=path[far];index=far+1;}
 let length=0;previous=startPoint;for(const p of smooth){length+=Math.hypot(p.x-previous.x,p.z-previous.z);previous=p;}
 return {points:smooth,goal:reached?goal:path.at(-1),complete:reached&&metric(to,goal)<.6,length};
}
export function findPath(from,to){return planRoute(from,to).points;}
const position=(x,z,y=0)=>projectWalkable({x,z,y});
const starts={};for(const side of ['attack','defend'])starts[side]=BSP.starts[side].slice(0,5).map(p=>({...p,y:floorAt(p.x,p.z,p.y,1,1,.45)??p.y}));
const sites=['A','B'].map(id=>{const t=BSP.targets.find(t=>t.id===id),center={x:(t.min[0]+t.max[0])/2,y:t.min[1],z:(t.min[2]+t.max[2])/2},p=projectWalkable(center);return {id,...p,r:3.2,targetBounds:BSP.targets.filter(t=>t.id===id),watch:position(id==='A'?35:-37,id==='A'?-22:-26,id==='A'?2.4:0)};});
for(const s of sites){
 const candidates=nodes.filter(n=>Math.hypot(n.x-s.x,n.z-s.z)<8&&Math.abs(n.y-s.y)<.6&&walkLine(s,n,.45)).sort((a,b)=>Math.abs(Math.hypot(a.x-s.x,a.z-s.z)-4)-Math.abs(Math.hypot(b.x-s.x,b.z-s.z)-4));
 s.guardPoints=[];for(const p of candidates){if(s.guardPoints.every(q=>Math.hypot(p.x-q.x,p.z-q.z)>2)){s.guardPoints.push(point(p));if(s.guardPoints.length===5)break;}}
}
const zone=(name,x,z,w,d,y=0)=>({name,...position(x,z,y),w,d});
const zones=[zone('潜伏者基地',-17,47,18,10,3.2),zone('保卫者基地',9,-31,15,11,-3.2),zone('A 大道',46,0,10,65),zone('A 门',38,32,15,16),zone('A 小道',16,-15,10,27,2.4),zone('A 平台',33,-34,21,16,2.4),zone('中门',6,-8,11,12,-3.2),zone('中路',5,13,14,36),zone('B 洞',-44,6,14,46),zone('B 平台',-39,-40,24,22),zone('后花园',-44,33,18,22)];
export const MAP={id:'desert-grey',name:'沙漠灰',english:'DESERT',size:114,playableHalf:57,teamSize:5,source:'GoldSrc BSP30 CF_DUST2 by dustsanzo',sites,zones,spawn:{attack:starts.attack[0],defend:starts.defend[0]},spawnYaw:{attack:starts.attack[0].yaw,defend:starts.defend[0].yaw},teamSpawns:{attack:starts.attack.map(p=>[p.x,p.z,p.y]),defend:starts.defend.map(p=>[p.x,p.z,p.y])},footprint:[{x:-56,z:-56.8},{x:56,z:-56.8},{x:56,z:56.8},{x:-56,z:56.8}],obstacles:[],decor:[],routeChecks:zones.slice(2).map(point),radarCells:nodes.filter(n=>n.y<8).map(n=>[n.x,n.z,n.y]),radarCellSize:cellSize,lanes:{aLong:position(46,10,0),aShort:position(14,2,1),middle:position(6,11,0),bCave:position(-45,4,0)},bounds:BSP.bounds};
export function rayBox(origin,dir,b){const min=[b.x-b.w/2,b.y||0,b.z-b.d/2],max=[b.x+b.w/2,(b.y||0)+b.h,b.z+b.d/2];let lo=0,hi=Infinity;for(let k=0;k<3;k++){if(Math.abs(dir[k])<1e-8){if(origin[k]<min[k]||origin[k]>max[k])return Infinity;}else{let a=(min[k]-origin[k])/dir[k],c=(max[k]-origin[k])/dir[k];if(a>c)[a,c]=[c,a];lo=Math.max(lo,a);hi=Math.min(hi,c);if(lo>hi)return Infinity;}}return lo;}
export function raySphere(o,d,c,r){const v=o.map((x,i)=>x-c[i]),b=v.reduce((s,x,i)=>s+x*d[i],0),q=b*b-(v.reduce((s,x)=>s+x*x,0)-r*r);if(q<0)return Infinity;const near=-b-Math.sqrt(q),far=-b+Math.sqrt(q);return near>=0?near:far>=0?far:Infinity;}
