import test from 'node:test';
import assert from 'node:assert/strict';
import {Audio} from '../src/audio.js';
import {CF_SOUNDS} from '../src/generated/cf-sounds.js';
import {WEAPONS} from '../src/catalog.js';

const deferred=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};};
class Param {
  constructor(value=0){this.value=value;this.events=[];}
  setValueAtTime(value,time){this.value=value;this.events.push(['set',value,time]);}
  linearRampToValueAtTime(value,time){this.value=value;this.events.push(['linear',value,time]);}
  exponentialRampToValueAtTime(value,time){this.value=value;this.events.push(['exponential',value,time]);}
  cancelScheduledValues(time){this.events.push(['cancel',time]);}
}
class Node {
  constructor(){this.connections=[];this.disconnected=false;}
  connect(node){this.connections.push(node);}
  disconnect(){this.disconnected=true;}
}
class Source extends Node {
  constructor(context,oscillator=false){super();this.context=context;this.oscillator=oscillator;this.loop=false;this.playbackRate=new Param(1);this.frequency=new Param();this.stops=[];}
  start(time=this.context.currentTime){this.startTime=time;this.started=true;}
  stop(time=this.context.currentTime){this.stops.push(time);}
  end(){this.onended?.();}
}
class Context {
  constructor(){this.state='suspended';this.currentTime=10;this.sampleRate=8000;this.destination=new Node();this.sources=[];this.gains=[];this.decoding=new Map();this.resumeCalls=0;this.suspendCalls=0;}
  createGain(){const node=new Node();node.gain=new Param(1);this.gains.push(node);return node;}
  createBufferSource(){const source=new Source(this);this.sources.push(source);return source;}
  createOscillator(){const source=new Source(this,true);this.sources.push(source);return source;}
  createBiquadFilter(){const node=new Node();node.frequency=new Param();return node;}
  createStereoPanner(){const node=new Node();node.pan=new Param();return node;}
  createBuffer(channels,length){return {getChannelData:()=>new Float32Array(length)};}
  decodeAudioData(name){const item=deferred();this.decoding.set(name,item);return item.promise;}
  decode(name){const buffer={name};this.decoding.get(name).resolve(buffer);return buffer;}
  async resume(){this.resumeCalls++;if(this.resumeGate)await this.resumeGate.promise;if(this.failResume)throw Error('gesture required');this.state='running';}
  async suspend(){this.suspendCalls++;this.state='suspended';}
}
const names=['lobby_bgm.mp3','ui_click.wav','death_male.wav','death_female.wav','m4a1_unsil-1.wav','ak47_fire.wav','ak47_clipout.wav','ak47_clipin.wav','ak47_boltpull.wav'];
function fixture(selected=names){
  const context=new Context();let constructed=0;
  const audio=new Audio({sounds:Object.fromEntries(selected.map(n=>[n,n])),createContext:()=>{constructed++;return context;},decodeBase64:name=>name});
  return {audio,context,constructed:()=>constructed};
}
const settle=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};
async function decodedFixture(selected=names){const f=fixture(selected);await f.audio.unlock();for(const name of selected)f.context.decode(name);await f.audio.ready;return f;}
const loops=context=>context.sources.filter(s=>s.loop&&s.started);

test('Yun uses seven dedicated voice clips only for personal kills and respects pause and mute',async()=>{
 const voices=['kill_1','kill_2','kill_3','kill_4','kill_5','headshot','knife'];const selected=[...voices.map(v=>`yun_${v}.mp3`),'reward_female_kill_1.wav','death_female.wav'];const {audio,context}=await decodedFixture(selected);audio.setScene('game');
 for(const voice of voices){audio.event({type:'kill',id:3,killer:0,character:'omoh',reward:{character:'yun',gender:'female',voice,tier:1}});assert.equal(audio.pending.filter(s=>s.cfCategory==='announcer').length,1);assert.equal(audio.pending.find(s=>s.cfCategory==='announcer').buffer.name,`yun_${voice}.mp3`);}
 audio.cancelSamples();audio.event({type:'kill',id:3,killer:2,character:'omoh'});assert.equal(audio.pending.some(s=>s.cfCategory==='announcer'),false);
 audio.killReward({character:'fox',gender:'female',voice:'kill_1',tier:1});assert.equal(audio.pending.find(s=>s.cfCategory==='announcer').buffer.name,'reward_female_kill_1.wav');
 audio.cancelSamples();audio.event({type:'kill',id:0,character:'yun'});assert.equal(audio.pending.find(s=>s.cfCategory==='death').buffer.name,'death_female.wav');
 await audio.setSuspended(true);let count=context.sources.length;audio.killReward({character:'yun',voice:'kill_3'});assert.equal(context.sources.length,count);assert.equal(audio.pending.length,0);await audio.setSuspended(false);await audio.setEnabled(false);count=context.sources.length;audio.killReward({character:'yun',voice:'kill_2'});assert.equal(context.sources.length,count);
});

