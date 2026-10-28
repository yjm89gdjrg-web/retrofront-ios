import test from 'node:test';
import assert from 'node:assert/strict';
import {SpatialAudioField,soundDirection} from '../src/spatial-audio.js';
import {MovementSounds} from '../src/movement-sounds.js';
import {Audio} from '../src/audio.js';

class Param {constructor(value=0){this.value=value;}setValueAtTime(value){this.value=value;}linearRampToValueAtTime(value){this.value=value;}exponentialRampToValueAtTime(value){this.value=value;}cancelScheduledValues(){}}
class Node {constructor(){this.connections=[];}connect(node){this.connections.push(node);}disconnect(){this.disconnected=true;}}
class Source extends Node {constructor(){super();this.playbackRate=new Param(1);this.frequency=new Param();}start(){this.started=true;}stop(){this.stopped=true;}end(){this.onended?.();}}
class Context {
 constructor(){this.currentTime=0;this.sampleRate=8000;this.state='running';this.destination=new Node();this.sources=[];this.buffers=[];}
 createGain(){const n=new Node();n.gain=new Param(1);return n;}
 createBiquadFilter(){const n=new Node();n.frequency=new Param();return n;}
 createStereoPanner(){const n=new Node();n.pan=new Param();return n;}
 createBufferSource(){const n=new Source();this.sources.push(n);return n;}
 createOscillator(){return this.createBufferSource();}
 createBuffer(channels,length){const data=new Float32Array(length),buffer={getChannelData:()=>data};this.buffers.push(buffer);return buffer;}
 decodeAudioData(buffer){return Promise.resolve(buffer);}
 resume(){this.state='running';return Promise.resolve();}suspend(){this.state='suspended';return Promise.resolve();}
}
async function audioFixture(options={}){
 const context=new Context(),audio=new Audio({sounds:{'ak47_fire.wav':'ak','death_female.wav':'death'},decodeBase64:v=>v,createContext:()=>context,trace:()=>Infinity,...options});
 await audio.unlock();await audio.ready;audio.setScene('game');audio.setListener([0,1.6,0],0);return {audio,context};
}
const actor=(id=0)=>({id,x:0,y:0,z:0,grounded:true,dead:false});
const game=()=>({round:1,phase:'live',paused:false,player:actor(),bots:[]});

test('stereo bearings follow gameplay yaw and invalid coordinates stay finite',()=>{
 assert.equal(soundDirection([10,0,0],[0,0,0],0).pan,1);
 assert.equal(soundDirection([-10,0,0],[0,0,0],0).pan,-1);
 assert.ok(Math.abs(soundDirection([0,0,-10],[0,0,0],Math.PI/2).pan+1)<1e-12);
 assert.equal(soundDirection([10,0,0],[0,0,0],Math.PI).pan,-1);
 assert.equal(soundDirection([0,0,0],[0,0,0]).pan,0);
 assert.equal(soundDirection([55,0,0],[0,0,0]).gain,0);
 assert.ok(Number.isFinite(soundDirection([10,0,0],[0,0,0],NaN).pan));
 assert.deepEqual(soundDirection([NaN,0,0],[0,0,0]),{pan:0,distance:0,gain:1});
});

test('wall queries are cached, limited per time slice, and evicted after long travel',()=>{
 let time=0,rays=0,blocked=true;const field=new SpatialAudioField({trace:()=>{rays++;return blocked?1:Infinity;},now:()=>time,cacheLimit:4,raysPerFrame:2});field.setListener([0,1.6,0]);
 const hit=field.parameters([10,1.6,0]);assert.equal(hit.blocked,true);assert.equal(hit.cutoff,1150);assert.equal(hit.wallGain,.38);
 for(let i=0;i<50;i++)field.parameters([10,1.6,0]);assert.equal(rays,1);
 for(let i=20;i<30;i++)field.parameters([i,1.6,0]);assert.equal(rays,2);
 time=.2;blocked=false;assert.equal(field.parameters([10,1.6,0]).blocked,false);
 for(let i=0;i<100;i++){time+=.2;field.parameters([i%40+2,1.6,i%3]);}assert.ok(field.cache.size<=4);
});

test('remote gun tails use actual stereo/lowpass nodes and update while the listener turns',async()=>{
 let time=0,wall=true;const {audio}=await audioFixture({trace:()=>wall?1:Infinity,now:()=>time});
 audio.event({type:'botShot',weapon:'ak',origin:[10,1.6,0],listenerPosition:[0,1.6,0],listenerYaw:0});
 const source=audio.pending[0],state=source.cfSpatial;assert.equal(state.panner.pan.value,1);assert.equal(state.filter.frequency.value,1150);assert.equal(state.gain.gain.value,.38);
 audio.setListener([0,1.6,0],Math.PI);assert.equal(state.panner.pan.value,-1);
 time=.2;wall=false;audio.setListener([0,1.6,0],0);assert.equal(state.filter.frequency.value,18000);assert.equal(state.gain.gain.value,1);
 audio.setListener([100,1.6,0],0);assert.equal(state.gain.gain.value,0);
 const nodes=[source,...source.connections,state.gain,state.filter,state.panner];audio.cancelSamples();assert.equal(audio.pending.length,0);assert.ok(nodes.every(n=>n.disconnected));source.end();assert.equal(audio.pending.length,0);
});

