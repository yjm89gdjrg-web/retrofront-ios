import {BSP_COLLISION as C} from './generated/desert-collision.js';

export const BSP=C;
const SOLID=-2,cellSize=1,buckets=new Map(),centerOffset=[[0,0]];
for(const t of C.floors){
 const x0=Math.floor(Math.min(t[0],t[3],t[6])/cellSize),x1=Math.floor(Math.max(t[0],t[3],t[6])/cellSize),z0=Math.floor(Math.min(t[2],t[5],t[8])/cellSize),z1=Math.floor(Math.max(t[2],t[5],t[8])/cellSize);
 for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){const key=x+','+z;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(t);}
}
export function floorLevels(x,z){
 const values=[],triangles=buckets.get(Math.floor(x/cellSize)+','+Math.floor(z/cellSize))||[];
 for(const t of triangles){
  const ax=t[3]-t[0],az=t[5]-t[2],bx=t[6]-t[0],bz=t[8]-t[2],px=x-t[0],pz=z-t[2],den=ax*bz-az*bx;if(Math.abs(den)<1e-8)continue;
  const u=(px*bz-pz*bx)/den,v=(ax*pz-az*px)/den;if(u<-.0001||v<-.0001||u+v>1.0001)continue;
  const y=t[1]+u*(t[4]-t[1])+v*(t[7]-t[1]);if(!values.some(n=>Math.abs(y-n)<.015))values.push(y);
 }
 return values.sort((a,b)=>a-b);
}
function contents(tree,index,x,y,z){
 for(let n=0;index>=0&&n<256;n++){
  const p=tree[index*3]*4,d=C.planes[p]*x+C.planes[p+1]*y+C.planes[p+2]*z-C.planes[p+3];index=tree[index*3+(d>=0?1:2)];
 }
 return index;
}
export function pointSolid(x,y,z){
 return C.solids.some(m=>(m.index===0||(x>=m.min[0]&&x<=m.max[0]&&y>=m.min[1]&&y<=m.max[1]&&z>=m.min[2]&&z<=m.max[2]))&&contents(C.nodes,m.hull0,x,y,z)===SOLID);
}
export function standingBlocked(x,z,y,r=.4){
 if(![x,z,y].every(Number.isFinite))return true;
 // The BSP standing hull has a 16-unit radius and 72-unit body height.
 const extra=Math.max(0,r-.4),offsets=extra?[[0,0],[extra,0],[-extra,0],[0,extra],[0,-extra]]:centerOffset;
 for(const [dx,dz] of offsets)for(const m of C.solids){
  if(m.index!==0&&(x+dx<m.min[0]-.4||x+dx>m.max[0]+.4||z+dz<m.min[2]-.4||z+dz>m.max[2]+.4||y+.9<m.min[1]-.9||y+.9>m.max[1]+.9))continue;
  if(contents(C.clips,m.hull1,x+dx,y+.91,z+dz)===SOLID)return true;
 }
 return false;
}
export function floorAt(x,z,hint=0,maxRise=Infinity,maxDrop=Infinity,r=.4){
 let best=null,distance=Infinity;
 for(const base of floorLevels(x,z)){
  if(base>hint+maxRise+.012||base+.46<hint-maxDrop-.012)continue;
  let y=base;
  // A square standing hull rests on the uphill edge of a slope or step.
  if(standingBlocked(x,z,y,r)){
   let high=null,low=base;for(const lift of [.08,.16,.24,.32,.4,.46]){if(!standingBlocked(x,z,base+lift,r)){high=base+lift;break;}low=base+lift;}
   if(high===null)continue;
   for(let i=0;i<6;i++){const mid=(low+high)/2;if(standingBlocked(x,z,mid,r))low=mid;else high=mid;}y=high;
  }
  if(y>hint+maxRise+.012||y<hint-maxDrop-.012)continue;
  const d=Math.abs(y-hint);if(d<distance){best=y;distance=d;}
 }
 return best;
}
export function stepPosition(from,x,z,r=.4,maxDrop=.6){
 const y0=Number.isFinite(from.y)?from.y:floorAt(from.x,from.z);
 if(y0===null)return null;
 const y=floorAt(x,z,y0,.46,maxDrop,r);
 return y===null?null:{x,y,z};
}
function traceTree(tree,index,ax,ay,az,bx,by,bz,t0=0,t1=1,depth=0){
 if(index<0)return index===SOLID?t0:Infinity;
 if(depth>256)return t0;
 // Only the hit distance is observable. Keep recursive endpoints as scalars
 // rather than allocating normals, midpoint arrays and hit objects per node.
 const k=tree[index*3]*4,nx=C.planes[k],ny=C.planes[k+1],nz=C.planes[k+2],d=C.planes[k+3],da=nx*ax+ny*ay+nz*az-d,db=nx*bx+ny*by+nz*bz-d;
 if(da>=0&&db>=0)return traceTree(tree,tree[index*3+1],ax,ay,az,bx,by,bz,t0,t1,depth+1);
 if(da<0&&db<0)return traceTree(tree,tree[index*3+2],ax,ay,az,bx,by,bz,t0,t1,depth+1);
 const f=Math.max(0,Math.min(1,da/(da-db))),mx=ax+(bx-ax)*f,my=ay+(by-ay)*f,mz=az+(bz-az)*f,time=t0+(t1-t0)*f,front=da>=0;
 const near=traceTree(tree,tree[index*3+(front?1:2)],ax,ay,az,mx,my,mz,t0,time,depth+1);
 return near!==Infinity?near:traceTree(tree,tree[index*3+(front?2:1)],mx,my,mz,bx,by,bz,time,t1,depth+1);
}
export function traceWorld(origin,dir,max=200){
 const bx=origin[0]+dir[0]*max,by=origin[1]+dir[1]*max,bz=origin[2]+dir[2]*max;let distance=Infinity;
 for(const model of C.solids){
  if(model.index!==0){let lo=0,hi=max;for(let i=0;i<3;i++){if(Math.abs(dir[i])<1e-9){if(origin[i]<model.min[i]||origin[i]>model.max[i]){lo=Infinity;break;}}else{let a=(model.min[i]-origin[i])/dir[i],b=(model.max[i]-origin[i])/dir[i];if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);}}if(lo>hi)continue;}
  const fraction=traceTree(C.nodes,model.hull0,origin[0],origin[1],origin[2],bx,by,bz);if(fraction!==Infinity)distance=Math.min(distance,fraction*max);
 }
 return distance;
}