test('personal kill rewards select all five male/female tiers and replace the previous announcement',async()=>{
 const selected=['male','female'].flatMap(g=>['kill_1','kill_2','kill_3','kill_4','kill_5','headshot','knife'].map(k=>`reward_${g}_${k}.wav`));
 const {audio,context}=await decodedFixture(selected);audio.setScene('game');
 let previous;
 for(const gender of ['male','female'])for(const voice of ['kill_1','kill_2','kill_3','kill_4','kill_5','headshot','knife']){
  audio.event({type:'kill',id:3,killer:0,position:[100,0,0],listenerPosition:[0,0,0],reward:{gender,voice,tier:5}});
  const current=audio.pending.find(s=>s.cfCategory==='announcer');assert.equal(current.buffer.name,`reward_${gender}_${voice}.wav`);if(previous)assert.ok(previous.stops.length);previous=current;
  assert.equal(audio.pending.filter(s=>s.cfCategory==='announcer').length,1);
 }
 audio.event({type:'roundEnd'});assert.equal(previous.stops.length,0,'round-end must not cut off the final kill announcement');
 audio.event({type:'round'});assert.ok(previous.stops.length);assert.equal(audio.pending.length,0);
 const count=context.sources.length;await audio.setEnabled(false);audio.killReward({gender:'male',voice:'kill_5',tier:5});assert.equal(context.sources.length,count);
 await audio.setEnabled(true);audio.killReward({gender:'female',voice:'kill_4',tier:4});const playing=audio.pending[0];await audio.setSuspended(true);assert.ok(playing.stops.length);
 await audio.setSuspended(false);assert.equal(audio.pending.length,0,'resume must not replay old announcements');
});

test('all fourteen weapons draw with samples and fast switching cancels previous reload and draw sounds',async()=>{
 const {audio,context}=await decodedFixture(Object.keys(CF_SOUNDS));audio.setScene('game');
 for(const id of Object.keys(WEAPONS)){
  audio.event({type:'reload',weapon:'ak',duration:2.5});const previous=[...audio.pending];const count=context.sources.length;
  audio.event({type:'switch',weapon:id,duration:.35});assert.ok(previous.every(s=>s.stops.length>0),id);const added=context.sources.slice(count);assert.ok(added.length>0,id);assert.ok(added.every(s=>!s.oscillator&&s.buffer?.name),`${id}: must use a recorded sample`);
  assert.ok(added.every(s=>s.startTime>=context.currentTime&&s.startTime<=context.currentTime+.35),id);
 }
 await audio.setSuspended(true);assert.equal(audio.pending.length,0);const count=context.sources.length;audio.event({type:'switch',weapon:'shovel'});assert.equal(context.sources.length,count);
});

test('menu music waits for decoding and one trusted unlock creates only one loop',async()=>{
  const {audio,context,constructed}=fixture(['lobby_bgm.mp3']);
  assert.equal(context.sources.length,0);const unlocked=audio.unlock();assert.equal(context.resumeCalls,1);await unlocked;assert.equal(loops(context).length,0);
  context.decode('lobby_bgm.mp3');await audio.ready;const source=audio.music.source;
  await audio.unlock();audio.setScene('menu');audio.setMusicEnabled(true);await audio.setSuspended(false);
  assert.equal(constructed(),1);assert.equal(loops(context).length,1);assert.equal(audio.music.source,source);
  assert.equal(source.connections[0].connections[0],audio.musicGain);
  assert.ok(audio.musicGain.gain.value<audio.effectGain.gain.value);
});

