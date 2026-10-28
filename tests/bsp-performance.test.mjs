import test from 'node:test';
import assert from 'node:assert/strict';
import {BSP,pointSolid,traceWorld} from '../src/bsp-collision.js';
import {MAP} from '../src/map.js';
import {referenceTraceWorld,deterministicRays} from './bsp-reference.mjs';
function compare(origin,dir,max){
 const expected=referenceTraceWorld(origin,dir,max),actual=traceWorld(origin,dir,max);
 if(Number.isFinite(expected))assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<=1e-9,JSON.stringify({origin,dir,max,expected,actual}));
 else assert.equal(actual,expected);
}
test('allocation-free BSP tracing matches the frozen tracer on 6000 deterministic random rays',()=>{
 for(const {origin,dir,max} of deterministicRays())compare(origin,dir,max);
});
test('BSP boundaries, zero-length directions and starts inside solids preserve exact collision behavior',()=>{
 const axes=[[0,0,0],[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
 for(let i=0;i<Math.min(BSP.planes.length,1200);i+=4){
  const n=BSP.planes.slice(i,i+3),d=BSP.planes[i+3],axis=n.map(Math.abs).indexOf(Math.max(...n.map(Math.abs))),origin=[0,0,0];origin[axis]=d/n[axis];
  for(const dir of axes)compare(origin,dir,25);
 }
 let interiors=0;for(const {origin} of deterministicRays(2000))if(pointSolid(...origin)){
  for(const dir of axes)for(const max of [0,1,80])compare(origin,dir,max);if(++interiors>=128)break;
 }
 assert.equal(interiors,128);
});
test('real spawn, lane and bomb-site visibility rays match the frozen collision oracle',()=>{
 const positions=[...MAP.routeChecks,...MAP.sites,...Object.values(MAP.spawn),...Object.values(MAP.lanes)];
 for(const from of positions)for(const to of positions){const origin=[from.x,from.y+1.45,from.z],delta=[to.x-from.x,to.y-from.y,to.z-from.z],distance=Math.hypot(...delta),dir=distance?delta.map(n=>n/distance):[0,0,0];compare(origin,dir,distance);}
});
