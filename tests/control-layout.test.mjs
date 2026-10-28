import test from 'node:test';import assert from 'node:assert/strict';
import {CONTROL_SPECS,sanitizeHudLayout,controlRect} from '../src/control-layout-config.js';
import {sanitizeProfile} from '../src/catalog.js';
test('old profiles get compact controls and custom layouts survive the native profile round trip',()=>{
 const old=sanitizeProfile({primary:'ak'});assert.deepEqual(old.hudLayout,{version:1,controls:{}});
 const custom={version:1,controls:{fire:{size:48,opacity:.4,x:.85,y:.7},joystick:{size:72,x:.12,y:.75}}};
 assert.deepEqual(sanitizeProfile(JSON.parse(JSON.stringify({...old,hudLayout:custom}))).hudLayout,custom);
 assert.equal(controlRect('fire',old.hudLayout,844,390).width,64);assert.equal(controlRect('aim',old.hudLayout,844,390).width,44);
});
test('invalid saved sizes and locations cannot make controls invisible or place them outside safe bounds',()=>{
 const bad=sanitizeHudLayout({version:1,controls:{fire:{size:999,opacity:0,x:-9,y:7},aim:{size:NaN,x:Infinity,y:.3},unknown:{size:50}}});
 assert.deepEqual(bad.controls.fire,{size:128,opacity:.25,x:0,y:1});assert.deepEqual(bad.controls.aim,{});assert.equal(bad.controls.unknown,undefined);
 for(const [width,height] of [[568,320],[844,390],[1024,768],[390,844]])for(const id of Object.keys(CONTROL_SPECS)){
  const r=controlRect(id,bad,width,height,{left:44,right:24,top:8,bottom:21});assert.ok(r.x>=44&&r.y>=8);assert.ok(r.x+r.width<=width-24&&r.y+r.height<=height-21);
 }
});