test('late music decoding respects gameplay and a quick lobby return cannot stack fading loops',async()=>{
  const {audio,context}=fixture(['lobby_bgm.mp3']);await audio.unlock();audio.setScene('game');
  context.decode('lobby_bgm.mp3');await audio.ready;assert.equal(loops(context).length,0);
  audio.setScene('menu');const old=audio.music;audio.setScene('game');
  assert.equal(old.stopping,true);assert.equal(old.source.stops[0],10.15);
  audio.setScene('menu');const current=audio.music;
  assert.notEqual(current,old);assert.equal(old.source.stops.at(-1),10);
  old.source.end();assert.equal(audio.music,current);
  audio.setScene('menu');assert.equal(loops(context).length,2);
});

test('decoding while muted or backgrounded never starts music, and settings resume a single loop',async()=>{
  const {audio,context}=fixture(['lobby_bgm.mp3','ui_click.wav']);await audio.unlock();
  await audio.setEnabled(false);await audio.setSuspended(true);
  for(const name of ['lobby_bgm.mp3','ui_click.wav'])context.decode(name);await audio.ready;
  assert.equal(loops(context).length,0);await audio.setEnabled(true);assert.equal(loops(context).length,0);
  await audio.setSuspended(false);assert.equal(loops(context).length,1);
  const music=audio.music.source;audio.setMusicEnabled(false);assert.equal(music.stops.at(-1),10);
  audio.click();assert.equal(audio.pending[0].buffer.name,'ui_click.wav');assert.equal(audio.pending[0].connections[0].gain.value,.8);
  audio.setMusicEnabled(true);audio.setMusicEnabled(true);assert.equal(loops(context).length,2);
  await audio.setEnabled(false);assert.equal(audio.pending.length,0);assert.equal(audio.music,null);
});

test('mute and pause cancel all delayed reload sources without replaying them on resume',async()=>{
  const {audio,context}=await decodedFixture();audio.setScene('game');audio.event({type:'reload',weapon:'ak',duration:2});
  const scheduled=[...audio.pending];assert.deepEqual(scheduled.map(s=>s.startTime),[10.1,11.1,11.7]);
  await audio.setSuspended(true);assert.ok(scheduled.every(s=>s.stops.at(-1)===10));assert.equal(audio.pending.length,0);
  const count=context.sources.length;audio.event({type:'reload',weapon:'ak',duration:2});assert.equal(context.sources.length,count);
  await audio.setSuspended(false);assert.equal(audio.pending.length,0);
  audio.event({type:'reload',weapon:'ak',duration:2});const reloaded=[...audio.pending];
  await audio.setEnabled(false);assert.ok(reloaded.every(s=>s.stops.at(-1)===10));
  await audio.setEnabled(true);assert.equal(audio.pending.length,0);
});

test('death dispatch chooses male/female voices, attenuates bots, and survives immediate round end',async()=>{
  const {audio}=await decodedFixture();audio.setScene('game');
  audio.event({type:'kill',id:0,character:'omoh',position:[40,0,0],listenerPosition:[0,0,0]});
  const male=audio.pending.at(-1);assert.equal(male.buffer.name,'death_male.wav');assert.equal(male.connections[0].gain.value,.65);
  audio.event({type:'kill',id:2,character:'fox',position:[26,0,0],listenerPosition:[0,0,0]});
  const female=audio.pending.at(-1);assert.equal(female.buffer.name,'death_female.wav');assert.ok(Math.abs(female.connections[0].gain.value-.08)<1e-8);
  audio.event({type:'roundEnd'});assert.equal(male.stops.length,0);assert.equal(female.stops.length,0);
  const count=audio.pending.length;audio.event({type:'kill',id:3,character:'star',position:[60,0,0],listenerPosition:[0,0,0]});
  assert.equal(audio.pending.length,count);
  audio.event({type:'round'});assert.equal(audio.pending.length,0);assert.equal(male.stops.at(-1),10);
});

