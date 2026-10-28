import test from 'node:test';
import assert from 'node:assert/strict';
import {RenderPacer,ResolutionBudget} from '../src/frame-budget.js';
test('menus draw at 30Hz, paused scenes at 15Hz, and active gameplay never skips render calls',()=>{
 const pacer=new RenderPacer();let menus=0,paused=0,game=0;
 for(let i=0;i<60;i++)if(pacer.consume('menu',1/60)!==null)menus++;
 for(let i=0;i<60;i++)if(pacer.consume('paused',1/60)!==null)paused++;
 for(let i=0;i<60;i++)if(pacer.consume('game',1/60)!==null)game++;
 assert.equal(menus,30);assert.equal(paused,15);assert.equal(game,60);
 pacer.consume('menu',0);assert.equal(pacer.consume('menu',0),null);pacer.invalidate();assert.equal(pacer.consume('menu',0),0);
});
test('reduced menu cadence preserves accumulated animation time and resume draws immediately',()=>{
 const pacer=new RenderPacer();pacer.consume('menu',0);assert.equal(pacer.consume('menu',.01),null);assert.equal(pacer.consume('menu',.024),.034);
 assert.equal(pacer.consume('game',.001),.001);assert.equal(pacer.consume('game',0),0);
 pacer.consume('paused',0);assert.equal(pacer.consume('paused',.04),null);assert.equal(pacer.consume('game',.016),.016,'resume cannot replay accumulated paused drawing time');
});
test('resolution changes only after sustained pressure and recovers slowly within the selected quality',()=>{
 const budget=new ResolutionBudget('high',3);assert.equal(budget.ratio,1.6);
 for(let i=0;i<50;i++)assert.equal(budget.sample(.03),null);for(let i=0;i<20;i++)budget.sample(.03);assert.equal(budget.ratio,1.45);
 for(let i=0;i<600;i++)budget.sample(.03);assert.equal(budget.ratio,.9);
 for(let i=0;i<240;i++)budget.sample(1/60);assert.equal(budget.ratio,.9);
 for(let i=0;i<150;i++)budget.sample(1/60);assert.equal(budget.ratio,.95);
 for(let i=0;i<1500;i++)budget.sample(1/60);assert.ok(budget.ratio<=1.6);
 assert.equal(budget.configure('low',3),1);for(let i=0;i<400;i++)budget.sample(.035);assert.equal(budget.ratio,.7);
});
test('a loading spike, invalid sample, pause reset or 60Hz display does not lower resolution',()=>{
 const budget=new ResolutionBudget('high',3);for(const dt of [1,NaN,-1,0])assert.equal(budget.sample(dt),null);
 for(let i=0;i<1000;i++)budget.sample(1/60);assert.equal(budget.ratio,1.6);
 for(let i=0;i<40;i++)budget.sample(.03);budget.reset();for(let i=0;i<30;i++)budget.sample(.03);assert.equal(budget.ratio,1.6);
});
