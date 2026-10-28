import {Game} from './game.js';
import {WEAPONS} from './catalog.js';

export function serverAddress(value,location=globalThis.location){
  const fallback=location?.protocol==='https:'?`wss://${location.host}/rooms`:location?.protocol==='http:'?`ws://${location.hostname}:${location.port==='4173'?'8787':location.port||'80'}/rooms`:'';
  let text=String(value||fallback).trim();if(!text)throw new Error('请填写联机服务器地址');
  if(!/^[a-z]+:\/\//i.test(text))text='wss://'+text;
  const url=new URL(text);if(!['http:','https:','ws:','wss:'].includes(url.protocol)||url.username||url.password)throw new Error('请填写有效的 HTTP / WebSocket 地址');
  url.protocol=['https:','wss:'].includes(url.protocol)?'wss:':'ws:';if(url.pathname==='/')url.pathname='/rooms';url.hash='';url.search='';
  if(location?.protocol==='https:'&&url.protocol==='ws:')throw new Error('HTTPS 页面需要使用 wss:// 安全连接');
  return url.href;
}

export class RoomConnection {
  constructor(callbacks={}){this.callbacks=callbacks;this.room=null;this.self=null;}
  connect(address){
    this.close();
    return new Promise((resolve,reject)=>{
      const ws=this.socket=new WebSocket(serverAddress(address));let opened=false;
      const timeout=setTimeout(()=>{reject(new Error('连接超时，请检查服务器地址及网络'));ws.close();},8000);
      ws.onopen=()=>{clearTimeout(timeout);if(this.socket!==ws){ws.close();reject(new Error('连接已取消'));return;}opened=true;this.lastMessage=performance.now();this.heartbeat=setInterval(()=>{if(performance.now()-this.lastMessage>20000){ws.close();return;}this.send({type:'ping',time:performance.now()});},5000);resolve();};
      ws.onerror=()=>{clearTimeout(timeout);if(!opened)reject(new Error('无法连接服务器，请检查地址、端口和网络'));};
      ws.onclose=()=>{clearTimeout(timeout);if(!opened)reject(new Error('服务器连接已关闭'));if(this.socket!==ws)return;clearInterval(this.heartbeat);this.socket=null;const hadRoom=this.room;this.room=null;if(hadRoom)this.callbacks.disconnected?.();};
      ws.onmessage=event=>{
        this.lastMessage=performance.now();let m;try{m=JSON.parse(event.data);}catch{return;}
        if(m.type==='room'){this.room=m.room;this.self=m.self;this.callbacks.room?.(m.room);}
        if(m.type==='start')this.callbacks.start?.(m.snapshot);
        if(m.type==='snapshot')this.callbacks.snapshot?.(m.snapshot);
        if(m.type==='error')this.callbacks.error?.(m.message);
        if(m.type==='pong')this.latency=Math.round(performance.now()-m.time);
      };
    });
  }
  send(message){if(this.socket?.readyState===WebSocket.OPEN)this.socket.send(JSON.stringify(message));}
  close(){clearInterval(this.heartbeat);const old=this.socket;this.socket=null;this.room=null;this.self=null;if(old)old.close();}
}

// Rendering and controls use the same interface as solo Game, but only the
// server advances combat. Local interpolation never resolves hits or damage.
export class NetworkGame extends Game {
  constructor(snapshot,send){super(snapshot.profile);this.events=[];this.online=true;this.send=send;this.sendClock=0;this.pendingTrigger=false;this.targets=new Map();this.applySnapshot(snapshot,true);}
  applySnapshot(snapshot,initial=false){
    if(!snapshot)return;const old=this.player,oldBots=this.bots,roundChanged=initial||snapshot.round!==this.round,oldSlot=this.slot,aim=this.aim;
    const {events=[],player,bots,...state}=snapshot;Object.assign(this,state);
    const previous=new Map([old,...oldBots].map(a=>[a.id,a]));
    const smooth=a=>{const p=previous.get(a.id);this.targets.set(a.id,{x:a.x,y:a.y,z:a.z});return !roundChanged&&p&&Math.hypot(a.x-p.x,a.z-p.z)<4?{...a,x:p.x,y:p.y,z:p.z}:a;};
    this.player=smooth(player);this.bots=bots.map(smooth);
    if(!roundChanged){this.player.yaw=old.yaw;this.player.pitch=old.pitch;this.aim=this.player.dead||oldSlot!==this.slot?false:aim;}
    else this.spectator={mode:'follow',x:player.x,y:player.y+2,z:player.z,yaw:player.yaw,pitch:0};
    for(const e of events){
      if(e.type==='reload'&&e.weapon===this.weapon.id&&this.weapon.scoped)this.aim=false;
      // Initial/new-round snapshots already contain the authoritative pitch.
      // Later events use the firing-time kick, independent of a late ADS toggle.
      if(!roundChanged&&e.type==='shot'&&!this.player.dead){const w=WEAPONS[e.weapon];if(w){const recoil=Number.isFinite(e.recoil)&&e.recoil>=0&&e.recoil<=w.recoil?e.recoil:w.recoil*(this.aim?.65:1);this.player.pitch=Math.min(1.2,this.player.pitch+recoil);}}
      this.events.push(e);
      // Corpse splashes are visual only. Trace the rendered pose against the
      // server-confirmed shot, never accept client hit reports as damage.
      if((e.type==='shot'||e.type==='botShot')&&this.traceCorpses){
        const vector=e.dir??e.to.map((n,i)=>n-e.origin[i]),length=Math.hypot(...vector),dir=vector.map(n=>n/length),distance=e.distance??length;
        if(length>0)for(const hit of this.traceCorpses(e.origin,dir,distance)||[]){
          const actor=[this.player,...this.bots].find(a=>a.id===hit.id);
          if(actor?.dead&&!events.some(event=>event.type==='kill'&&event.id===actor.id))this.events.push({type:'corpseHit',id:actor.id,team:actor.team,character:actor.character,attacker:e.type==='shot'?0:e.id,weapon:e.weapon,position:hit.position,direction:dir,melee:WEAPONS[e.weapon]?.slot==='melee',corpse:true});
        }
      }
    }
  }
  update(dt,input){
    this.sendClock+=dt;this.pendingTrigger||=!!input.trigger&&!this.paused;
    if(this.sendClock>=1/30){this.sendClock=0;this.sendInput(this.paused?{}:{...input,trigger:this.pendingTrigger});this.pendingTrigger=false;}
    for(const a of [this.player,...this.bots]){const t=this.targets.get(a.id);if(t)for(const axis of ['x','y','z'])a[axis]+=(t[axis]-a[axis])*Math.min(1,dt*22);}
    if(!this.paused)this.updateSpectator(dt,input);
  }
  sendInput(input={}){this.send({type:'input',input:{...input,yaw:this.player.yaw,pitch:this.player.pitch,aim:this.aim}});}
  stopInput(){this.pendingTrigger=false;this.sendInput();}
  command(action,value){if(!this.paused)this.send({type:'command',action,value});}
  jump(){if(!this.player.dead)this.command('jump');}
  reload(){if(!this.canReload)return false;if(this.weapon.scoped)this.aim=false;this.command('reload');return true;}
  switchWeapon(slot){this.command('switch',slot);}
  selectBackpack(index){if(!this.canSelectBackpack)return false;this.command('backpack',index);return true;}
}
