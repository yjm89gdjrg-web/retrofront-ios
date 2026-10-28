import fs from 'node:fs/promises';
import {BSP,floorLevels,floorAt,stepPosition} from '../src/bsp-collision.js';
const size=.8,nodes=[],cells=new Map();
for(let ix=-70;ix<=70;ix++)for(let iz=-71;iz<=71;iz++){
 const x=ix*size,z=iz*size,key=ix+','+iz,local=[];
 for(const base of floorLevels(x,z)){
  if(base>12||base< -6.2)continue;
  const y=floorAt(x,z,base,.46,.01,.45);if(y===null||local.some(n=>Math.abs(n.y-y)<.08))continue;
  const node={x,y,z,index:nodes.length,edges:[]};nodes.push(node);local.push(node);
 }
 if(local.length)cells.set(key,local);
}
function passage(a,b){
 let p=a;const steps=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.16);
 for(let i=1;i<=steps;i++){const next=stepPosition(p,a.x+(b.x-a.x)*i/steps,a.z+(b.z-a.z)*i/steps,.45,1);if(!next)return false;p=next;}
 return Math.abs(p.y-b.y)<.12;
}
for(const node of nodes){
 const ix=Math.round(node.x/size),iz=Math.round(node.z/size);
 for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]])for(const next of cells.get((ix+dx)+','+(iz+dz))||[]){
  if(Math.abs(next.y-node.y)>1.5||!passage(node,next))continue;
  node.edges.push(next.index);
 }
}
const spawn=BSP.starts.attack[0],nearest=nodes.reduce((a,b)=>Math.hypot(a.x-spawn.x,a.y-spawn.y,a.z-spawn.z)<Math.hypot(b.x-spawn.x,b.y-spawn.y,b.z-spawn.z)?a:b),reachable=new Set([nearest.index]),queue=[nearest.index];
for(let i=0;i<queue.length;i++)for(const j of nodes[queue[i]].edges)if(!reachable.has(j)){reachable.add(j);queue.push(j);}
const playable=nodes.filter(n=>reachable.has(n.index)),indices=new Map(playable.map((n,i)=>[n.index,i]));
await fs.writeFile('src/generated/desert-nav.js','// Native walkable floors connected to the actual player spawn.\nexport const DESERT_NAV = '+JSON.stringify({cellSize:size,nodes:playable.map(n=>[+n.x.toFixed(4),+n.y.toFixed(5),+n.z.toFixed(4),n.edges.filter(i=>reachable.has(i)).map(i=>indices.get(i))])})+';\n');
console.log(JSON.stringify({nodes:playable.length,excludedUnreachable:nodes.length-playable.length,edges:playable.reduce((s,n)=>s+n.edges.length,0),spawns:BSP.starts.attack.length+BSP.starts.defend.length}));
