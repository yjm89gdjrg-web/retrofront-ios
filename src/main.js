import { WEAPONS, WEAPON_SLOTS, SLOT_LABELS, CHARACTERS, DEFAULT_PROFILE, sanitizeProfile, BACKPACK_COUNT, selectBackpack, equipBackpackWeapon, availableCharacters, redeemCharacterCode } from './catalog.js';
import { Game } from './game.js';
import {NetworkGame} from './network.js';
import {RoomUI} from './room-ui.js';
import { Renderer } from './render.js';
import { Audio } from './audio.js';
import { KillBadge } from './kill-feedback.js';
import { TacticalRadar, radarZone } from './hud-radar.js';
import { bindCombatActions, bindPress, toggleAim } from './combat-input.js';
import { ControlLayout } from './control-layout.js';
import { LOCAL_ROOMS, drawLobbyMap } from './lobby.js';
import {setText,setHTML,setHidden,setClass,setAttribute,setStyle,setData} from './ui-updates.js';
import {sanitizeAimSettings,lookSensitivity,applyLook} from './aim-controls.js';
import {FrameMeter} from './frame-meter.js';
import {FrameDiagnostics} from './frame-diagnostics.js';
import {bindTouchControls} from './touch-controls.js';
// Initial IDs belong to permanent page nodes. Modal controls remain dynamic.
const fixedNodes=new Map([...document.querySelectorAll('[id]')].map(node=>[node.id,node]));
const $=id=>fixedNodes.get(id)||document.getElementById(id),on=(id,event,fn)=>$(id).addEventListener(event,fn);
const hudWeaponSlots=[...document.querySelectorAll('.weapon-slots i')];
let profile=sanitizeProfile(DEFAULT_PROFILE);
try{profile=sanitizeProfile(JSON.parse(localStorage.getItem('retrofront.profile')||'null')||window.nativeProfile);}catch{profile=sanitizeProfile(window.nativeProfile);}
function save(){try{localStorage.setItem('retrofront.profile',JSON.stringify(profile));}catch{}window.webkit?.messageHandlers?.saveProfile?.postMessage(profile);}
const audio=new Audio();audio.setEnabled(profile.sound);audio.setMusicEnabled(profile.music);audio.setScene('menu');audio.setSuspended(document.hidden);
document.addEventListener('pointerdown',()=>audio.unlock(),{capture:true});
document.addEventListener('keydown',()=>audio.unlock(),{capture:true});
document.addEventListener('click',e=>{const button=e.target.closest?.('button');if(!button||button.disabled||(!button.closest('#menu')&&!button.closest('#modal')))return;audio.unlock();audio.click(button.id==='start'?'confirm':button.id==='modal-close'?'back':'select');},{capture:true});
let renderer;
try{renderer=new Renderer($('scene'),profile);}catch(e){$('fatal').hidden=false;$('fatal').textContent='3D 场景未能启动。请在支持 WebGL 2 的设备或浏览器中打开，并启用硬件加速。';console.error(e);throw e;}
let game=null,page='lobby',category='primary',selected=profile.primary,toastTimer,feedTimer,hitTime=0,hurtTime=0,lastTime=performance.now(),hudClock=0,bombBeep=0;
let backpackModal=false,previewBackpack=0;
const killBadge=new KillBadge($('kill-badge'));
const tacticalRadar=new TacticalRadar($('radar'));
const frameMeter=new FrameMeter();
const frameDiagnostics=new FrameDiagnostics();
let diagnosticsMode='尚未开始';
const input={x:0,z:0,rise:0,fire:false,trigger:false,interact:false},keys=new Set(),flightPointers=new Map();
const controlLayout=new ControlLayout(profile.hudLayout,value=>{profile.hudLayout=value;save();});
const names={easy:'简单',normal:'标准',hard:'困难'};
const roomUI=new RoomUI({profile:()=>profile,inGame:()=>!!game,modal:openModal,close:closeModal,toast,
  start:snapshot=>{profile.side=snapshot.player.team;startGame(new NetworkGame(snapshot,message=>roomUI.connection.send(message)));},
  snapshot:snapshot=>{if(game?.online)game.applySnapshot(snapshot);},disconnected:backToLobby});
