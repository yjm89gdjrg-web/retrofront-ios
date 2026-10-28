import {RoomConnection,serverAddress} from './network.js';
import {CHARACTERS} from './catalog.js';
const $=id=>document.getElementById(id);
const names={easy:'简单',normal:'标准',hard:'困难'};
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export class RoomUI {
  constructor(app){
    this.app=app;this.connection=new RoomConnection({room:()=>{if(!app.inGame())this.showRoom();},start:snapshot=>app.start(snapshot),snapshot:snapshot=>app.snapshot(snapshot),error:message=>this.status(message),disconnected:()=>{app.disconnected();app.modal('连接已断开','<p>已离开联机对局。请检查网络后重新进入房间。</p>','CONNECTION LOST');}});
  }
  status(message){const output=$('network-status');if(output)output.textContent=message;this.app.toast(message);}
  open(){
    if(this.connection.room){this.showRoom();return;}
    let settings={};try{settings=JSON.parse(localStorage.getItem('retrofront.network')||'{}');}catch{}
    let address=settings.address||'';if(!address)try{address=serverAddress('');}catch{}
    this.app.modal('联机大厅',`<form id="network-form"><div class="network-fields"><label>昵称<input id="network-name" maxlength="16" autocomplete="nickname" value="${escape(settings.name||'玩家')}"></label><label>服务器地址<input id="network-address" type="text" inputmode="url" autocapitalize="off" spellcheck="false" placeholder="wss://你的服务器/rooms" value="${escape(address)}"></label><label>房间号<input id="network-code" type="text" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" placeholder="加入朋友的 6 位房间号"></label></div><p id="network-status" role="status">当前电脑强度：${names[this.app.profile().difficulty]} · 最多 10 人，不足由电脑补齐。朋友需连接同一服务器。</p><div class="modal-actions"><button type="button" id="network-create" class="primary-button">创建房间 →</button><button type="submit" id="network-join" class="secondary-button">按房间号加入</button></div></form>`,'MULTIPLAYER / ROOMS');
    $('modal').classList.add('network-modal');
    const connect=async(type)=>{
      const code=$('network-code').value.trim();if(type==='join'&&!/^\d{6}$/.test(code)){this.status('请输入 6 位数字房间号');return;}
      const name=$('network-name').value.trim()||'玩家';let address;try{address=serverAddress($('network-address').value);}catch(e){this.status(e.message);return;}
      $('network-create').disabled=$('network-join').disabled=true;$('network-status').textContent='正在连接服务器…';
      try{localStorage.setItem('retrofront.network',JSON.stringify({name,address}));}catch{}
      try{await this.connection.connect(address);this.connection.send({type,code,name,profile:this.app.profile(),difficulty:this.app.profile().difficulty});}
      catch(e){this.status(e.message);}
      finally{if($('network-create'))$('network-create').disabled=$('network-join').disabled=false;}
    };
    $('network-create').onclick=()=>connect('create');$('network-form').onsubmit=e=>{e.preventDefault();connect('join');};
  }
  showRoom(){
    const {room,self}=this.connection;if(!room)return;
    const me=room.members.find(m=>m.key===self),host=room.host===self;
    this.app.modal('房间 '+room.code,`<div class="room-invite"><span>房间号 <b id="room-code">${room.code}</b></span><button id="room-copy" class="secondary-button">复制邀请</button><small>${names[room.difficulty]} · 沙漠灰 · 5 对 5</small></div><div class="room-teams">${['attack','defend'].map(side=>`<section><h3>${side==='attack'?'潜伏者':'保卫者'} <button class="secondary-button" data-room-side="${side}" ${me?.side===side?'disabled':''}>加入此方</button></h3>${Array.from({length:5},(_,i)=>{const m=room.members.filter(m=>m.side===side)[i];return `<div class="room-member ${m?.key===self?'is-self':''}">${m?`<span>${escape(m.name)}${m.key===self?'（你）':''}</span><small>${CHARACTERS[m.character]?.name||''} · ${m.key===room.host?'房主':m.ready?'已准备':'未准备'}</small>`:'<span>电脑补位</span><small>开局后加入</small>'}</div>`;}).join('')}</section>`).join('')}</div><p id="network-status" role="status">${room.members.length}/10 名玩家 · 分享房间号和服务器地址邀请朋友。${host?'其他玩家准备后即可开局。':'准备后等待房主开局。'}</p><div class="modal-actions"><button id="room-action" class="primary-button">${host?'开始对局 →':me?.ready?'取消准备':'准备'}</button><button id="room-leave" class="secondary-button">退出房间</button></div>`,'MULTIPLAYER / WAITING ROOM');
    $('modal').classList.add('network-modal');
    $('room-action').disabled=host&&room.members.some(m=>m.key!==self&&!m.ready);
    $('room-action').onclick=()=>this.connection.send({type:host?'start':'ready'});
    document.querySelectorAll('[data-room-side]').forEach(b=>b.onclick=()=>this.connection.send({type:'side',side:b.dataset.roomSide}));
    $('room-leave').onclick=()=>{this.leave();this.app.close();};
    $('room-copy').onclick=async()=>{const text=`旧战线房间：${room.code}\n服务器：${this.connection.socket?.url}`;try{await navigator.clipboard.writeText(text);this.status('邀请已复制，发送给朋友即可');}catch{this.status(text);}};
  }
  leave(){this.connection.close();}
}
