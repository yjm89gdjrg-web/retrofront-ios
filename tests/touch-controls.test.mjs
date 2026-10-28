import test from 'node:test';import assert from 'node:assert/strict';
import {bindTouchControls} from '../src/touch-controls.js';
class Element extends EventTarget {
 constructor(){super();this.style={transform:'none'};this.captured=new Set();this.rect={left:0,top:0,width:100,height:100};}
 getBoundingClientRect(){return this.rect;}
 setPointerCapture(id){this.captured.add(id);}
 hasPointerCapture(id){return this.captured.has(id);}
 releasePointerCapture(id){this.captured.delete(id);send(this,'lostpointercapture',{pointerId:id});}
}
function send(target,type,fields={}){const event=new Event(type,{cancelable:true});for(const [key,value]of Object.entries(fields))Object.defineProperty(event,key,{value});target.dispatchEvent(event);return event;}
const touch=(id,x=50,y=50)=>({pointerType:'touch',pointerId:id,button:0,clientX:x,clientY:y,isPrimary:id===1});
function setup(){
 const input={x:0,z:0,fire:false,trigger:false},game={phase:'live',paused:false,player:{dead:false},spectator:{mode:'follow'}},elements={joystick:new Element(),stick:new Element(),lookZone:new Element(),fire:new Element()},windowTarget=new EventTarget(),documentTarget=new EventTarget(),looks=[];let audio=0,mouse=false;
 documentTarget.hidden=false;
 const controls=bindTouchControls(elements,{input,getGame:()=>game,look:(x,y)=>looks.push([x,y]),unlockAudio:()=>audio++,otherFireActive:()=>mouse,windowTarget,documentTarget});
 return {input,game,elements,windowTarget,documentTarget,looks,controls,get audio(){return audio;},setMouse(value){mouse=value;}};
}
test('movement, independent view drag and fire drag coexist under three owned touch pointers',()=>{
 const s=setup(),{joystick,lookZone,fire}=s.elements;send(joystick,'pointerdown',touch(1,50,20));send(lookZone,'pointerdown',touch(2,150,80));send(fire,'pointerdown',touch(3,250,80));
 assert.ok(s.input.z<-.9);assert.equal(s.input.fire,true);assert.equal(s.input.trigger,true);assert.equal(s.controls.firing,true);assert.equal(s.audio,3);
 send(lookZone,'pointermove',touch(2,160,85));send(fire,'pointermove',touch(3,245,90));assert.deepEqual(s.looks,[[10,5],[-5,10]]);
 send(lookZone,'pointercancel',touch(2));assert.equal(s.input.fire,true);assert.ok(s.input.z<-.9);
 send(joystick,'pointerup',touch(1));assert.equal(s.input.z,0);assert.equal(s.input.fire,true);send(fire,'pointerup',touch(3));assert.equal(s.input.fire,false);s.controls.dispose();
});
test('a second view finger cannot steal the first view or movement owner',()=>{
 const s=setup(),zone=s.elements.lookZone;send(zone,'pointerdown',touch(2,100,80));send(zone,'pointerdown',touch(4,300,300));send(zone,'pointermove',touch(4,500,500));send(zone,'pointerup',touch(4));send(zone,'pointermove',touch(2,110,90));assert.deepEqual(s.looks,[[10,10]]);assert.deepEqual([...zone.captured],[2]);
 send(s.elements.joystick,'pointerdown',touch(1,50,20));send(zone,'pointerdown',touch(1,50,20));assert.deepEqual([...zone.captured],[2]);s.controls.dispose();
});
test('lost capture only clears its matching owner and a quick release preserves a queued semi-auto tap',()=>{
 const s=setup(),{lookZone,fire}=s.elements;send(lookZone,'pointerdown',touch(2));send(fire,'pointerdown',touch(3));send(lookZone,'lostpointercapture',touch(2));assert.equal(s.input.fire,true);assert.equal(s.input.trigger,true);
 send(fire,'pointerup',touch(99));assert.equal(s.input.fire,true);send(fire,'pointerup',touch(3));assert.equal(s.input.fire,false);assert.equal(s.input.trigger,true,'release before a game frame still allows one intended tap');
 send(fire,'pointerdown',touch(4));send(fire,'pointercancel',touch(4));assert.equal(s.input.fire,false);assert.equal(s.input.trigger,false,'OS cancellation must not leave a ghost tap');s.controls.dispose();
});
test('clear, background and capture-loss sequences release all touches without leaving movement or fire latched',()=>{
 for(const reason of ['clear','blur','pagehide','resize','retrofront-pause','hidden']){
  const s=setup();send(s.elements.joystick,'pointerdown',touch(1,90,50));send(s.elements.lookZone,'pointerdown',touch(2));send(s.elements.fire,'pointerdown',touch(3));
  if(reason==='clear')s.controls.clear();else if(reason==='hidden'){s.documentTarget.hidden=true;send(s.documentTarget,'visibilitychange');}else send(s.windowTarget,reason);
  assert.deepEqual(s.input,{x:0,z:0,fire:false,trigger:false},reason);for(const element of Object.values(s.elements))assert.equal(element.captured.size,0,reason);assert.equal(s.elements.stick.style.transform,'none');s.controls.dispose();
 }
});
test('paused, dead-follow, finished, non-finite and non-left mouse or pen input cannot start gestures',()=>{
 const s=setup(),fire=s.elements.fire,zone=s.elements.lookZone;
 for(const event of [{...touch(1),clientX:NaN},{...touch(1),pointerId:NaN},{...touch(1),pointerType:'mouse'},{...touch(1),pointerType:'pen',button:2}])send(fire,'pointerdown',event);
 assert.equal(s.input.fire,false);assert.equal(fire.captured.size,0);s.game.paused=true;send(fire,'pointerdown',touch(1));assert.equal(s.input.fire,false);s.game.paused=false;s.game.player.dead=true;send(fire,'pointerdown',touch(1));send(zone,'pointerdown',touch(2));assert.equal(zone.captured.size,0);
 s.game.spectator.mode='free';send(zone,'pointerdown',touch(2,100,100));send(zone,'pointermove',touch(2,110,105));assert.deepEqual(s.looks,[[10,5]]);s.controls.clear();s.game.player.dead=false;s.game.phase='finished';send(fire,'pointerdown',touch(1));assert.equal(s.input.fire,false);s.controls.dispose();
});
test('invalid drag coordinates cannot create a camera jump or NaN movement and capture failure is safe',()=>{
 const s=setup(),zone=s.elements.lookZone;send(zone,'pointerdown',touch(2,100,100));send(zone,'pointermove',{...touch(2),clientX:Infinity});send(zone,'pointermove',touch(2,105,104));assert.deepEqual(s.looks,[[5,4]]);
 s.elements.joystick.rect.width=0;s.elements.joystick.rect.height=0;send(s.elements.joystick,'pointerdown',touch(1));assert.equal(s.input.x,0);assert.equal(s.input.z,0);assert.equal(s.elements.joystick.captured.size,0);
 s.elements.fire.setPointerCapture=()=>{throw Error('pointer already ended');};send(s.elements.fire,'pointerdown',touch(3));assert.equal(s.input.fire,false);s.controls.dispose();
});
test('touch release respects an independent mouse hold and dispose removes every binding',()=>{
 const s=setup();s.setMouse(true);send(s.elements.fire,'pointerdown',touch(3));send(s.elements.fire,'pointerup',touch(3));assert.equal(s.input.fire,true);assert.equal(s.controls.firing,false);
 s.controls.dispose();s.controls.dispose();send(s.elements.fire,'pointerdown',touch(4));send(s.elements.lookZone,'pointerdown',touch(5));assert.equal(s.input.fire,false);assert.equal(s.elements.fire.captured.size,0);
});
test('disabling a control or pausing mid-gesture releases its own input on the next move',()=>{
 const s=setup();s.elements.fire.disabled=true;send(s.elements.fire,'pointerdown',touch(3));assert.equal(s.input.fire,false);
 s.elements.fire.disabled=false;send(s.elements.fire,'pointerdown',touch(3));s.elements.fire.disabled=true;send(s.elements.fire,'pointermove',touch(3,52,52));assert.equal(s.input.fire,false);assert.equal(s.input.trigger,false);
 send(s.elements.joystick,'pointerdown',touch(1,50,20));s.game.paused=true;send(s.elements.joystick,'pointermove',touch(1,50,10));assert.equal(s.input.x,0);assert.equal(s.input.z,0);s.controls.dispose();
});
