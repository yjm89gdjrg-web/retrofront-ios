import test from 'node:test';import assert from 'node:assert/strict';import {MAP,blocked} from '../src/map.js';import {Game} from '../src/game.js';
import {warehouseNorth,warehouse} from './map-fixtures.mjs';
const tick=(g,seconds,input={})=>{for(let i=0;i<Math.round(seconds/.02);i++)g.update(.02,input);};
const live=()=>{const g=new Game();g.phase='live';g.updateBots=()=>{};g.checkElimination=()=>{};return g;};
test('free camera moves independently of a dead body and cannot shoot or interact',()=>{
 const g=live();g.damage(g.player,100);const corpse={...g.player},ammo={...g.ammo[0]};g.events=[];
 g.setSpectatorMode('free',{x:0,y:2,z:10,yaw:0,pitch:.4});tick(g,.5,{z:-1,rise:1,fire:true,trigger:true,interact:true});
 assert.ok(g.spectator.z<10&&g.spectator.y>2);assert.deepEqual(g.player,corpse);assert.deepEqual(g.ammo[0],ammo);assert.equal(g.bomb,null);assert.equal(g.events.some(e=>e.type==='shot'),false);
 g.paused=true;const snapshot={...g.spectator};tick(g,1,{x:1,rise:1});assert.deepEqual(g.spectator,snapshot);
 g.paused=false;g.setSpectatorMode('follow');tick(g,.5,{x:1});assert.equal(g.spectator.x,snapshot.x);g.beginRound();assert.equal(g.spectator.mode,'follow');assert.equal(g.player.dead,false);
});
test('free camera remains within the map and height bounds; living players cannot enter it',()=>{
 const g=live();g.setSpectatorMode('free');assert.equal(g.spectator.mode,'follow');g.player.dead=true;
 const high=MAP.bounds.max[1]+5,low=MAP.bounds.min[1]+.65;g.setSpectatorMode('free',{x:MAP.size/2,y:high,z:MAP.size/2,yaw:0,pitch:0});tick(g,1,{x:1,z:1,rise:1});assert.equal(g.spectator.x,MAP.size/2);assert.equal(g.spectator.z,MAP.size/2);assert.equal(g.spectator.y,high);
 tick(g,7,{rise:-1});assert.equal(g.spectator.y,low);
});
test('round result locks combat but permits movement for exactly three seconds before resetting',()=>{
 const g=live();g.endRound('attack','test');const oldX=g.player.x,oldRound=g.round,time=g.time,ammo={...g.ammo[0]};g.events=[];
 tick(g,2.98,{x:1,fire:true,trigger:true,interact:true});assert.equal(g.phase,'over');assert.ok(g.player.x>oldX);assert.equal(g.time,time);assert.deepEqual(g.ammo[0],ammo);assert.equal(g.events.some(e=>e.type==='shot'),false);assert.equal(g.score.attack,1);
 tick(g,.02,{x:1});assert.equal(g.phase,'ready');assert.equal(g.round,oldRound+1);assert.equal(g.player.x,oldX);assert.equal(g.player.hp,100);
});
test('round-end movement still respects collision and pause while dead players can fly until reset',()=>{
 const g=live();g.endRound('defend','test');
 Object.assign(g.player,warehouseNorth,{yaw:0});tick(g,.8,{z:-1});assert.ok(g.player.z>warehouse.z);assert.equal(blocked(g.player.x,g.player.z,.4,g.player.y),false);g.paused=true;const x=g.player.x,t=g.phaseTime;tick(g,1,{x:-1});assert.equal(g.player.x,x);assert.equal(g.phaseTime,t);
 g.paused=false;g.player.dead=true;g.setSpectatorMode('free');const z=g.spectator.z;tick(g,.5,{z:-1});assert.ok(g.spectator.z<z);tick(g,2);assert.equal(g.spectator.mode,'follow');
});
