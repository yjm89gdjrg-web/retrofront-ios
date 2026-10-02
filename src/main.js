import { WEAPONS, CHARACTERS, DEFAULT_PROFILE, sanitizeProfile } from './catalog.js';
import { MAP } from './map.js';
import { Game } from './game.js';
import { Renderer } from './render.js';
import { Audio } from './audio.js';
const $=id=>document.getElementById(id),on=(id,event,fn)=>$(id).addEventListener(event,fn);
let profile=sanitizeProfile(DEFAULT_PROFILE);
try{profile=sanitizeProfile(JSON.parse(localStorage.getItem('retrofront.profile')||'null')||window.nativeProfile);}catch{profile=sanitizeProfile(window.nativeProfile);}
function save(){try{localStorage.setItem('retrofront.profile',JSON.stringify(profile));}catch{}window.webkit?.messageHandlers?.saveProfile?.postMessage(profile);}
const audio=new Audio();audio.enabled=profile.sound;
let renderer;
try{renderer=new Renderer($('scene'),profile);}catch(e){$('fatal').hidden=false;$('fatal').textContent='3D 场景未能启动。请在支持 WebGL 2 的设备或浏览器中打开，并启用硬件加速。';console.error(e);throw e;}
let game=null,page='lobby',category='guns',selected=profile.primary,toastTimer,feedTimer,hitTime=0,hurtTime=0,lastTime=performance.now(),hudClock=0,bombBeep=0;
const input={x:0,z:0,fire:false,trigger:false,interact:false},keys=new Set();
const names={easy:'简单',normal:'标准',hard:'困难'};
function toast(text){$('toast').textContent=text;$('toast').style.opacity=1;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').style.opacity=0,2200);}
function refreshMenu(){
  $('operator-name').textContent=CHARACTERS[profile.character].name;$('operator-sub').textContent=CHARACTERS[profile.character].english;
  $('loadout-name').innerHTML=`${WEAPONS[profile.primary].name} <span>/ USP / 战术匕首</span>`;
  $('difficulty-cycle').textContent=names[profile.difficulty]+' ↻';$('record').textContent=`${profile.matches} 场完成 · ${profile.wins} 场胜利`;
  $('side-attack').classList.toggle('active',profile.side==='attack');$('side-defend').classList.toggle('active',profile.side==='defend');
}
function setPage(value){page=value;$('lobby').hidden=page!=='lobby';$('warehouse').hidden=page!=='warehouse';$('tab-lobby').classList.toggle('active',page==='lobby');$('tab-warehouse').classList.toggle('active',page==='warehouse');renderer.display.rotation.y=0;renderer.manualRotation=0;if(page==='lobby')renderer.showOperator(profile.character,profile.primary);else showInventory();}
function showInventory(){
  const items=category==='guns'?['m4','ak','awm','mp5']:Object.keys(CHARACTERS);
  if(!items.includes(selected))selected=category==='guns'?profile.primary:profile.character;
  $('inventory-guns').classList.toggle('active',category==='guns');$('inventory-operators').classList.toggle('active',category==='operators');
  $('item-list').innerHTML=items.map(id=>{const item=category==='guns'?WEAPONS[id]:CHARACTERS[id],equipped=id===(category==='guns'?profile.primary:profile.character);return `<button class="inventory-item ${id===selected?'selected':''}" data-item="${id}"><div><strong>${item.name}</strong><small>${item.type||item.english}</small></div><span>${equipped?'已装备':'永久'}</span></button>`;}).join('');
  $('item-list').querySelectorAll('button').forEach(b=>b.onclick=()=>{selected=b.dataset.item;showInventory();});
  const item=category==='guns'?WEAPONS[selected]:CHARACTERS[selected],equipped=selected===(category==='guns'?profile.primary:profile.character);
  $('item-name').textContent=item.name;$('item-type').textContent=item.type||item.english;$('item-desc').textContent=item.tag||item.description;
  $('item-stats').innerHTML=category==='guns'?['威力','精度','射速','机动'].map((name,i)=>`<div class="stat"><span>${name}</span><div><i style="width:${item.stats[i]}%"></i></div><b>${item.stats[i]}</b></div>`).join(''):'';
  $('item-note').innerHTML=category==='guns'?'固定副武器 USP<br>固定近战武器 战术匕首':'基础生命值 100<br>角色仅改变外观，战斗属性一致';
  $('equip').innerHTML=equipped?'已装备 <span>✓</span>':category==='guns'?'装备到主武器 <span>→</span>':'选择此角色 <span>→</span>';$('equip').disabled=equipped;
  if(category==='guns')renderer.showWeapon(selected);else renderer.showOperator(selected,profile.primary);
}
on('tab-lobby','click',()=>setPage('lobby'));on('tab-warehouse','click',()=>setPage('warehouse'));
on('inventory-guns','click',()=>{category='guns';showInventory();});on('inventory-operators','click',()=>{category='operators';showInventory();});
on('equip','click',()=>{profile[category==='guns'?'primary':'character']=selected;save();refreshMenu();showInventory();toast('配装已保存');});
on('side-attack','click',()=>{profile.side='attack';save();refreshMenu();});on('side-defend','click',()=>{profile.side='defend';save();refreshMenu();});
on('difficulty-cycle','click',()=>{const levels=['easy','normal','hard'];profile.difficulty=levels[(levels.indexOf(profile.difficulty)+1)%3];save();refreshMenu();});
on('mode-bomb','click',()=>toast('单机爆破已选中 · 可在右侧选择攻守阵营'));
function openModal(title,body,eyebrow='FIELD MANUAL'){$('modal-title').textContent=title;$('modal-body').innerHTML=body;$('modal-eyebrow').textContent=eyebrow;$('modal').hidden=false;}
function clearInputs(){Object.assign(input,{x:0,z:0,fire:false,trigger:false,interact:false});keys.clear();stickPointer=null;firePointer=null;lookPointer=null;$('stick').style.transform='none';}
function closeModal(){if(game?.phase==='finished'){backToLobby();return;}$('modal').hidden=true;if(game)game.paused=false;clearInputs();lastTime=performance.now();}
on('modal-close','click',closeModal);
on('help-open','click',()=>openModal('行动指南',`<p><b>胜利规则</b><br>独自迎战 3 名电脑对手，先得 3 分获胜。进攻方在 A 或 B 区长按安放 3 秒，装置 35 秒后引爆；防守方靠近装置长按拆除 5 秒。95 秒内未安放，防守方获胜。</p><p><b>触屏操作</b><br>左侧摇杆移动，空白处滑动转向。右侧开火键可按住并拖动瞄准；瞄准、换弹与切枪按钮分别操作。进入点位后显示安放或拆除按钮。半自动武器需再次点击开火。</p><p><b>电脑预览</b><br>WASD 移动，点击场景锁定鼠标；左键开火、右键瞄准，R 换弹，1 / 2 / 3 切枪，长按 E 安放或拆除。Esc 暂停。</p><p>失去焦点会自动暂停。角色与枪械均为原创低多边形占位资源。</p>`));
on('settings-open','click',()=>{
  openModal('作战设置',`<label class="setting-row">视角灵敏度 <input id="setting-sensitivity" aria-label="视角灵敏度" type="range" min="0.3" max="2" step="0.1" value="${profile.sensitivity}"></label><label class="setting-row">电脑强度 <select id="setting-difficulty">${Object.entries(names).map(([id,name])=>`<option value="${id}" ${id===profile.difficulty?'selected':''}>${name}</option>`).join('')}</select></label><label class="setting-row">画面质量 <select id="setting-quality"><option value="high" ${profile.quality==='high'?'selected':''}>高清 / 阴影</option><option value="low" ${profile.quality==='low'?'selected':''}>流畅 / 省电</option></select></label><label class="setting-row">游戏音效 <input id="setting-sound" type="checkbox" ${profile.sound?'checked':''}></label><p>设置自动保存在本机。音效在首次触摸后启用。</p>`, 'SYSTEM CONFIGURATION');
  $('setting-sensitivity').oninput=e=>{profile.sensitivity=+e.target.value;save();};$('setting-difficulty').onchange=e=>{profile.difficulty=e.target.value;save();refreshMenu();};$('setting-quality').onchange=e=>{profile.quality=e.target.value;renderer.quality(profile.quality);save();};$('setting-sound').onchange=e=>{profile.sound=e.target.checked;audio.enabled=profile.sound;audio.unlock();save();};
});
function startGame(){
  audio.unlock();clearInputs();game=new Game(profile,Date.now()>>>0);$('menu').hidden=true;$('hud').hidden=false;$('modal').hidden=true;$('feed').innerHTML='';bombBeep=0;renderer.start(game);lastTime=performance.now();
}
on('start','click',startGame);
function backToLobby(){game=null;clearInputs();document.exitPointerLock?.();renderer.mode='menu';if(renderer.gun)renderer.gun.visible=false;$('hud').hidden=true;$('menu').hidden=false;$('modal').hidden=true;refreshMenu();setPage('lobby');}
function pauseGame(){
  if(!game||game.phase==='finished'||game.paused)return;game.paused=true;clearInputs();document.exitPointerLock?.();
  openModal('行动暂停','<p>战局已暂停，回合计时不会继续。</p><div class="modal-actions"><button id="resume" class="primary-button">继续行动 →</button><button id="leave" class="secondary-button">返回大厅</button></div>','OPERATION PAUSED');
  $('resume').onclick=closeModal;$('leave').onclick=backToLobby;
}
on('pause','click',pauseGame);
function matchResult(){
  clearInputs();const won=game.winner===profile.side;profile.matches++;if(won)profile.wins++;save();document.exitPointerLock?.();
  openModal(won?'行动成功':'行动结束',`<p>${game.reason}</p><div style="font-size:38px;color:var(--gold);letter-spacing:12px;margin:18px 0">${game.score.attack} : ${game.score.defend}</div><p>进攻方 / 防守方 · 本次已记入本地战绩</p><div class="modal-actions"><button id="again" class="primary-button">再次出击 →</button><button id="return" class="secondary-button">返回大厅</button></div>`,'MISSION DEBRIEF');$('again').onclick=startGame;$('return').onclick=backToLobby;
}
function look(dx,dy){if(!game||game.paused||game.player.dead)return;const factor=.0033*profile.sensitivity*(game.aim?.5:1);game.player.yaw+=dx*factor;game.player.pitch=Math.max(-1.25,Math.min(1.25,game.player.pitch-dy*factor));}
let lookPointer=null,lastLook={x:0,y:0};
on('look-zone','pointerdown',e=>{
  if(!game||game.paused)return;audio.unlock();
  if(e.pointerType==='mouse'){if(e.button===2){game.aim=!game.aim;return;}if(e.button!==0)return;if(document.pointerLockElement!==$('look-zone')){const p=$('look-zone').requestPointerLock?.();p?.catch?.(()=>{});}input.fire=true;input.trigger=true;}
  else {lookPointer=e.pointerId;lastLook={x:e.clientX,y:e.clientY};$('look-zone').setPointerCapture(e.pointerId);}
});
on('look-zone','pointermove',e=>{if(e.pointerType!=='mouse'&&e.pointerId===lookPointer){look(e.clientX-lastLook.x,e.clientY-lastLook.y);lastLook={x:e.clientX,y:e.clientY};}});
on('look-zone','pointerup',e=>{if(e.pointerId===lookPointer)lookPointer=null;if(e.pointerType==='mouse')input.fire=false;});
on('look-zone','pointercancel',()=>{lookPointer=null;input.fire=false;});
document.addEventListener('mousemove',e=>{if(document.pointerLockElement=== $('look-zone'))look(e.movementX,e.movementY);});
document.addEventListener('mouseup',e=>{if(e.button===0)input.fire=false;});
document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&game&&!game.paused&&game.phase!=='finished')pauseGame();});
document.addEventListener('contextmenu',e=>e.preventDefault());
let stickPointer=null;
function moveStick(e){const rect=$('joystick').getBoundingClientRect(),r=rect.width/2,dx=e.clientX-rect.left-r,dy=e.clientY-rect.top-r,d=Math.hypot(dx,dy),max=r*.65,f=d>max?max/d:1;input.x=dx*f/max;input.z=dy*f/max;$('stick').style.transform=`translate(${dx*f}px,${dy*f}px)`;}
on('joystick','pointerdown',e=>{if(stickPointer!==null)return;stickPointer=e.pointerId;$('joystick').setPointerCapture(e.pointerId);moveStick(e);audio.unlock();});
on('joystick','pointermove',e=>{if(stickPointer===e.pointerId)moveStick(e);});
for(const type of ['pointerup','pointercancel','lostpointercapture'])on('joystick',type,e=>{if(stickPointer===e.pointerId){stickPointer=null;input.x=0;input.z=0;$('stick').style.transform='none';}});
let firePointer=null,firePosition=null;
on('fire','pointerdown',e=>{if(firePointer!==null)return;firePointer=e.pointerId;firePosition={x:e.clientX,y:e.clientY};$('fire').setPointerCapture(e.pointerId);input.fire=true;input.trigger=true;audio.unlock();});
on('fire','pointermove',e=>{if(firePointer===e.pointerId){look(e.clientX-firePosition.x,e.clientY-firePosition.y);firePosition={x:e.clientX,y:e.clientY};}});
for(const type of ['pointerup','pointercancel','lostpointercapture'])on('fire',type,e=>{if(firePointer===e.pointerId){firePointer=null;input.fire=false;}});
on('interact','pointerdown',e=>{input.interact=true;$('interact').setPointerCapture(e.pointerId);});for(const type of ['pointerup','pointercancel','lostpointercapture'])on('interact',type,()=>input.interact=false);
on('aim','click',()=>{if(game&&!game.player.dead)game.aim=!game.aim;});on('reload','click',()=>game?.reload());on('switch','click',()=>game?.switchWeapon(game.slot+1));
document.addEventListener('keydown',e=>{
  if(!game)return;if(e.code==='Escape'){e.preventDefault();pauseGame();return;}if(game.paused)return;
  if(['KeyW','KeyA','KeyS','KeyD','KeyE','KeyR','Digit1','Digit2','Digit3','Space'].includes(e.code))e.preventDefault();keys.add(e.code);
  if(!e.repeat){if(e.code==='KeyR')game.reload();if(['Digit1','Digit2','Digit3'].includes(e.code))game.switchWeapon(+e.code.slice(-1)-1);}
});document.addEventListener('keyup',e=>keys.delete(e.code));
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseGame();});window.addEventListener('blur',()=>{pauseGame();clearInputs();});
window.addEventListener('retrofront-pause',pauseGame);
let inspection=null;
on('menu','pointerdown',e=>{if(e.target.tagName==='BUTTON'||e.clientX<innerWidth*.32||e.clientX>innerWidth*.7)return;inspection={id:e.pointerId,x:e.clientX};});
on('menu','pointermove',e=>{if(inspection?.id===e.pointerId){renderer.manualRotation=(renderer.manualRotation||0)+(e.clientX-inspection.x)*.01;inspection.x=e.clientX;}});on('menu','pointerup',()=>inspection=null);on('menu','pointercancel',()=>inspection=null);
function radar(){
  const ctx=$('radar').getContext('2d'),s=220/44,conv=n=>(n+22)*s;ctx.clearRect(0,0,220,220);ctx.fillStyle='#9eac9655';
  for(const b of MAP.obstacles)ctx.fillRect(conv(b.x-b.w/2),conv(b.z-b.d/2),b.w*s,b.d*s);
  for(const site of MAP.sites){ctx.strokeStyle=site.id==='A'?'#d8b56b':'#8ebfcf';ctx.beginPath();ctx.arc(conv(site.x),conv(site.z),site.r*s,0,Math.PI*2);ctx.stroke();ctx.fillStyle=ctx.strokeStyle;ctx.font='bold 15px sans-serif';ctx.textAlign='center';ctx.fillText(site.id,conv(site.x),conv(site.z)+5);}
  // Enemy blips only appear when visible; no permanent wall vision.
  for(const bot of game.aliveBots){if(Math.hypot(bot.x-game.player.x,bot.z-game.player.z)>12)continue;if(!lineVisible(bot))continue;ctx.fillStyle='#dc8660';ctx.beginPath();ctx.arc(conv(bot.x),conv(bot.z),4,0,Math.PI*2);ctx.fill();}
  if(game.bomb){ctx.fillStyle=Math.floor(game.bomb.time*3)%2?'#fb704d':'#ffe6a0';ctx.fillRect(conv(game.bomb.x)-5,conv(game.bomb.z)-5,10,10);}
  const p=game.player;ctx.save();ctx.translate(conv(p.x),conv(p.z));ctx.rotate(p.yaw);ctx.fillStyle=p.dead?'#777':'#d6f4bf';ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(5,6);ctx.lineTo(0,3);ctx.lineTo(-5,6);ctx.closePath();ctx.fill();ctx.restore();
}
import { clearLine as lineOfSight } from './map.js';
function lineVisible(bot){return lineOfSight(game.player,bot);}
function updateHUD(){
  const p=game.player;$('score-a').textContent=game.score.attack;$('score-d').textContent=game.score.defend;$('round').textContent=`ROUND ${String(game.round).padStart(2,'0')}`;
  const t=Math.max(0,Math.ceil(game.bomb?.time??game.time));$('timer').textContent=game.bomb?`◈ ${t}s`:`${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;$('timer').style.color=game.bomb?'#ffc483':'';
  $('objective').textContent=game.objective;$('hp').textContent=p.hp;$('hp-bar').style.width=p.hp+'%';$('weapon-name').textContent=game.weapon.name;
  $('ammo').textContent=game.slot===2?'—':game.ammo[game.slot].clip;$('reserve').textContent=game.slot===2?'':`/ ${game.ammo[game.slot].reserve}`;$('reload-state').textContent=game.reloading>0?`装填中 ${game.reloading.toFixed(1)}s`:'';
  $('aim').classList.toggle('active',game.aim);$('scope').hidden=!(game.aim&&game.weapon.id==='awm'&&!p.dead);$('crosshair').hidden=p.dead||(game.aim&&game.weapon.id==='awm');
  const action=game.interaction;$('interact').hidden=!action;if(action){$('interact-label').textContent=action.label;$('interact-progress').style.width=game.interact/action.duration*100+'%';}
  let center='';if(game.phase==='ready')center=`<div class="count">${Math.max(1,Math.ceil(game.phaseTime))}</div><p>${profile.side==='attack'?'进攻方 · 携带装置进入点位':'防守方 · 守住 A / B 点位'}</p>`;
  else if(game.phase==='over')center=`<h2>${game.winner===profile.side?'回合胜利':'回合失利'}</h2><p>${game.reason} · ${Math.max(1,Math.ceil(game.phaseTime))} 秒后继续</p>`;
  else if(p.dead)center='<h2>已阵亡</h2><p>装置仍在运转，等待本回合结果</p>';
  $('center-message').innerHTML=center;radar();
}
function event(e){
  renderer.event(e);audio.event(e);
  if(e.type==='hit')hitTime=.17;if(e.type==='hurt')hurtTime=.3;
  if(e.type==='kill'){$('feed').innerHTML=`<div>${e.id===0?'你已阵亡':`PLAYER 01 ▸ 守卫 ${String(e.id).padStart(2,'0')}`}</div>`;clearTimeout(feedTimer);feedTimer=setTimeout(()=>$('feed').innerHTML='',3500);}
  if(e.type==='matchEnd')matchResult();
}
function frame(now){
  const dt=Math.min((now-lastTime)/1000,.05);lastTime=now;hudClock+=dt;
  if(game){
    const keyboard=keys.has('KeyW')||keys.has('KeyA')||keys.has('KeyS')||keys.has('KeyD');
    const controls={...input,x:keyboard?(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0):input.x,z:keyboard?(keys.has('KeyS')?1:0)-(keys.has('KeyW')?1:0):input.z,interact:input.interact||keys.has('KeyE')};
    game.update(dt,controls);input.trigger=false;for(const e of game.events.splice(0))event(e);
    if(game.bomb&&!game.paused&&game.phase==='live'){bombBeep-=dt;if(bombBeep<=0){audio.tone(1400,.07,'sine',.04);bombBeep=game.bomb.time<8?.25:1;}}
    if(hudClock>.08){updateHUD();hudClock=0;}
    hitTime=Math.max(0,hitTime-dt);hurtTime=Math.max(0,hurtTime-dt);$('hit-marker').style.opacity=hitTime>0?1:0;$('damage-overlay').style.opacity=hurtTime/.3;
  }
  renderer.render(game,dt,now/1000);requestAnimationFrame(frame);
}
refreshMenu();requestAnimationFrame(frame);
