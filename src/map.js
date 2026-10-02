// One authoritative layout shared by rendering, collisions, shots, bots and radar.
export const MAP = {
  name:'边境货场', english:'BORDER DEPOT', size:42,
  sites:[{id:'A',x:-13,z:-11,r:3.1},{id:'B',x:13,z:-11,r:3.1}],
  spawn:{attack:{x:0,z:17},defend:{x:0,z:-17}},
  obstacles:[
    {x:0,z:-21,w:43,d:1,h:6,kind:'wall'}, {x:0,z:21,w:43,d:1,h:6,kind:'wall'},
    {x:-21,z:0,w:1,d:42,h:6,kind:'wall'}, {x:21,z:0,w:1,d:42,h:6,kind:'wall'},
    {x:-8,z:7,w:6,d:10,h:4,kind:'building'}, {x:8,z:7,w:6,d:10,h:4,kind:'building'},
    {x:0,z:-5,w:9,d:5,h:3.8,kind:'building'},
    {x:-10,z:-3,w:5,d:2.6,h:2.5,kind:'container'}, {x:11,z:-3,w:5,d:2.6,h:2.5,kind:'container'},
    {x:-17,z:-13,w:2.6,d:2.6,h:1.6,kind:'crate'}, {x:-9,z:-15,w:2,d:2,h:1.7,kind:'crate'},
    {x:17,z:-13,w:2.6,d:2.6,h:1.6,kind:'crate'}, {x:8,z:-15,w:2,d:2,h:1.7,kind:'crate'},
    {x:-16,z:8,w:2.8,d:2.8,h:1.5,kind:'crate'}, {x:16,z:8,w:2.8,d:2.8,h:1.5,kind:'crate'},
    {x:0,z:11,w:2.4,d:2.4,h:1.6,kind:'crate'}
  ]
};
export function blocked(x,z,r=.38) {
  if (Math.abs(x)>20-r || Math.abs(z)>20-r) return true;
  return MAP.obstacles.some(b => Math.abs(x-b.x)<b.w/2+r && Math.abs(z-b.z)<b.d/2+r);
}
export function moveActor(a,dx,dz) {
  // Substeps prevent tunnelling even when the frame rate falls.
  const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.18));
  for(let i=0;i<n;i++) { if(!blocked(a.x+dx/n,a.z)) a.x+=dx/n; if(!blocked(a.x,a.z+dz/n)) a.z+=dz/n; }
}
export function clearLine(a,b) {
  const dx=b.x-a.x,dz=b.z-a.z,dist=Math.hypot(dx,dz),n=Math.ceil(dist/.22);
  for(let i=1;i<n;i++) if(blocked(a.x+dx*i/n,a.z+dz*i/n,.02)) return false;
  return true;
}
export function rayBox(origin,dir,b) {
  const min=[b.x-b.w/2,0,b.z-b.d/2],max=[b.x+b.w/2,b.h,b.z+b.d/2];
  let lo=0,hi=Infinity;
  for(let k=0;k<3;k++) {
    if(Math.abs(dir[k])<1e-8) { if(origin[k]<min[k] || origin[k]>max[k]) return Infinity; }
    else { let a=(min[k]-origin[k])/dir[k],c=(max[k]-origin[k])/dir[k]; if(a>c)[a,c]=[c,a]; lo=Math.max(lo,a);hi=Math.min(hi,c);if(lo>hi)return Infinity; }
  }
  return lo;
}
export function raySphere(o,d,c,r) {
  const v=o.map((x,i)=>x-c[i]),b=v.reduce((s,x,i)=>s+x*d[i],0),q=b*b-(v.reduce((s,x)=>s+x*x,0)-r*r);
  if(q<0)return Infinity;
  const near=-b-Math.sqrt(q),far=-b+Math.sqrt(q);
  return near>=0?near:far>=0?far:Infinity;
}
// Breadth-first search on a small, uniform grid. Recomputed at most once/second/bot.
export function findPath(from,to) {
  const snap=p=>({x:Math.round(p.x),z:Math.round(p.z)}),s=snap(from),t=snap(to),key=p=>`${p.x},${p.z}`;
  const queue=[s],parent=new Map([[key(s),null]]); let end=null;
  for(let i=0;i<queue.length;i++) {
    const p=queue[i];if(Math.hypot(p.x-t.x,p.z-t.z)<1.1){end=p;break;}
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const q={x:p.x+dx,z:p.z+dz},k=key(q);
      if(!parent.has(k) && !blocked(q.x,q.z,.45)) { parent.set(k,p);queue.push(q); }
    }
  }
  const out=[];while(end&&parent.get(key(end))){out.push(end);end=parent.get(key(end));}return out.reverse();
}
