import test from 'node:test';
import assert from 'node:assert/strict';
import {FrameDiagnostics} from '../src/frame-diagnostics.js';

test('diagnostics distinguish steady 60 FPS from short foreground stalls',()=>{
 const d=new FrameDiagnostics();let now=0,serial=0;d.sample(now,serial,true);
 for(let i=0;i<100;i++)d.sample(now+=1000/60,++serial,true);
 let s=d.summary();assert.equal(s.frames,100);assert.equal(s.averageFPS,60);assert.equal(s.p95FrameMs,16.7);assert.equal(s.stutters50ms,0);
 d.sample(now+=60,++serial,true);d.sample(now+=140,++serial,true);s=d.summary();
 assert.equal(s.stutters50ms,2);assert.equal(s.severe100ms,1);assert.equal(s.maxFrameMs,140);assert.equal(s.framesOver33ms,2);assert.ok(s.averageFPS<60);
});
test('pauses, background, clock resets and skipped sampling do not become stalls',()=>{
 const d=new FrameDiagnostics();d.sample(0,0,true);d.sample(16,1,true);d.sample(20,1,false);d.sample(30000,2,true);d.sample(30016,3,true);
 d.sample(1,0,true);d.sample(17,1,true);d.sample(1000,8,true);d.sample(1016,9,true);
 const s=d.summary();assert.equal(s.frames,4);assert.equal(s.stutters50ms,0);assert.equal(s.maxFrameMs,16);
 d.sample(NaN,10,true);d.sample(90000,11,true);assert.equal(d.summary().frames,4);
});
test('completed draw counters exclude callbacks without a draw',()=>{
 const d=new FrameDiagnostics();d.sample(0,0,true);d.sample(10,0,true);d.sample(20,1,true);d.sample(30,1,true);d.sample(40,2,true);
 assert.equal(d.summary().averageFPS,50);assert.equal(d.summary().frames,2);
});
test('lifecycle baseline excludes a suspended interval even when background delivers no callback',()=>{
 const d=new FrameDiagnostics();d.sample(0,0,true);d.sample(16,1,true);d.baseline();
 d.sample(120000,2,true);d.sample(120016,3,true);
 assert.equal(d.summary().frames,2);assert.equal(d.summary().stutters50ms,0);assert.equal(d.summary().maxFrameMs,16);
});
test('bounded histogram and copied recent records preserve long session statistics',()=>{
 const d=new FrameDiagnostics();d.sample(0,0,true);
 for(let i=1;i<=20000;i++)d.sample(i*60,i,true);
 const s=d.summary();assert.equal(s.frames,20000);assert.equal(s.p95FrameMs,60);assert.equal(s.recentStutters.length,8);assert.equal(d.bins.length,1001);
 s.recentStutters[0].frameMs=0;assert.equal(d.summary().recentStutters[0].frameMs,60);
 d.reset();assert.equal(d.summary().frames,0);assert.equal(d.summary().recentStutters.length,0);
 d.sample(0,0,true);d.sample(3000,1,true);assert.equal(d.summary().maxFrameMs,3000);assert.equal(d.summary().p95Capped,true);
});
