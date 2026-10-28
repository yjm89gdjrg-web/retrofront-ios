// Frozen pre-optimization distance tracer, retained as an independent oracle.
import {BSP as C} from '../src/bsp-collision.js';
const SOLID=-2;
function traceTree(tree,index,a,b,t0=0,t1=1,normal=null,depth=0){
 if(index<0)return index===SOLID?{fraction:t0,normal}:null;
 if(depth>256)return {fraction:t0,normal};
 const k=tree[index*3]*4,n=C.planes.slice(k,k+3),d=C.planes[k+3],da=n[0]*a[0]+n[1]*a[1]+n[2]*a[2]-d,db=n[0]*b[0]+n[1]*b[1]+n[2]*b[2]-d;
 if(da>=0&&db>=0)return traceTree(tree,tree[index*3+1],a,b,t0,t1,normal,depth+1);
 if(da<0&&db<0)return traceTree(tree,tree[index*3+2],a,b,t0,t1,normal,depth+1);
 const f=Math.max(0,Math.min(1,da/(da-db))),mid=a.map((x,i)=>x+(b[i]-x)*f),time=t0+(t1-t0)*f,front=da>=0;
 return traceTree(tree,tree[index*3+(front?1:2)],a,mid,t0,time,normal,depth+1)||traceTree(tree,tree[index*3+(front?2:1)],mid,b,time,t1,n.map(x=>front?x:-x),depth+1);
}
export function referenceTraceWorld(origin,dir,max=200){
 const end=origin.map((x,i)=>x+dir[i]*max);let distance=Infinity;
 for(const model of C.solids){
  if(model.index!==0){let lo=0,hi=max;for(let i=0;i<3;i++){if(Math.abs(dir[i])<1e-9){if(origin[i]<model.min[i]||origin[i]>model.max[i]){lo=Infinity;break;}}else{let a=(model.min[i]-origin[i])/dir[i],b=(model.max[i]-origin[i])/dir[i];if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);}}if(lo>hi)continue;}
  const hit=traceTree(C.nodes,model.hull0,origin,end);if(hit)distance=Math.min(distance,hit.fraction*max);
 }
 return distance;
}
export function deterministicRays(count=6000){
 let seed=0x9e3779b9;const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
 return Array.from({length:count},()=>{const origin=[random()*128-64,random()*40-10,random()*128-64],dir=[random()*2-1,random()*2-1,random()*2-1],length=Math.hypot(...dir);return {origin,dir:dir.map(n=>n/length),max:random()*160+.001};});
}