function toast(text){$('toast').textContent=text;$('toast').style.opacity=1;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').style.opacity=0,2200);}
function refreshMenu(){
  $('operator-name').textContent=CHARACTERS[profile.character].name;$('operator-sub').textContent=CHARACTERS[profile.character].english;
  $('loadout-name').innerHTML=`${WEAPONS[profile.primary].name} <span>/ ${WEAPONS[profile.secondary].name} / ${WEAPONS[profile.melee].name}</span>`;
  $('difficulty-cycle').textContent=names[profile.difficulty]+' ↻';$('record').textContent=`${profile.matches} 场完成 · ${profile.wins} 场胜利`;
  $('side-attack').classList.toggle('active',profile.side==='attack');$('side-defend').classList.toggle('active',profile.side==='defend');
  for(const slot of Object.keys(WEAPON_SLOTS))$('bag-'+slot).textContent=WEAPONS[profile[slot]].name;
  $('bag-number').textContent=profile.activeBackpack+1;$('loadout-label').textContent=`背包 ${profile.activeBackpack+1} / 当前配装`;
  document.querySelectorAll('[data-menu-bags]').forEach(node=>{node.innerHTML=backpackTabs(profile.activeBackpack);node.querySelectorAll('button').forEach(button=>button.onclick=()=>{selectBackpack(profile,+button.dataset.bag);save();selected=profile[category==='operators'?'character':category];refreshMenu();setPage(page);});});
  for(const slot of Object.keys(WEAPON_SLOTS))$('bag-image-'+slot).src=weaponThumbnail(profile[slot]);
  $('lobby-matches').textContent=profile.matches;$('lobby-wins').textContent=profile.wins;$('lobby-winrate').textContent=profile.matches?Math.round(profile.wins/profile.matches*100)+'%':'—';
  const room=LOCAL_ROOMS[profile.difficulty];$('selected-room-name').textContent=room.number+' / '+room.name;
  document.querySelectorAll('[data-room]').forEach(button=>{const active=button.dataset.room===profile.difficulty;button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));});
  drawLobbyMap($('lobby-map'),profile.side);
}
function lobbyMessage(text){const prefix=document.createElement('span');prefix.textContent='[系统]';$('lobby-message').replaceChildren(prefix,document.createTextNode(' '+text));}
function setPage(value){page=value;$('lobby').hidden=page!=='lobby';$('warehouse').hidden=page!=='warehouse';$('tab-lobby').classList.toggle('active',page==='lobby');$('tab-warehouse').classList.toggle('active',page==='warehouse');renderer.display.rotation.y=0;renderer.manualRotation=0;if(page==='lobby')renderer.showOperator(profile.character,profile.primary);else showInventory();}
function showInventory(){
  const weapons=category!=='operators',slot=weapons?category:'character',items=weapons?WEAPON_SLOTS[slot]:availableCharacters(profile);
  if(!items.includes(selected))selected=profile[slot];
  for(const [id,value] of [['guns','primary'],['secondary','secondary'],['melee','melee'],['operators','operators']]){$('inventory-'+id).classList.toggle('active',category===value);$('inventory-'+id).setAttribute('aria-pressed',String(category===value));}
  $('item-list').innerHTML=items.map(id=>{const item=weapons?WEAPONS[id]:CHARACTERS[id],equipped=id===profile[slot];return `<button class="inventory-item ${id===selected?'selected':''}" data-item="${id}"><div><strong>${item.name}</strong><small>${item.type||item.english}</small></div><span>${equipped?'已装备':item.playerOnly?'玩家专属':'永久'}</span></button>`;}).join('');
  $('item-list').querySelectorAll('button').forEach(b=>b.onclick=()=>{selected=b.dataset.item;showInventory();});
  const item=weapons?WEAPONS[selected]:CHARACTERS[selected],equipped=selected===profile[slot];
  $('item-name').textContent=item.name;$('item-type').textContent=item.type||item.english;$('item-desc').textContent=item.tag||item.description;
  $('item-stats').innerHTML=weapons?['威力','精度','射速','机动'].map((name,i)=>`<div class="stat"><span>${name}</span><div><i style="width:${item.stats[i]}%"></i></div><b>${item.stats[i]}</b></div>`).join(''):'';
  $('item-note').textContent=weapons?(slot==='melee'?'近战攻击 · 无需弹药':`弹匣 ${item.clip} 发 · 备用 ${item.reserve} 发`):'基础生命值 100 · 角色仅改变外观';
  $('equip').innerHTML=equipped?'已装备 <span>✓</span>':weapons?`装备到${SLOT_LABELS[slot]} <span>→</span>`:'选择此角色 <span>→</span>';$('equip').disabled=equipped;
  if(!weapons&&item.playerOnly){$('item-note').innerHTML='玩家专属 · 人机不会使用 · 生命值 100<br><button id=voice-preview class=utility-button>试听击杀语音 ▷</button>';$('voice-preview').onclick=async()=>{await audio.unlock();await audio.ready;if(page==='warehouse'&&category==='operators'&&selected==='yun')audio.killReward({character:'yun',gender:'female',voice:'kill_2',tier:2});};}
  if(weapons)renderer.showWeapon(selected);else renderer.showOperator(selected,profile.primary);
}
on('tab-lobby','click',()=>setPage('lobby'));on('tab-warehouse','click',()=>setPage('warehouse'));
for(const [id,value] of [['guns','primary'],['secondary','secondary'],['melee','melee'],['operators','operators']])on('inventory-'+id,'click',()=>{category=value;showInventory();$('item-list').scrollTop=0;});
on('equip','click',()=>{if(category==='operators'){if(!availableCharacters(profile).includes(selected))return;profile.character=selected;}else equipBackpackWeapon(profile,category,selected);save();refreshMenu();showInventory();lobbyMessage(`背包 ${profile.activeBackpack+1} 配装已保存。`);toast(category==='operators'?'角色已保存':`已装备到背包 ${profile.activeBackpack+1}`);});
on('loadout-edit','click',()=>{category='primary';selected=profile.primary;setPage('warehouse');});
on('side-attack','click',()=>{profile.side='attack';save();refreshMenu();lobbyMessage('已选择潜伏者。进入 A / B 区域安放爆破装置。');});on('side-defend','click',()=>{profile.side='defend';save();refreshMenu();lobbyMessage('已选择保卫者。守住 A / B 区域，阻止安放或拆除装置。');});
document.querySelectorAll('[data-room]').forEach(button=>button.addEventListener('click',()=>{profile.difficulty=button.dataset.room;save();refreshMenu();lobbyMessage('已选择 '+LOCAL_ROOMS[profile.difficulty].name+'，电脑强度：'+names[profile.difficulty]+'。点击联机房间邀请朋友，或开始单机练习。');}));
on('difficulty-cycle','click',()=>{const levels=['easy','normal','hard'];profile.difficulty=levels[(levels.indexOf(profile.difficulty)+1)%3];save();refreshMenu();lobbyMessage('电脑强度已切换为'+names[profile.difficulty]+'，当前房间：'+LOCAL_ROOMS[profile.difficulty].name+'。');});
on('mode-bomb','click',()=>toast('当前模式：5 对 5 爆破 · 选择电脑强度后创建联机房间'));
function setMapView(route){$('lobby-map').hidden=!route;$('lobby-map-scene').hidden=route;for(const [id,active] of [['map-view-scene',!route],['map-view-route',route]]){$(id).classList.toggle('active',active);$(id).setAttribute('aria-pressed',String(active));}}
on('map-view-scene','click',()=>setMapView(false));on('map-view-route','click',()=>setMapView(true));
function openModal(title,body,eyebrow='FIELD MANUAL'){backpackModal=false;$('modal').classList.remove('backpack-modal','settings-modal','redeem-modal','network-modal');$('modal-title').textContent=title;$('modal-body').innerHTML=body;$('modal-eyebrow').textContent=eyebrow;$('modal').hidden=false;$('modal').querySelector('.modal-card').scrollTop=0;}
function clearInputs(){frameDiagnostics.baseline();mouseFireHeld=false;mouseFirePointer=null;touchControls.clear();Object.assign(input,{x:0,z:0,rise:0,fire:false,trigger:false,interact:false});game?.stopInput?.();keys.clear();flightPointers.clear();$('stick').style.transform='none';}
function closeModal(){backpackModal=false;$('modal').classList.remove('backpack-modal');if(game?.phase==='finished'){if(game.online)returnToRoom();else backToLobby();return;}if(!game)roomUI.leave();$('modal').hidden=true;if(game)game.paused=false;audio.setSuspended(document.hidden);clearInputs();lastTime=performance.now();}
on('modal-close','click',closeModal);
function weaponThumbnail(id){return `./assets/backpacks/${id}.png`;}
function backpackTabs(active){return Array.from({length:BACKPACK_COUNT},(_,i)=>`<button type="button" data-bag="${i}" class="${i===active?'active':''}" aria-label="背包 ${i+1}" aria-pressed="${i===active}">${i+1}</button>`).join('');}
function drawBackpacks(){
  const bag=game.profile.backpacks[previewBackpack];
  $('modal-body').innerHTML=`<div class="backpack-tabs combat-bag-tabs" aria-label="选择背包">${backpackTabs(previewBackpack)}</div><div class="backpack-weapons">${Object.entries(WEAPON_SLOTS).map(([slot],i)=>`<div class="backpack-weapon"><header><b>0${i+1}</b><span>${SLOT_LABELS[slot]}</span></header><img src="${weaponThumbnail(bag[slot])}" alt="${WEAPONS[bag[slot]].name}"><strong>${WEAPONS[bag[slot]].name}</strong><small>${WEAPONS[bag[slot]].type}</small></div>`).join('')}</div><div class="backpack-bottom"><p>出生区内、交火前可更换<br><span>B / Esc 关闭 · 数字 1—5 快速装备</span></p><button id="backpack-apply" class="primary-button">${previewBackpack===game.activeBackpack?'继续使用':'使用'}背包 ${previewBackpack+1} <span>→</span></button></div>`;
  $('modal-body').querySelectorAll('[data-bag]').forEach(button=>button.onclick=()=>{previewBackpack=+button.dataset.bag;drawBackpacks();});
  $('backpack-apply').onclick=()=>applyGameBackpack(previewBackpack);
}
function applyGameBackpack(index){
  if(!backpackModal||!game)return;closeModal();
  if(index===game.activeBackpack)return;
  if(game.online){game.selectBackpack(index);return;}
  if(game.selectBackpack(index)){selectBackpack(profile,index);save();refreshMenu();toast(`已切换至背包 ${index+1}`);updateHUD();}
  else toast('当前无法换包，请在下回合出生区更换');
}
function openBackpacks(){
  if(!game||game.paused||controlLayout.editing)return;
  if(!game.canSelectBackpack){toast(game.player.dead?'阵亡后无法更换背包':'本回合已锁定背包，下回合出生区可更换');return;}
  game.paused=true;audio.setSuspended(true);clearInputs();document.exitPointerLock?.();
  openModal('选择背包','','EQUIPMENT / BACKPACK');backpackModal=true;previewBackpack=game.activeBackpack;$('modal').classList.add('backpack-modal');drawBackpacks();
}
on('backpack','click',openBackpacks);
// A second touch does not synthesize click on iOS; open after release to avoid touching the new panel.
on('backpack','pointerup',e=>{if(e.pointerType==='touch'&&!e.isPrimary){e.preventDefault();openBackpacks();}});
function openControlLayout(){
  if(controlLayout.editing)return;
  const state={paused:!!game?.paused,modal:$('modal').hidden,menu:$('menu').hidden,hud:$('hud').hidden};
  if(game)game.paused=true;audio.setSuspended(true);clearInputs();document.exitPointerLock?.();
  $('modal').hidden=true;$('menu').hidden=true;$('hud').hidden=false;$('hud').classList.toggle('layout-preview',!game);
  controlLayout.open(saved=>{
    $('modal').hidden=state.modal;$('menu').hidden=state.menu;$('hud').hidden=state.hud;$('hud').classList.remove('layout-preview');
    if(game)game.paused=state.paused||document.hidden;audio.setSuspended(document.hidden||!!game?.paused);clearInputs();lastTime=performance.now();
    if(saved)toast('按键布局已保存');
  });
}
// Open after release so the new panel cannot receive this touch's pointerup.
on('hud-settings','click',openControlLayout);
on('help-open','click',()=>openModal('行动指南',`<p><b>胜利规则</b><br>双方各 5 人，先得 3 分获胜。单机由电脑补位；联机可邀请朋友加入，空位由电脑补齐。蓝色标记表示队友，不造成友军伤害。阵亡后可观战存活队友。进攻方在 A 或 B 区长按安放 3 秒，装置 35 秒后引爆；防守方靠近装置长按拆除 5 秒。120 秒内未安放，防守方获胜。</p><p><b>触屏操作</b><br>左侧摇杆移动，空白处滑动转向。跳跃键起跳，右侧开火键可按住并拖动瞄准；瞄准、换弹与切枪按钮分别操作。出生区交火前可点击左侧背包按钮换包。进入点位后显示安放或拆除按钮。半自动武器需再次点击开火。右上齿轮可以拖动按键、调整大小和透明度，保存后自动沿用。</p><p><b>电脑预览</b><br>WASD 移动，点击场景锁定鼠标；左键开火、右键瞄准，R 换弹，1 / 2 / 3 切枪，B 打开背包后按 1—5 换包，长按 E 安放或拆除。Esc 暂停。</p><p><b>死亡观战</b><br>点击切换自由视角，使用摇杆移动、滑屏转向，右下按钮上升或下降。电脑按 V 切换，WASD 移动，Space 上升、Ctrl 下降。</p><p>回合结束后的 3 秒仍可走动和转向，随后重置位置或显示整场结算。单机失去焦点自动暂停；联机失去焦点只停止你的输入，对局继续。阵亡者留在战场直到下一回合。</p>`));
function openSettings(){
  const sliders=[['sensitivity','腰射灵敏度',.3],['aimSensitivity','开镜灵敏度',.15],['scopeSensitivity','狙击镜灵敏度',.15]];
  openModal('作战设置',`<div class="aim-settings">${sliders.map(([field,label,min])=>`<label class="setting-row aim-setting">${label}<span><input id="setting-${field}" aria-label="${label}" type="range" min="${min}" max="2" step="0.05" value="${profile[field]}"><output id="setting-${field}-value">${profile[field].toFixed(2)}×</output></span></label>`).join('')}<button id="setting-aim-reset" class="secondary-button">恢复默认灵敏度</button></div><label class="setting-row">电脑强度${game?'（下局）':''} <select id="setting-difficulty">${Object.entries(names).map(([id,name])=>`<option value="${id}" ${id===profile.difficulty?'selected':''}>${name}</option>`).join('')}</select></label><label class="setting-row">画面质量 <select id="setting-quality"><option value="high" ${profile.quality==='high'?'selected':''}>高清 / 阴影</option><option value="low" ${profile.quality==='low'?'selected':''}>流畅 / 省电</option></select></label><label class="setting-row">显示帧率 <input id="setting-fps" type="checkbox" ${profile.showFPS?'checked':''}></label><div class="setting-row sound-options"><label>游戏声音 <input id="setting-sound" type="checkbox" ${profile.sound?'checked':''}></label><label>大厅音乐 <input id="setting-music" type="checkbox" ${profile.music?'checked':''}></label></div><p>三种瞄准速度独立生效，数值越小越容易微调。设置自动保存在本机。</p>`, 'SYSTEM CONFIGURATION');
  for(const [field]of sliders)$('setting-'+field).oninput=e=>{Object.assign(profile,sanitizeAimSettings({...profile,[field]:+e.target.value}));$('setting-'+field+'-value').textContent=profile[field].toFixed(2)+'×';save();};
  $('setting-aim-reset').onclick=()=>{Object.assign(profile,{sensitivity:1,aimSensitivity:.5,scopeSensitivity:.5});for(const [field]of sliders){$('setting-'+field).value=profile[field];$('setting-'+field+'-value').textContent=profile[field].toFixed(2)+'×';}save();};
  $('setting-fps').onchange=e=>{profile.showFPS=e.target.checked;frameMeter.reset();setText($('frame-meter'),'测量中…');save();};$('setting-difficulty').onchange=e=>{profile.difficulty=e.target.value;save();refreshMenu();};$('setting-quality').onchange=e=>{profile.quality=e.target.value;renderer.quality(profile.quality);save();};$('setting-sound').onchange=e=>{profile.sound=e.target.checked;audio.setEnabled(profile.sound);audio.unlock();save();};$('setting-music').onchange=e=>{profile.music=e.target.checked;audio.setMusicEnabled(profile.music);audio.unlock();save();};
  const actions=document.createElement('div');actions.className='settings-actions';
  $('modal').classList.add('settings-modal');
  const layoutButton=document.createElement('button');layoutButton.id='setting-layout';layoutButton.className='secondary-button';layoutButton.textContent='自定义按键布局';layoutButton.onclick=openControlLayout;actions.append(layoutButton);
  const redeemButton=document.createElement('button');redeemButton.id='setting-redeem';redeemButton.className='secondary-button';redeemButton.textContent='兑换码';redeemButton.onclick=openRedemption;actions.append(redeemButton);$('modal-body').append(actions);
  const networkButton=document.createElement('button');networkButton.id='setting-network';networkButton.className='secondary-button';networkButton.textContent='联机服务器 / 房间';networkButton.onclick=()=>roomUI.open();actions.append(networkButton);
  const diagnosticsButton=document.createElement('button');diagnosticsButton.id='setting-diagnostics';diagnosticsButton.className='secondary-button';diagnosticsButton.textContent='运行统计 / 卡顿记录';diagnosticsButton.onclick=openDiagnostics;actions.append(diagnosticsButton);
}
on('settings-open','click',openSettings);
function diagnosticsReport(){
 return {version:1,mode:diagnosticsMode,...frameDiagnostics.summary(),currentQuality:profile.quality,
   currentViewport:[innerWidth,innerHeight],currentRenderSize:[$('scene').width,$('scene').height],
   browser:navigator.userAgent,scope:'Foreground live/round-end completed draw intervals; excludes loading, menus, pause and background. P95 uses 1ms buckets capped at 1000ms.'};
}
function openDiagnostics(){
 const report=diagnosticsReport(),number=value=>report.frames?value:'—';
 openModal('运行统计',`<p>本次启动内${game?'当前':'最近一次'}对局 · ${diagnosticsMode}</p><dl class="diagnostics-grid"><div><dt>有效采样</dt><dd>${report.activeSeconds.toFixed(1)} 秒</dd></div><div><dt>平均帧率</dt><dd>${number(report.averageFPS)} FPS</dd></div><div><dt>95% 帧间隔</dt><dd>${report.p95Capped?'≥':''}${number(report.p95FrameMs)} ms</dd></div><div><dt>最长帧间隔</dt><dd>${number(report.maxFrameMs)} ms</dd></div><div><dt>卡顿 ≥50ms</dt><dd>${report.stutters50ms} 次</dd></div><div><dt>严重卡顿 ≥100ms</dt><dd>${report.severe100ms} 次</dd></div></dl><p>仅统计前台对局的实际绘制；加载、暂停、切后台不计入。数值为打开本页时的记录，开始新对局会重新计数。</p><p>${report.recentStutters.length?'最近卡顿：'+report.recentStutters.map(item=>`${item.atSeconds}s / ${item.frameMs}ms`).join('、'):'暂未记录到卡顿。'}</p><div class="settings-actions"><button id="diagnostics-copy" class="primary-button">复制测试记录</button><button id="diagnostics-reset" class="secondary-button">清空统计</button><button id="diagnostics-back" class="secondary-button">返回设置</button></div><textarea id="diagnostics-export" aria-label="测试记录，长按复制" readonly hidden></textarea>`,'PERFORMANCE');
 $('modal').classList.add('settings-modal');
 $('diagnostics-back').onclick=openSettings;
 $('diagnostics-reset').onclick=()=>{frameDiagnostics.reset();openDiagnostics();};
 $('diagnostics-copy').onclick=async()=>{
  const text=JSON.stringify(report,null,2),area=$('diagnostics-export');
  try{if(!navigator.clipboard?.writeText)throw Error('clipboard unavailable');await navigator.clipboard.writeText(text);toast('测试记录已复制');}
  catch{if(!area?.isConnected)return;area.hidden=false;area.value=text;area.focus();area.select();area.scrollIntoView({block:'nearest'});toast('请长按测试记录并复制');}
 };
}
function openRedemption(){
 openModal('兑换码','<form id="redeem-form"><label class="redeem-label" for="redeem-code">输入兑换码</label><input id="redeem-code" name="code" inputmode="numeric" type="text" maxlength="32" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" placeholder="请输入兑换码"><p id="redeem-result" role="status" aria-live="polite">兑换后，奖励将加入本机仓库。</p><div class="settings-actions"><button id="redeem-submit" type="submit" class="primary-button">兑换</button><button id="redeem-back" type="button" class="secondary-button">返回设置</button></div></form><button id="redeem-warehouse" class="secondary-button" hidden>前往角色仓库 →</button>','REDEEM CODE');
 $('redeem-back').onclick=openSettings;
 $('modal').classList.add('redeem-modal');
 $('redeem-form').addEventListener('keydown',e=>e.stopPropagation());
 $('redeem-form').onsubmit=e=>{
  e.preventDefault();const result=redeemCharacterCode(profile,$('redeem-code').value),success=result==='unlocked'||result==='already';
  $('redeem-result').textContent={empty:'请输入兑换码。',invalid:'兑换码无效，请检查后重试。',already:'已拥有云悠悠，无需重复兑换。',unlocked:'兑换成功！已获得玩家专属角色「云悠悠」。'}[result];
  $('redeem-result').dataset.success=String(success);$('redeem-code').setAttribute('aria-invalid',String(!success));$('redeem-warehouse').hidden=!success;
  if(result==='unlocked'){save();refreshMenu();if(page==='warehouse')showInventory();lobbyMessage('兑换成功，云悠悠已加入角色仓库。');}
  if(success){$('redeem-code').value='';$('redeem-code').blur();}
 };
 $('redeem-warehouse').onclick=()=>{closeModal();category='operators';selected='yun';setPage('warehouse');};
}
function startGame(nextGame){
  killBadge.clear();tacticalRadar.reset();frameMeter.reset();setText($('frame-meter'),'测量中…');
  audio.setScene('game');audio.setSuspended(document.hidden);audio.unlock();clearInputs();game=nextGame||new Game(profile,Date.now()>>>0);$('menu').hidden=true;$('hud').hidden=false;$('modal').hidden=true;$('feed').innerHTML='';bombBeep=0;renderer.start(game);lastTime=performance.now();
  frameDiagnostics.reset();diagnosticsMode=game.online?'联机':'单机';
}
on('start','click',()=>roomUI.open());on('solo-start','click',()=>{roomUI.leave();startGame();});
function endScene(){killBadge.clear();tacticalRadar.reset();game?.stopInput?.();game=null;audio.setScene('menu');audio.setSuspended(document.hidden);clearInputs();document.exitPointerLock?.();renderer.endGame();$('hud').hidden=true;$('menu').hidden=false;$('modal').hidden=true;refreshMenu();setPage('lobby');}
function backToLobby(){roomUI.leave();endScene();}
function returnToRoom(){endScene();roomUI.showRoom();}
function pauseGame(){
  if(controlLayout.editing||!game||game.phase==='finished'||game.paused)return;game.paused=true;audio.setSuspended(true);clearInputs();document.exitPointerLock?.();
  openModal(game.online?'联机菜单':'行动暂停',`<p>${game.online?'联机战局仍在继续，你的角色会留在场上。':'战局已暂停，回合计时不会继续。'}</p><div class="modal-actions"><button id="resume" class="primary-button">继续行动 →</button><button id="leave" class="secondary-button">返回大厅</button></div>`,'OPERATION PAUSED');
  $('resume').onclick=closeModal;$('leave').onclick=backToLobby;
  const layoutButton=document.createElement('button');layoutButton.id='pause-layout';layoutButton.className='secondary-button';layoutButton.textContent='自定义按键布局';layoutButton.onclick=openControlLayout;$('modal-body').append(layoutButton);
  const settingsButton=document.createElement('button');settingsButton.id='pause-settings';settingsButton.className='secondary-button';settingsButton.textContent='灵敏度与作战设置';settingsButton.onclick=openSettings;$('modal-body').append(settingsButton);
}
on('pause','click',pauseGame);
function matchResult(){
  clearInputs();const won=game.winner===profile.side;profile.matches++;if(won)profile.wins++;save();document.exitPointerLock?.();
  openModal(won?'行动成功':'行动结束',`<p>${game.reason}</p><div style="font-size:38px;color:var(--gold);letter-spacing:12px;margin:18px 0">${game.score.attack} : ${game.score.defend}</div><p>进攻方 / 防守方 · 本次已记入本地战绩</p><div class="modal-actions"><button id="again" class="primary-button">${game.online?'返回房间':'再次出击 →'}</button><button id="return" class="secondary-button">返回大厅</button></div>`,'MISSION DEBRIEF');$('again').onclick=game.online?returnToRoom:()=>startGame();$('return').onclick=backToLobby;
}
function look(dx,dy){if(!game||game.paused||(game.player.dead&&game.spectator.mode!=='free'))return;applyLook(game.player.dead?game.spectator:game.player,dx,dy,lookSensitivity(profile,game));}
let mouseFireHeld=false,mouseFirePointer=null,mouseFirePosition=null;
const touchControls=bindTouchControls({joystick:$('joystick'),stick:$('stick'),lookZone:$('look-zone'),fire:$('fire')},{input,getGame:()=>game,look,unlockAudio:()=>audio.unlock(),otherFireActive:()=>mouseFireHeld});
window.addEventListener('resize',clearInputs);
on('look-zone','pointerdown',e=>{
  if(e.pointerType!=='mouse'||!game||game.paused)return;audio.unlock();
  if(e.button===2){if(toggleAim(game))updateHUD();return;}if(e.button!==0)return;
  if(document.pointerLockElement!==$('look-zone')){const p=$('look-zone').requestPointerLock?.();p?.catch?.(()=>{});}mouseFireHeld=!game.player.dead;input.fire=mouseFireHeld||touchControls.firing;input.trigger=mouseFireHeld;
});
on('look-zone','pointercancel',e=>{if(e.pointerType==='mouse'){mouseFireHeld=false;input.fire=touchControls.firing;if(!input.fire)input.trigger=false;}});
document.addEventListener('mousemove',e=>{if(document.pointerLockElement=== $('look-zone'))look(e.movementX,e.movementY);});
document.addEventListener('mouseup',e=>{if(e.button===0){mouseFireHeld=false;mouseFirePointer=null;input.fire=touchControls.firing;}});
document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&game&&!game.paused&&game.phase!=='finished')pauseGame();});
document.addEventListener('contextmenu',e=>e.preventDefault());
on('fire','pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0||!game||game.paused||game.player.dead)return;mouseFireHeld=true;mouseFirePointer=e.pointerId;mouseFirePosition={x:e.clientX,y:e.clientY};$('fire').setPointerCapture(e.pointerId);input.fire=true;input.trigger=true;audio.unlock();});
on('fire','pointermove',e=>{if(e.pointerType==='mouse'&&mouseFirePointer===e.pointerId){look(e.clientX-mouseFirePosition.x,e.clientY-mouseFirePosition.y);mouseFirePosition={x:e.clientX,y:e.clientY};}});
for(const type of ['pointerup','pointercancel','lostpointercapture'])on('fire',type,e=>{if(e.pointerType==='mouse'&&mouseFirePointer===e.pointerId){mouseFireHeld=false;mouseFirePointer=null;input.fire=touchControls.firing;if(type!=='pointerup'&&!input.fire)input.trigger=false;}});
on('interact','pointerdown',e=>{if(!game||game.paused)return;input.interact=true;$('interact').setPointerCapture(e.pointerId);});for(const type of ['pointerup','pointercancel','lostpointercapture'])on('interact',type,()=>input.interact=false);
bindCombatActions({aim:$('aim'),reload:$('reload'),switch:$('switch')},()=>game,()=>audio.unlock(),()=>updateHUD());
bindPress($('jump'),()=>game?.jump());
function toggleSpectator(){
  if(!game||game.paused||!game.player.dead)return;const c=renderer.camera;
  game.setSpectatorMode(game.spectator.mode==='free'?'follow':'free',{x:c.position.x,y:c.position.y,z:c.position.z,yaw:-c.rotation.y,pitch:c.rotation.x});clearInputs();updateHUD();
}
bindPress($('spectator-toggle'),toggleSpectator);
for(const [id,direction] of [['spectator-up',1],['spectator-down',-1]]){
  on(id,'pointerdown',e=>{if(!game||game.paused||!game.player.dead||game.spectator.mode!=='free')return;e.preventDefault();flightPointers.set(e.pointerId,direction);input.rise=Math.sign([...flightPointers.values()].reduce((a,b)=>a+b,0));$(id).setPointerCapture(e.pointerId);});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])on(id,type,e=>{flightPointers.delete(e.pointerId);input.rise=Math.sign([...flightPointers.values()].reduce((a,b)=>a+b,0));});
}
document.addEventListener('keydown',e=>{
  if(!game||controlLayout.editing)return;
  if(backpackModal){if(['Escape','KeyB','Digit1','Digit2','Digit3','Digit4','Digit5'].includes(e.code)){e.preventDefault();if(!e.repeat){if(e.code.startsWith('Digit'))applyGameBackpack(+e.code.slice(-1)-1);else closeModal();}}return;}
  if(e.code==='Escape'){e.preventDefault();pauseGame();return;}if(game.paused)return;
  if(e.code==='KeyB'){e.preventDefault();if(!e.repeat)openBackpacks();return;}
  if(e.code==='KeyV'&&game.player.dead){e.preventDefault();if(!e.repeat)toggleSpectator();return;}
  if(['KeyW','KeyA','KeyS','KeyD','KeyE','KeyR','Digit1','Digit2','Digit3','Space','ControlLeft','ControlRight'].includes(e.code))e.preventDefault();keys.add(e.code);
  if(!e.repeat){if(e.code==='Space'&&!game.player.dead)game.jump();if(e.code==='KeyR')game.reload();if(['Digit1','Digit2','Digit3'].includes(e.code))game.switchWeapon(+e.code.slice(-1)-1);}
});document.addEventListener('keyup',e=>keys.delete(e.code));
function restoreAudio(){audio.setSuspended(document.hidden||!!game?.paused);}
document.addEventListener('visibilitychange',()=>{if(document.hidden){pauseGame();audio.setSuspended(true);}else restoreAudio();});
window.addEventListener('blur',()=>{pauseGame();audio.setSuspended(true);clearInputs();});window.addEventListener('focus',restoreAudio);
window.addEventListener('retrofront-pause',()=>{pauseGame();audio.setSuspended(true);});window.addEventListener('retrofront-active',restoreAudio);
let inspection=null;
on('menu','pointerdown',e=>{const viewport=e.target.closest('[data-preview]');if(!viewport||e.target.closest('button'))return;viewport.setPointerCapture(e.pointerId);inspection={id:e.pointerId,x:e.clientX};});
on('menu','pointermove',e=>{if(inspection?.id===e.pointerId){renderer.manualRotation=(renderer.manualRotation||0)+(e.clientX-inspection.x)*.01;inspection.x=e.clientX;}});on('menu','pointerup',()=>inspection=null);on('menu','pointercancel',()=>inspection=null);
function radar(){const observer=game.player.dead?(game.spectator.mode==='free'?{...game.spectator,dead:true}:game.aliveAllies.find(b=>b.id===renderer.spectatorId)||game.player):game.player;tacticalRadar.draw(game,observer);setText($('radar-zone'),radarZone(observer));}
function updateHUD(){
  const p=game.player,weapon=game.weapon,allies=game.aliveAllies,enemies=game.aliveEnemies,canSelectBackpack=game.canSelectBackpack;
  setText($('score-a'),game.score.attack);setText($('score-d'),game.score.defend);setText($('round'),`ROUND ${String(game.round).padStart(2,'0')}`);
  setText($('hud-bag-number'),game.activeBackpack+1);setClass($('backpack'),'bag-locked',!canSelectBackpack);setAttribute($('backpack'),'aria-label',`背包 ${game.activeBackpack+1}，${canSelectBackpack?'点击更换':'下回合可更换'}`);
  const free=p.dead&&game.spectator.mode==='free';setClass($('hud'),'spectating',p.dead);setHidden($('spectator-controls'),!p.dead||game.phase==='finished');setHidden($('spectator-flight'),!free);
  setText($('spectator-toggle'),free?(allies.length?'跟随队友':'返回死亡视角'):'切换自由视角');setText($('spectator-status'),free?'自由视角 · 摇杆移动 / 滑屏转向':renderer.spectatorId?'跟随队友 '+renderer.spectatorId:'死亡视角');
  const t=Math.max(0,Math.ceil(game.bomb?.time??game.time));setText($('timer'),game.bomb?`◈ ${t}s`:`${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`);setStyle($('timer'),'color',game.bomb?'#ffc483':'');
  setText($('objective'),`我方 ${allies.length+(p.dead?0:1)} / 敌方 ${enemies.length} · ${game.objective}`);setText($('hp'),p.hp);setStyle($('hp-bar'),'width',p.hp+'%');setText($('weapon-name'),weapon.name);
  setText($('ammo'),game.slot===2?'—':game.ammo[game.slot].clip);setText($('reserve'),game.slot===2?'':`/ ${game.ammo[game.slot].reserve}`);setText($('reload-state'),game.reloading>0?`装填中 ${game.reloading.toFixed(1)}s`:'');
  setClass($('aim'),'active',game.aim);setHidden($('scope'),!(game.aim&&weapon.scoped&&!p.dead));setHidden($('crosshair'),p.dead||(game.aim&&weapon.scoped));
  setAttribute($('aim'),'aria-pressed',String(game.aim));setClass($('reload'),'busy',game.reloading>0);setAttribute($('reload'),'aria-busy',String(game.reloading>0));
  setData($('fire'),'mode',game.slot===2?'melee':'ranged');setText($('fire-label'),game.slot===2?'挥砍':'开火');setAttribute($('weapon-icon'),'href',['#hud-rifle','#hud-pistol','#hud-knife'][game.slot]);hudWeaponSlots.forEach((node,i)=>setClass(node,'active',i===game.slot));
  const action=game.interaction;setData($('kill-badge'),'interacting',!!action);setHidden($('interact'),!action);if(action){setText($('interact-label'),action.label);setStyle($('interact-progress'),'width',game.interact/action.duration*100+'%');}
  let center='';if(game.phase==='ready')center=`<div class="count">${Math.max(1,Math.ceil(game.phaseTime))}</div><p>${profile.side==='attack'?'进攻方 · 携带装置进入点位':'防守方 · 守住 A / B 点位'}</p>`;
  else if(game.phase==='over')center=`<h2>${game.winner===profile.side?'回合胜利':'回合失利'}</h2><p>${game.reason} · ${Math.max(1,Math.ceil(game.phaseTime))} 秒后${game.score[game.winner]>=3?'结算':'继续'} · ${p.dead?'可切换观战':'可自由移动'}</p>`;
  else if(p.dead&&!free)center=`<h2>已阵亡</h2><p>${renderer.spectatorId?'正在观战队友 '+renderer.spectatorId:allies.length?'队友仍在作战，即将进入观战':'等待本回合结果'}</p>`;
  setHTML($('center-message'),center);radar();
}
function event(e){
  if(game.online&&e.type==='backpack'){selectBackpack(profile,e.index);save();refreshMenu();toast(`已切换至背包 ${e.index+1}`);}
  if(e.type==='notice')toast(e.message);
  killBadge.event(e);
  renderer.event(e);audio.event({...e,listenerPosition:game.player.dead?renderer.camera.position.toArray():[game.player.x,game.player.y+1.6,game.player.z],listenerYaw:game.player.dead?-renderer.camera.rotation.y:game.player.yaw});
  if(e.type==='hit')hitTime=.17;if(e.type==='hurt')hurtTime=.3;
  if(e.type==='kill'){$('feed').innerHTML=`<div>${e.id===0?'你已阵亡':`${e.killer===0?'你':e.killerTeam===profile.side?'队友':'敌方'} ▸ ${e.team===profile.side?'队友':'敌方'} ${e.id}`}</div>`;clearTimeout(feedTimer);feedTimer=setTimeout(()=>$('feed').innerHTML='',3500);}
  if(e.type==='matchEnd')matchResult();
}
function frame(now){
  // Starting a scene can reset lastTime after an already queued frame timestamp.
  const dt=Math.min(Math.max((now-lastTime)/1000,0),.05);lastTime=now;hudClock+=dt;
  if(game){
    const keyboard=keys.has('KeyW')||keys.has('KeyA')||keys.has('KeyS')||keys.has('KeyD');
    const controls={...input,x:keyboard?(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0):input.x,z:keyboard?(keys.has('KeyS')?1:0)-(keys.has('KeyW')?1:0):input.z,rise:input.rise+(keys.has('Space')?1:0)-(keys.has('ControlLeft')||keys.has('ControlRight')?1:0),interact:input.interact||keys.has('KeyE')};
    game.update(dt,controls);input.trigger=false;for(const e of game.events.splice(0))event(e);
    if(!document.hidden)setClass($('fire'),'is-firing',input.fire&&!game.paused&&!game.player.dead);
    if(!game.paused)killBadge.update(dt);
    if(game.bomb&&!game.paused&&game.phase==='live'){bombBeep-=dt;if(bombBeep<=0){audio.tone(1400,.07,'sine',.04);bombBeep=game.bomb.time<8?.25:1;}}
    if(hudClock>.08&&!document.hidden){updateHUD();hudClock=0;}
    hitTime=Math.max(0,hitTime-dt);hurtTime=Math.max(0,hurtTime-dt);if(!document.hidden){setStyle($('hit-marker'),'opacity',hitTime>0?1:0);setStyle($('damage-overlay'),'opacity',hurtTime/.3);}
  }
  renderer.render(game,dt,now/1000);
  if(game){audio.setListener(renderer.camera.position.toArray(),-renderer.camera.rotation.y);audio.updateMovement(game,document.hidden?0:dt);}
  frameDiagnostics.sample(now,renderer.frameSerial,!!game&&!game.paused&&!document.hidden&&['live','over'].includes(game.phase));
  setHidden($('frame-meter'),!game||!profile.showFPS);
  if(game&&profile.showFPS&&!document.hidden){const fps=frameMeter.sample(now,renderer.frameSerial);if(fps!==null)setText($('frame-meter'),`${game.paused?'暂停 · ':''}${fps} FPS`);}else frameMeter.reset(now,renderer.frameSerial);
  requestAnimationFrame(frame);
}
refreshMenu();requestAnimationFrame(frame);
