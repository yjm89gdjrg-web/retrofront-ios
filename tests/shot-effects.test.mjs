import test from 'node:test';import assert from 'node:assert/strict';import {Scene,Vector3} from 'three';
import {resolveShotPath,tracerSegment} from '../src/shot-path.js';import {ShotEffects} from '../src/shot-effects.js';
const shot={weapon:'ak',origin:[0,1.6,0],dir:[0,0,-1],distance:70,muzzle:[.2,1.45,-.8],firstPerson:true,follow:()=>new Vector3(.2,-.15,-.8)};
const gap=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
test('visual trail starts at the muzzle and ends at the actual eye-ray hit',()=>{
 const p=resolveShotPath(shot.origin,shot.dir,shot.distance,shot.muzzle);assert.deepEqual(p.from,shot.muzzle);assert.ok(gap(p.to,[0,1.6,-70])<1e-8);
 const direction=[.6,.2,-.7745966692],q=resolveShotPath([4,6,10],direction,20,[4.2,5.8,9]);const norm=Math.hypot(...direction);assert.ok(gap(q.to,direction.map((v,i)=>[4,6,10][i]+v/norm*20))<1e-8);
});
test('near-wall and behind-muzzle hits do not create backwards trails',()=>{
 for(const distance of [0,.2,.7,.9])assert.equal(resolveShotPath(shot.origin,shot.dir,distance,shot.muzzle),null);
 assert.equal(resolveShotPath(shot.origin,[0,0,0],70,shot.muzzle),null);assert.equal(resolveShotPath(shot.origin,shot.dir,Infinity,shot.muzzle),null);
 assert.equal(resolveShotPath(shot.origin,shot.dir,70,shot.muzzle,()=>.1),null);
});
test('a wall along the muzzle path clips the visual independently of the sight ray',()=>{
 const p=resolveShotPath(shot.origin,shot.dir,70,shot.muzzle,(origin)=>origin[0]===0?Infinity:3);
 assert.ok(Math.abs(p.length-2.985)<1e-8);assert.ok(gap(p.from,p.to)<3);assert.ok(p.to[2]>-4);
});
test('tracers travel in short segments and never overshoot the hit',()=>{
 const p=resolveShotPath(shot.origin,shot.dir,70,shot.muzzle);let previous=-1;
 for(let age=0;age<.35;age+=.01){const s=tracerSegment(p,age),head=gap(s.to,p.from);assert.ok(head>=previous-1e-8);assert.ok(head<=p.length+1e-8);assert.ok(gap(s.from,s.to)<=2.2+1e-8);previous=head;}
 assert.ok(tracerSegment(p,.35).finished);assert.equal(tracerSegment(p,.01).finished,false);
});
test('a fresh flash survives its first render and follows the animated muzzle',()=>{
 const effects=new ShotEffects(new Scene(),new Scene());let position=new Vector3(.2,-.15,-.8);effects.update(.05);effects.emit({...shot,follow:()=>position.clone()});
 assert.equal(effects.flashes.length,1);assert.equal(effects.flashes[0].node.material.opacity,1);position.set(.1,.2,-.9);effects.update(.015);
 assert.ok(effects.flashes[0].node.position.distanceTo(position)<1e-8);const opacity=effects.flashes[0].node.material.opacity;effects.update(0);assert.equal(effects.flashes[0].node.material.opacity,opacity);
 effects.update(.05);assert.equal(effects.flashes.length,0);effects.dispose();
});
test('melee has no shooting effects, scoped firing hides the flame and switching clears it',()=>{
 const effects=new ShotEffects(new Scene(),new Scene());for(const weapon of ['knife','axe','shovel'])effects.emit({...shot,weapon});assert.equal(effects.flashes.length+effects.tracers.length,0);
 effects.emit({...shot,showFlash:false});assert.equal(effects.flashes.length,0);assert.equal(effects.tracers.length,1);
 effects.emit(shot);effects.emit(shot);assert.equal(effects.flashes.length,1);effects.clearPlayerFlash();assert.equal(effects.flashes.length,0);effects.dispose();
});
test('trails and flashes expire and dispose GPU objects without disposing a shared flame texture early',()=>{
 const world=new Scene(),view=new Scene(),effects=new ShotEffects(world,view);let textureDisposed=0,geometryDisposed=0,materialDisposed=0;
 effects.texture.addEventListener('dispose',()=>textureDisposed++);effects.emit(shot);const t=effects.tracers[0];t.node.geometry.addEventListener('dispose',()=>geometryDisposed++);t.node.material.addEventListener('dispose',()=>materialDisposed++);
 effects.update(.4);assert.equal(effects.tracers.length,0);assert.equal(effects.flashes.length,0);assert.equal(world.children.length+view.children.length,0);assert.equal(geometryDisposed,1);assert.equal(materialDisposed,1);assert.equal(textureDisposed,0);
 effects.dispose();assert.equal(textureDisposed,1);
});
