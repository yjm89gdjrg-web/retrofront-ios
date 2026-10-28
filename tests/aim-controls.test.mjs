import test from 'node:test';import assert from 'node:assert/strict';
import {sanitizeProfile} from '../src/catalog.js';import {lookSensitivity,applyLook} from '../src/aim-controls.js';import {FrameMeter} from '../src/frame-meter.js';
import {toggleAim} from '../src/combat-input.js';
const state=(aim=false,scoped=false)=>({aim,weapon:{slot:'primary',scoped},player:{dead:false}});
test('legacy sensitivity saves retain their previous hip and half-speed aim feel',()=>{
 for(const sensitivity of [.3,1,1.4,2]){const p=sanitizeProfile({sensitivity});assert.equal(p.sensitivity,sensitivity);assert.equal(p.aimSensitivity,sensitivity*.5);assert.equal(p.scopeSensitivity,sensitivity*.5);assert.equal(p.showFPS,false);}
});
test('hip, aimed and sniper speeds stay independent and persist through profile sanitizing',()=>{
 const p=sanitizeProfile({sensitivity:1.4,aimSensitivity:.4,scopeSensitivity:.2,showFPS:true}),again=sanitizeProfile(JSON.parse(JSON.stringify(p)));
 assert.equal(lookSensitivity(again,state()),1.4);assert.equal(lookSensitivity(again,state(true)),.4);assert.equal(lookSensitivity(again,state(true,true)),.2);assert.equal(again.showFPS,true);
 const dead=state(true,true);dead.player.dead=true;assert.equal(lookSensitivity(again,dead),1.4);
 const knife=state(true);knife.weapon.slot='melee';assert.equal(lookSensitivity(again,knife),1.4);
});
test('invalid settings cannot create a zero-speed, inverted or non-finite view',()=>{
 const p=sanitizeProfile({sensitivity:Infinity,aimSensitivity:-10,scopeSensitivity:999,showFPS:'true'});assert.equal(p.sensitivity,1);assert.equal(p.aimSensitivity,.15);assert.equal(p.scopeSensitivity,2);assert.equal(p.showFPS,false);
 const target={yaw:0,pitch:0};assert.equal(applyLook(target,100,-20,.5),true);assert.ok(Math.abs(target.yaw-.165)<1e-12);assert.ok(Math.abs(target.pitch-.033)<1e-12);
 const before={...target};assert.equal(applyLook(target,NaN,0,1),false);assert.deepEqual(target,before);applyLook(target,0,-100000,1);assert.equal(target.pitch,1.25);applyLook(target,0,100000,1);assert.equal(target.pitch,-1.25);
});
test('frame meter counts actual completed draws and resets after background gaps',()=>{
 const meter=new FrameMeter();assert.equal(meter.sample(0,0),null);assert.equal(meter.sample(500,30),null);assert.equal(meter.sample(1000,60),60);assert.equal(meter.sample(2000,75),15);
 assert.equal(meter.sample(20000,76),null);assert.equal(meter.sample(21000,136),60);meter.reset();assert.equal(meter.sample(22000,137),null);assert.equal(meter.sample(23000,197),60);
});
test('sniper reload cannot be hidden by re-opening aim while other rifle aim remains available',()=>{
 const sniper={...state(false,true),phase:'live',paused:false,reloading:2};assert.equal(toggleAim(sniper),false);assert.equal(sniper.aim,false);sniper.reloading=0;assert.equal(toggleAim(sniper),true);assert.equal(sniper.aim,true);
 const rifle={...state(false),phase:'live',paused:false,reloading:2};assert.equal(toggleAim(rifle),true);assert.equal(rifle.aim,true);rifle.phase='over';assert.equal(toggleAim(rifle),false);
});