test('player death cancels a queued reload while AK and distant bot shots use sampled effects',async()=>{
  const {audio}=await decodedFixture();audio.setScene('game');audio.event({type:'reload',weapon:'ak',duration:2});const reload=[...audio.pending];
  audio.event({type:'kill',id:0,character:'star'});assert.ok(reload.every(s=>s.stops.at(-1)===10));
  assert.equal(audio.pending.at(-1).buffer.name,'death_female.wav');
  audio.event({type:'shot',weapon:'ak'});const shot=audio.pending.at(-1);assert.equal(shot.buffer.name,'ak47_fire.wav');
  audio.event({type:'botShot',weapon:'ak',origin:[26,0,0],listenerPosition:[0,0,0]});
  const far=audio.pending.at(-1);assert.ok(far.connections[0].gain.value<shot.connections[0].gain.value);
});

test('missing samples use short UI/death fallbacks and every generated source is cancellable',async()=>{
  const {audio,context}=await decodedFixture([]);audio.click('back');audio.event({type:'kill',id:0,character:'fox'});
  assert.ok(audio.pending.some(s=>s.cfCategory==='ui'));assert.ok(audio.pending.some(s=>s.cfCategory==='death'));
  const sources=[...audio.pending];await audio.setEnabled(false);assert.equal(audio.pending.length,0);
  assert.ok(sources.every(s=>s.stops.at(-1)===10));const count=context.sources.length;
  audio.click();audio.event({type:'kill',id:0});assert.equal(context.sources.length,count);
});

test('suspend/resume changes during a pending unlock finish in the current state without duplicate music',async()=>{
  const {audio,context}=fixture(['lobby_bgm.mp3']);context.resumeGate=deferred();const first=audio.unlock();await settle();
  context.decode('lobby_bgm.mp3');await audio.ready;const pause=audio.setSuspended(true),resume=audio.setSuspended(false);
  assert.equal(loops(context).length,0);context.resumeGate.resolve();await Promise.all([first,pause,resume]);
  assert.equal(context.state,'running');assert.equal(loops(context).length,1);
  const secondPause=audio.setSuspended(true);await secondPause;assert.equal(context.state,'suspended');assert.equal(audio.music,null);
});

test('failed resume or decoding is quiet and a later trusted unlock can recover',async()=>{
  const {audio,context}=fixture(['lobby_bgm.mp3','ui_click.wav']);context.failResume=true;await audio.unlock();
  context.decode('lobby_bgm.mp3');context.decoding.get('ui_click.wav').reject(Error('unsupported file'));await audio.ready;
  assert.equal(loops(context).length,0);context.failResume=false;await audio.unlock();assert.equal(loops(context).length,1);
  audio.click('confirm');assert.ok(audio.pending.some(s=>s.cfCategory==='ui'));
});

test('reload cancels stale draw and reload mechanics while preserving the firing tail',async()=>{
 const {audio}=await decodedFixture(Object.keys(CF_SOUNDS));audio.setScene('game');audio.event({type:'switch',weapon:'ak',duration:.35});const draw=audio.pending.filter(s=>s.cfCategory==='weapon-draw');assert.ok(draw.length>0);
 audio.event({type:'shot',weapon:'ak'});const firing=audio.pending.find(s=>s.cfCategory==='weapon'&&s.buffer?.name==='ak47_fire.wav');assert.ok(firing);
 audio.event({type:'reload',weapon:'ak',duration:2.5});const reload=audio.pending.filter(s=>s.cfCategory==='weapon-reload');assert.ok(reload.length>0);assert.ok(draw.every(s=>s.stops.length>0));assert.equal(firing.stops.length,0);
 audio.event({type:'reload',weapon:'ak',duration:2.5});assert.ok(reload.every(s=>s.stops.length>0));assert.equal(firing.stops.length,0);
 for(const event of [{type:'switch',weapon:'m4',duration:.35},{type:'roundEnd'},{type:'matchEnd'},{type:'kill',id:0,character:'omoh'}]){
  audio.event({type:'reload',weapon:'ak',duration:2.5});const mechanical=audio.pending.filter(s=>s.cfCategory==='weapon-reload');audio.event(event);assert.ok(mechanical.every(s=>s.stops.length>0),event.type);
 }
});

