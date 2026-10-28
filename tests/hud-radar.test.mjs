import test from 'node:test';import assert from 'node:assert/strict';
import {MAP,blocked,clearLine} from '../src/map.js';
import {radarObserver,hiddenRadarTarget,zonePoint} from './map-fixtures.mjs';
import {Game} from '../src/game.js';import {radarContacts,radarZone,TacticalRadar} from '../src/hud-radar.js';
test('radar keeps living teammates but does not reveal enemies through buildings or outside range',()=>{
 const g=new Game();Object.assign(g.player,radarObserver);const [visible,hidden,far]=g.aliveEnemies;
 Object.assign(visible,{x:radarObserver.x,y:radarObserver.y,z:radarObserver.z+4});Object.assign(hidden,hiddenRadarTarget);Object.assign(far,{x:radarObserver.x,y:radarObserver.y,z:radarObserver.z+14});
 for(const actor of [g.player,visible,hidden,far])assert.equal(blocked(actor.x,actor.z),false);
 assert.ok(Math.hypot(hidden.x-g.player.x,hidden.z-g.player.z)<12);assert.equal(clearLine(g.player,hidden),false);assert.equal(clearLine(g.player,far),true);
 let contacts=radarContacts(g);assert.ok(contacts.includes(visible));assert.ok(!contacts.includes(hidden));assert.ok(!contacts.includes(far));assert.ok(g.aliveAllies.every(a=>contacts.includes(a)));
 visible.dead=true;assert.ok(!radarContacts(g).includes(visible));
});
test('a dead player cannot provide radar vision and spectating uses the watched teammate',()=>{
 const g=new Game();Object.assign(g.player,{...radarObserver,dead:true});Object.assign(g.aliveEnemies[0],{x:radarObserver.x,y:radarObserver.y,z:radarObserver.z+4});assert.ok(radarContacts(g).every(a=>a.team===g.player.team));
 const ally=g.aliveAllies[0];Object.assign(ally,radarObserver);assert.ok(radarContacts(g,ally).includes(g.aliveEnemies[0]));
});
test('location names follow the real bomb sites and map lanes',()=>{
 assert.equal(radarZone(MAP.sites[0]),'A 区 · 爆破点');assert.equal(radarZone(MAP.sites[1]),'B 区 · 爆破点');assert.equal(radarZone(MAP.spawn.attack),'潜伏者基地');assert.equal(radarZone(MAP.spawn.defend),'保卫者基地');assert.equal(radarZone(zonePoint('A 大道')),'A 大道');assert.equal(radarZone(zonePoint('中门')),'中门');assert.equal(radarZone(zonePoint('B 洞')),'B 洞');
});

test('unchanged radar frames skip drawing, but online movement and bomb blinking still refresh',()=>{
 let redraws=0;const context=()=>new Proxy({drawImage(){redraws++;}},{get:(object,key)=>object[key]??(()=>{})}),baseContext=context(),screenContext=context();
 const canvas={getContext:()=>screenContext,ownerDocument:{createElement:()=>({getContext:()=>baseContext})}},radar=new TacticalRadar(canvas),game=new Game();
 assert.equal(radar.draw(game),true);for(let i=0;i<100;i++)assert.equal(radar.draw(game),false);assert.equal(redraws,1);
 game.paused=true;game.bots[0].x+=.1;assert.equal(radar.draw(game),true,'online actors can move while local controls are paused');
 game.bomb={x:game.player.x,z:game.player.z,time:10};assert.equal(radar.draw(game),true);game.bomb.time=9.8;assert.equal(radar.draw(game),true,'bomb flash changes independently of actor movement');
 radar.reset();assert.equal(radar.lastGame,null);assert.equal(radar.draw(game),true,'returning to a scene redraws even if positions match');
});