test('personal gun/announcement stay centered and inaudible remote guns allocate no voice',async()=>{
 const {audio,context}=await audioFixture();audio.event({type:'shot',weapon:'ak'});assert.equal(audio.pending[0].cfSpatial,undefined);
 const count=context.sources.length;audio.event({type:'botShot',weapon:'ak',origin:[60,1.6,0],listenerPosition:[0,1.6,0]});assert.equal(context.sources.length,count);
 audio.event({type:'kill',id:2,character:'fox',position:[-10,1.6,0],listenerPosition:[0,1.6,0]});assert.equal(audio.pending.at(-1).cfSpatial.panner.pan.value,-1);
});

test('spatial voice budget replaces old footsteps and mute/pause releases every node',async()=>{
 const {audio}=await audioFixture();audio.movementSound({type:'footstep',id:1,position:[3,.12,0],strength:1});const first=audio.pending[0];
 for(let i=0;i<45;i++)audio.event({type:'botShot',weapon:'ak',origin:[10,1.6,0],listenerPosition:[0,1.6,0]});
 assert.equal(audio.pending.filter(s=>s.cfSpatial).length,24);assert.ok(first.stopped&&first.disconnected);
 const playing=[...audio.pending];await audio.setSuspended(true);assert.equal(audio.pending.length,0);assert.ok(playing.every(s=>s.stopped&&s.disconnected));
 await audio.setSuspended(false);assert.equal(audio.pending.length,0);await audio.setEnabled(false);audio.movementSound({type:'land',id:1,position:[0,0,0]});assert.equal(audio.pending.length,0);
});

test('walking cadence depends on distance and standing/separation jitter stays silent',()=>{
 const movement=new MovementSounds(),g=game();movement.update(g,.02);let sounds=[];
 for(let i=0;i<100;i++){g.player.x+=.08;sounds.push(...movement.update(g,.02));}assert.equal(sounds.length,4);assert.ok(sounds.every(e=>e.type==='footstep'));assert.deepEqual(sounds.map(e=>e.foot),[1,0,1,0]);
 for(let i=0;i<100;i++){g.player.x+=.002;assert.deepEqual(movement.update(g,.02),[]);}
});

test('airborne movement makes no steps and one confirmed landing follows a jump',()=>{
 const movement=new MovementSounds(),g=game();movement.update(g,.02);g.player.grounded=false;
 for(let i=0;i<20;i++){g.player.x+=.08;g.player.y=Math.sin((i+1)/20*Math.PI);assert.deepEqual(movement.update(g,.02),[]);}
 g.player.y=0;g.player.grounded=true;const sounds=movement.update(g,.02);assert.equal(sounds.length,1);assert.equal(sounds[0].type,'land');assert.deepEqual(movement.update(g,.02),[]);
});

test('round, pause, teleport, long frame and death discard stale movement without a burst',()=>{
 const movement=new MovementSounds(),g=game();movement.update(g,.02);
 for(const action of [()=>g.paused=true,()=>{g.paused=false;g.round++;},()=>g.player.x+=20,()=>g.player.dead=true]){action();assert.deepEqual(movement.update(g,.02),[]);}
 g.player.dead=false;movement.update(g,.02);g.player.x+=5;assert.deepEqual(movement.update(g,1),[]);assert.deepEqual(movement.update(g,.02),[]);
 assert.equal(movement.actors.size,1);g.player.dead=true;movement.update(g,.02);assert.equal(movement.actors.size,0);
});

test('network object replacements keep cadence while unknown bot height corrections do not invent landings',()=>{
 const movement=new MovementSounds(),g=game();g.online=true;g.bots=[{...actor(2),grounded:undefined}];movement.update(g,.02);let sounds=[];
 for(let i=0;i<30;i++){g.bots=[{...g.bots[0],x:g.bots[0].x+.08,y:i>10&&i<20?g.bots[0].y-.15:g.bots[0].y}];sounds.push(...movement.update(g,.02));}
 assert.equal(sounds.some(e=>e.type==='land'),false);
 g.player={...g.player,x:10};assert.deepEqual(movement.update(g,.02),[]);
});

test('movement synthesis is cached, nonempty, distance culled and capped per frame',async()=>{
 const {audio,context}=await audioFixture(),g=game();g.bots=Array.from({length:9},(_,i)=>({...actor(i+1),z:-3-i}));audio.updateMovement(g,.1);
 for(let i=0;i<5;i++){for(const a of [g.player,...g.bots])a.x+=.5;audio.updateMovement(g,.1);}
 assert.ok(audio.pending.length<=4);assert.ok(audio.pending.length>0);assert.ok(audio.pending.every(s=>s.cfCategory==='footstep'&&s.cfSpatial));
 audio.movementSound({type:'land',id:0,position:[0,.12,0],strength:1});audio.movementSound({type:'footstep',id:0,position:[0,.12,0],foot:0,strength:1});
 assert.equal(audio.footBuffers.size,3);for(const buffer of audio.footBuffers.values())assert.ok(buffer.getChannelData(0).some(n=>n!==0));
 const count=context.sources.length;audio.movementSound({type:'footstep',id:9,position:[100,0,0]});assert.equal(context.sources.length,count);
 audio.event({type:'kill',id:0,character:'fox'});assert.ok(audio.pending.every(s=>s.cfActorId!==0));
 audio.setScene('menu');assert.equal(audio.pending.length,0);assert.equal(audio.movement.actors.size,0);
});
