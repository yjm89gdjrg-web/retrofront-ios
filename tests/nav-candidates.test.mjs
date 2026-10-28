import test from 'node:test';import assert from 'node:assert/strict';
import {DESERT_NAV} from '../src/generated/desert-nav.js';import {nearbyNodeLookup} from '../src/nav-candidates.js';
const nodes=DESERT_NAV.nodes.map(([x,y,z],index)=>({x,y,z,index})),size=DESERT_NAV.cellSize;
function reference(point){const ix=Math.round(point.x/size),iz=Math.round(point.z/size),result=[];for(let r=0;r<=8;r++)for(let x=ix-r;x<=ix+r;x++)for(let z=iz-r;z<=iz+r;z++){if(r&&Math.abs(x-ix)!==r&&Math.abs(z-iz)!==r)continue;for(const n of nodes)if(Math.round(n.x/size)===x&&Math.round(n.z/size)===z)result.push(n);}return result;}
test('cached grid candidates preserve native order, boundaries and stacked floors',()=>{
 const lookup=nearbyNodeLookup(nodes,size),points=[{x:0,z:0},{x:-.5*size,z:.5*size},{x:40,z:-30},{x:-40,z:20}];
 for(const p of points){const expected=reference(p);for(const y of [-6,0,12])assert.deepEqual(lookup({...p,y}),expected);}
 const p=points[0],expected=reference(p),sorted=lookup(p);sorted.reverse();sorted.length=1;assert.deepEqual(lookup(p),expected,'caller sorting cannot mutate the shared cached grid list');
});
test('navigation candidate cache remains bounded after travelling through many cells',()=>{
 const lookup=nearbyNodeLookup(nodes,size,8);for(let x=-20;x<20;x++)lookup({x:x*size,z:0});assert.equal(lookup.cacheSize,8);assert.deepEqual(lookup({x:0,z:0}),reference({x:0,z:0}));
});
