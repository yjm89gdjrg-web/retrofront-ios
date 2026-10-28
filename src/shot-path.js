const finite=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
const subtract=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
// Keep the visual path tied to the actual hit, while avoiding reversed near-wall trails.
export function resolveShotPath(origin,dir,distance,muzzle,trace=()=>Infinity){
 if(!finite(origin)||!finite(dir)||!finite(muzzle)||!Number.isFinite(distance)||distance<=0)return null;
 const norm=Math.hypot(...dir);if(norm<1e-8)return null;const aim=dir.map(v=>v/norm);
 const endpoint=origin.map((v,i)=>v+aim[i]*distance),offset=subtract(muzzle,origin),offsetLength=Math.hypot(...offset);
 if(offsetLength>.01&&trace(origin,offset.map(v=>v/offsetLength),offsetLength)<offsetLength-.015)return null;
 const delta=subtract(endpoint,muzzle);let length=Math.hypot(...delta);
 if(length<.18||dot(delta,aim)<=.1)return null;
 const direction=delta.map(v=>v/length),wall=trace(muzzle,direction,length);
 if(Number.isFinite(wall))length=Math.min(length,Math.max(0,wall-.015));
 if(length<.18)return null;
 return {from:[...muzzle],to:muzzle.map((v,i)=>v+direction[i]*length),direction,length};
}
export function tracerSegment(path,age,speed=260,trail=2.2){
 const head=Math.min(path.length,.35+Math.max(0,age)*speed),tail=Math.max(0,head-trail);
 return {from:path.from.map((v,i)=>v+path.direction[i]*tail),to:path.from.map((v,i)=>v+path.direction[i]*head),finished:age>(path.length+trail)/speed};
}
