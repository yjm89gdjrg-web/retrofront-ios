import {CF_SOUNDS} from './generated/cf-sounds.js';
import {CF_WEAPON_ASSETS} from './generated/cf-weapon-assets.js';
import {traceWorld} from './map.js';
import {SpatialAudioField,validSoundPoint} from './spatial-audio.js';
import {MovementSounds} from './movement-sounds.js';

// Own every source so pausing also cancels magazine sounds scheduled for later.
export class Audio {
  constructor({sounds=CF_SOUNDS,createContext,decodeBase64,trace=traceWorld,now}={}){
    this.enabled=true;this.musicEnabled=true;this.suspended=false;this.scene='menu';
    this.context=null;this.samples={};this.pending=[];this.music=null;
    this.ready=Promise.resolve();this._contextTask=Promise.resolve();
    this._sounds=sounds;
    this.spatial=new SpatialAudioField({trace,...(now?{now}:{})});this.movement=new MovementSounds();this.footBuffers=new Map();
    this._createContext=createContext||(()=>{const Context=globalThis.window?.AudioContext||globalThis.window?.webkitAudioContext;return Context?new Context():null;});
    this._decodeBase64=decodeBase64||(base64=>Uint8Array.from(atob(base64),c=>c.charCodeAt(0)).buffer);
  }
  unlock(){
    if(!this.context){
      try{this.context=this._createContext();}catch{return Promise.resolve();}
      if(!this.context)return Promise.resolve();
      const c=this.context;
      this.effectGain=c.createGain();this.effectGain.gain.value=.8;this.effectGain.connect(c.destination);
      this.musicGain=c.createGain();this.musicGain.gain.value=.22;this.musicGain.connect(c.destination);
      this.ready=Promise.allSettled(Object.entries(this._sounds).map(async([name,base64])=>{
        const buffer=await c.decodeAudioData(this._decodeBase64(base64));this.samples[name]=buffer;
        if(name.startsWith('lobby_bgm.'))this._syncMusic();
      }));
    }
    // iOS requires this first resume call directly inside the trusted gesture.
    // The queued state check still resolves any overlapping pause or mute.
    if(this.enabled&&!this.suspended&&this.context.state!=='running'){
      try{const activation=this.context.resume();this._contextTask=Promise.allSettled([this._contextTask,activation]).then(()=>this._syncMusic());}catch{}
    }
    return this._updateContext();
  }
  _updateContext(){
    // Read current flags after earlier suspend/resume requests have completed.
    this._contextTask=this._contextTask.catch(()=>{}).then(async()=>{
      if(!this.context)return;
      try{
        if(this.enabled&&!this.suspended){if(this.context.state!=='running')await this.context.resume();}
        else if(this.context.state==='running')await this.context.suspend();
      }catch{}
      this._syncMusic();
    });
    return this._contextTask;
  }
  setScene(scene){const next=scene==='game'?'game':'menu';if(this.scene!==next){this.movement.reset();this.spatial.clear();}if(this.scene==='game'&&next==='menu')this.cancelSamples();this.scene=next;this._syncMusic();}
  setEnabled(enabled){
    this.enabled=Boolean(enabled);
    if(!this.enabled){this.cancelSamples();this._stopMusic();this.movement.reset();}
    return this.context?this._updateContext():Promise.resolve();
  }
  setMusicEnabled(enabled){this.musicEnabled=Boolean(enabled);this._syncMusic();}
  setSuspended(suspended){
    this.suspended=Boolean(suspended);
    if(this.suspended){this.cancelSamples();this._stopMusic();this.movement.reset();}
    return this.context?this._updateContext():Promise.resolve();
  }
  _canPlay(){return Boolean(this.enabled&&!this.suspended&&this.context?.state==='running');}
  _syncMusic(){
    const wanted=this._canPlay()&&this.musicEnabled&&this.scene==='menu';
    if(!wanted){this._stopMusic(this._canPlay()&&this.musicEnabled&&this.scene==='game');return;}
    if(this.music&&!this.music.stopping)return;
    const buffer=this.samples['lobby_bgm.mp3']||this.samples['lobby_bgm.ogg']||this.samples['lobby_bgm.wav'];
    if(!buffer)return;
    // Returning during a fade stops that loop before starting a new one.
    if(this.music)this._stopMusic();
    const c=this.context,source=c.createBufferSource(),gain=c.createGain(),music={source,gain,stopping:false};
    source.buffer=buffer;source.loop=true;source.connect(gain);gain.connect(this.musicGain);
    gain.gain.setValueAtTime(0,c.currentTime);gain.gain.linearRampToValueAtTime(1,c.currentTime+.3);
    source.onended=()=>{source.disconnect();gain.disconnect();if(this.music===music)this.music=null;};
    this.music=music;source.start();
  }
  _stopMusic(fade=false){
    const music=this.music;if(!music)return;if(fade&&music.stopping)return;
    const c=this.context;
    try{
      music.gain.gain.cancelScheduledValues(c.currentTime);
      if(fade){music.gain.gain.setValueAtTime(music.gain.gain.value,c.currentTime);music.gain.gain.linearRampToValueAtTime(0,c.currentTime+.15);music.source.stop(c.currentTime+.15);music.stopping=true;}
      else{music.gain.gain.setValueAtTime(0,c.currentTime);music.source.stop();if(this.music===music)this.music=null;}
    }catch{if(this.music===music)this.music=null;}
  }
  _track(source,nodes=[],category='weapon'){
    source.cfCategory=category;this.pending.push(source);
    let cleaned=false;source.cfCleanup=()=>{if(cleaned)return;cleaned=true;source.disconnect();for(const node of nodes)node.disconnect();this.pending=this.pending.filter(s=>s!==source);};source.onended=source.cfCleanup;
  }
  setListener(position,yaw=0){
    if(!this.spatial.setListener(position,yaw))return;
    // Existing short tails follow a camera turn instead of sticking to the
    // stereo side on which the shot originally started.
    for(const source of this.pending)if(source.cfSpatial)this._updateSpatial(source);
  }
  _eventSpatial(e,position){return validSoundPoint(position)?{position,listener:validSoundPoint(e?.listenerPosition)?e.listenerPosition:undefined,yaw:Number.isFinite(e?.listenerYaw)?e.listenerYaw:undefined}:null;}
  _updateSpatial(source){
    const state=source.cfSpatial,params=this.spatial.parameters(state.position);
    state.gain.gain.setValueAtTime(state.referenceGain?params.gain/state.referenceGain*params.wallGain:0,this.context.currentTime);
    state.filter.frequency.setValueAtTime(params.cutoff,this.context.currentTime);state.panner?.pan.setValueAtTime(params.pan,this.context.currentTime);state.params=params;
  }
  _route(source,gain,spatial,connect=true){
    if(connect)source.connect(gain);if(!spatial){gain.connect(this.effectGain);return [gain];}
    const c=this.context,params=this.spatial.parameters(spatial.position,spatial.listener,spatial.yaw),filter=c.createBiquadFilter(),spatialGain=c.createGain(),panner=c.createStereoPanner?.();
    filter.type='lowpass';filter.frequency.value=params.cutoff;spatialGain.gain.value=params.wallGain;
    gain.connect(spatialGain);spatialGain.connect(filter);if(panner){panner.pan.value=params.pan;filter.connect(panner);panner.connect(this.effectGain);}else filter.connect(this.effectGain);
    source.cfSpatial={position:spatial.position.slice(),gain:spatialGain,filter,panner,referenceGain:params.gain,params};
    // Keep far-away combat bounded without cutting personal weapon/announcer
    // feedback. Prefer replacing old footsteps before remote gun tails.
    const voices=this.pending.filter(s=>s.cfSpatial);if(voices.length>=24){const old=voices.find(s=>s.cfCategory==='footstep')||voices[0];try{old.stop();}catch{}old.cfCleanup?.();}
    return [gain,spatialGain,filter,...(panner?[panner]:[])];
  }
  sample(name,delay=0,volume=.35,{category='weapon',rate=1,spatial=null}={}){
    if(!this._canPlay()||!this.samples[name]||volume<=0)return false;
    const c=this.context,source=c.createBufferSource(),gain=c.createGain();
    source.buffer=this.samples[name];source.playbackRate.value=rate;gain.gain.value=volume;
    this._track(source,this._route(source,gain,spatial),category);
    source.start(c.currentTime+delay);return true;
  }
  cancelSamples(categories){
    const selected=categories?new Set(Array.isArray(categories)?categories:[categories]):null;
    const stopped=this.pending.filter(source=>!selected||selected.has(source.cfCategory));
    this.pending=this.pending.filter(source=>!stopped.includes(source));
    for(const source of stopped){try{source.stop();}catch{}source.cfCleanup?.();}
  }
  tone(freq=440,duration=.1,type='sine',volume=.08,delay=0,category='weapon',spatial=null){
    if(!this._canPlay()||volume<=0)return;
    const c=this.context,o=c.createOscillator(),g=c.createGain(),start=c.currentTime+delay;
    o.type=type;o.frequency.setValueAtTime(freq,start);g.gain.setValueAtTime(volume,start);
    g.gain.exponentialRampToValueAtTime(.001,start+duration);
    this._track(o,this._route(o,g,spatial),category);o.start(start);o.stop(start+duration);
  }
  _noise(duration,volume,frequency=1100,category='weapon',spatial=null){
    if(!this._canPlay()||volume<=0)return;
    const c=this.context,b=c.createBuffer(1,Math.floor(c.sampleRate*duration),c.sampleRate),data=b.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/data.length*6);
    const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();
    source.buffer=b;filter.type='lowpass';filter.frequency.value=frequency;gain.gain.value=volume;
    source.connect(filter);filter.connect(gain);
    this._track(source,[filter,...this._route(source,gain,spatial,false)],category);source.start();
  }
  click(kind='select'){
    const rate=kind==='confirm'?1.08:kind==='back'?.92:1;
    if(this.sample('ui_click.wav',0,.8,{category:'ui',rate}))return;
    this._noise(.025,.09,2400,'ui');this.tone(kind==='confirm'?1120:kind==='back'?720:930,.026,'triangle',.035,0,'ui');
  }
  _distanceVolume(position,listener,fallback=1){
    if(!validSoundPoint(position)||!validSoundPoint(listener))return fallback;
    const distance=Math.hypot(position[0]-listener[0],position[1]-listener[1],position[2]-listener[2]);
    return distance>=55?0:1/(1+(distance/13)**2);
  }
  shot(id,volume=1,spatial=null){
    const name=id==='m4'?'m4a1_unsil-1.wav':id==='ak'?'ak47_fire.wav':id==='knife'?'knife_swing.wav':CF_WEAPON_ASSETS[id]?.fire;
    if(name&&this.sample(name,0,.35*volume,{spatial}))return;
    this._noise(id==='awm'?.28:.12,.22*volume,id==='usp'?1900:1100,'weapon',spatial);
    this.tone(id==='awm'?70:105,.12,'triangle',.12*volume,0,'weapon',spatial);
  }
  draw(id,duration=.35){
    const meta=CF_WEAPON_ASSETS[id],events=meta?.audio.select?.length?meta.audio.select:meta?.audio.draw;
    if(events?.length){for(const event of events)this.sample(event.file,event.fraction*duration,.45,{category:'weapon-draw'});return;}
    if(this.sample(meta?.draw||id+'_draw.wav',0,.45,{category:'weapon-draw'}))return;
    this._noise(.075,.08,2600,'weapon-draw');this.tone(310,.035,'triangle',.035,.025,'weapon-draw');
  }
  death(e){
    const volume=e.id===0?1:this._distanceVolume(e.position,e.listenerPosition||this.spatial.listener,.5),spatial=e.id===0?null:this._eventSpatial(e,e.position);
    if(volume<=0)return;
    const female=['fox','star','yun'].includes(e.character),name=female?'death_female.wav':'death_male.wav';
    if(this.sample(name,0,(female?.4:.65)*volume,{category:'death',spatial}))return;
    if(!this._canPlay())return;
    const c=this.context,o=c.createOscillator(),g=c.createGain(),now=c.currentTime;
    o.type='triangle';o.frequency.setValueAtTime(female?225:120,now);o.frequency.exponentialRampToValueAtTime(female?125:65,now+.32);
    g.gain.setValueAtTime(.075*volume,now);g.gain.exponentialRampToValueAtTime(.001,now+.36);
    this._track(o,this._route(o,g,spatial),'death');o.start();o.stop(now+.36);
    this._noise(.22,.035*volume,450,'death',spatial);
  }
  _movementBuffer(kind,foot=0){
    const key=kind==='land'?'land':`step${foot?1:0}`;if(this.footBuffers.has(key))return this.footBuffers.get(key);
    const c=this.context,duration=kind==='land'?.19:.115,buffer=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate),data=buffer.getChannelData(0);
    let seed=foot?196613:524287,low=0;const pitch=kind==='land'?64:foot?104:96;
    for(let i=0;i<data.length;i++){
      const t=i/c.sampleRate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;low=low*.74+(seed/2147483648-1)*.26;
      const heel=Math.exp(-t*(kind==='land'?25:48)),toe=t>.035?Math.exp(-(t-.035)*85)*.24:0;
      data[i]=(low*.7+Math.sin(t*pitch*Math.PI*2)*.3)*(heel+toe)*Math.min(1,t*1400);
    }
    this.footBuffers.set(key,buffer);return buffer;
  }
  movementSound(e){
    if(!this._canPlay()||!validSoundPoint(e.position))return false;
    const distance=this.spatial.parameters(e.position).distance,range=e.type==='land'?40:32;if(distance>range)return false;
    const volume=this._distanceVolume(e.position,this.spatial.listener,1)*(e.type==='land'?.29:.2)*(e.id===0?.68:1)*Math.max(.35,e.strength||1);
    if(volume<.006)return false;
    const c=this.context,source=c.createBufferSource(),gain=c.createGain();source.buffer=this._movementBuffer(e.type,e.foot);gain.gain.value=volume;source.cfActorId=e.id;source.cfMovement=e.type;
    this._track(source,this._route(source,gain,this._eventSpatial(null,e.position)),'footstep');source.start();return true;
  }
  updateMovement(game,dt){
    const sounds=this.movement.update(game,dt);
    if(this.scene!=='game'||!this._canPlay())return;
    sounds.sort((a,b)=>this._distanceVolume(b.position,this.spatial.listener)-this._distanceVolume(a.position,this.spatial.listener));
    for(const sound of sounds.slice(0,4))this.movementSound(sound);
  }
  killReward(reward){
    this.cancelSamples('announcer');
    if(reward.character==='yun'&&this.sample(`yun_${reward.voice}.mp3`,0,.65,{category:'announcer'}))return;
    const name=`reward_${reward.gender}_${reward.voice}.wav`;
    if(!this.sample(name,0,.65,{category:'announcer'}))this.tone(700+reward.tier*140,.16,'triangle',.065,0,'announcer');
  }
  event(e){
    if(e.type==='kill'&&e.id===0)this.cancelSamples('announcer');
    if(e.type==='round'){this.cancelSamples();this.movement.reset();this.spatial.clear();}
    else if(['switch','roundEnd','matchEnd'].includes(e.type)||(e.type==='kill'&&e.id===0))this.cancelSamples(['weapon','weapon-draw','weapon-reload','impact']);
    if(e.type==='switch'||(e.type==='round'&&e.weapon))this.draw(e.weapon,e.duration);
    else if(e.type==='shot')this.shot(e.weapon);
    else if(e.type==='botShot')this.shot(e.weapon||'m4',this._distanceVolume(e.origin,e.listenerPosition||this.spatial.listener,.2),this._eventSpatial(e,e.origin));
    else if(e.type==='kill'){
      for(const source of [...this.pending])if(source.cfCategory==='footstep'&&source.cfActorId===e.id){try{source.stop();}catch{}source.cfCleanup?.();}
      this.death(e);if(e.killer===0&&e.reward)this.killReward(e.reward);
    }
    else if(e.type==='hit')this.tone(1150,.055,'triangle',.06,0,'impact');
    else if(e.type==='plant')this.tone(850,.35);
    else if(e.type==='roundEnd'||e.type==='matchEnd'){this.tone(440,.25,'sine',.08);this.tone(660,.4,'sine',.08,.18);}
    else if(e.type==='reload'){
      this.cancelSamples(['weapon-draw','weapon-reload']);
      const events=CF_WEAPON_ASSETS[e.weapon]?.audio.reload;
      if(events?.length){for(const event of events)this.sample(event.file,event.fraction*e.duration,.35,{category:'weapon-reload'});return;}
      const prefix=e.weapon==='m4'?'m4a1':e.weapon==='ak'?'ak47':null;
      if(prefix){this.sample(prefix+'_clipout.wav',.1,.35,{category:'weapon-reload'});this.sample(prefix+'_clipin.wav',e.duration*.55,.35,{category:'weapon-reload'});this.sample(prefix+'_boltpull.wav',e.duration*.85,.35,{category:'weapon-reload'});}
      else this.tone(220,.13,'sawtooth',.025,0,'weapon-reload');
    }
  }
}
