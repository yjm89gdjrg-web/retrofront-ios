import {CONTROL_SPECS,sanitizeHudLayout,controlRect} from './control-layout-config.js';
const $=id=>document.getElementById(id);
export class ControlLayout {
  constructor(initial,onSave){
    this.saved=sanitizeHudLayout(initial);this.onSave=onSave;this.editing=false;this.selected='fire';
    this.panel=document.createElement('section');this.panel.id='layout-editor';this.panel.hidden=true;
    this.panel.innerHTML=`<div class="layout-panel" role="dialog" aria-label="自定义按键布局"><header><strong>按键布局</strong><button id="layout-collapse" aria-expanded="true">收起</button><button id="layout-cancel">取消</button><button id="layout-save">保存</button></header><div id="layout-options"><div class="layout-selection"><label>选中按键 <select id="layout-selected">${Object.entries(CONTROL_SPECS).map(([id,s])=>`<option value="${id}">${s.name}</option>`).join('')}</select></label><button id="layout-reset">恢复默认</button></div><label>大小 <input id="layout-size" type="range" step="1"><output id="layout-size-value"></output></label><label>透明度 <input id="layout-opacity" type="range" min="25" max="100" step="1"><output id="layout-opacity-value"></output></label><p>拖动按键调整位置 · 遮挡时可收起面板 · 战局已暂停</p></div></div>`;
    document.body.append(this.panel);this.probe=document.createElement('div');this.probe.id='control-safe-area';document.body.append(this.probe);
    $('layout-selected').onchange=e=>this.select(e.target.value);
    $('layout-size').oninput=e=>this.change('size',+e.target.value);
    $('layout-opacity').oninput=e=>this.change('opacity',+e.target.value/100);
    $('layout-reset').onclick=()=>{this.draft=sanitizeHudLayout(null);this.apply();this.select(this.selected);};
    $('layout-save').onclick=()=>this.finish(true);$('layout-cancel').onclick=()=>this.finish(false);
    $('layout-collapse').onclick=()=>{const hidden=!$('layout-options').hidden;$('layout-options').hidden=hidden;$('layout-collapse').textContent=hidden?'展开':'收起';$('layout-collapse').setAttribute('aria-expanded',String(!hidden));};
    for(const type of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture','click'])document.addEventListener(type,e=>this.pointer(e),{capture:true,passive:false});
    document.addEventListener('keydown',e=>{if(this.editing&&e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();this.finish(false);}},{capture:true});
    window.addEventListener('resize',()=>{this.drag=null;this.apply();});this.apply();
  }
  insets(){const s=getComputedStyle(this.probe);return Object.fromEntries(['left','right','top','bottom'].map(k=>[k,parseFloat(s['padding'+k[0].toUpperCase()+k.slice(1)])||0]));}
  apply(){
    const config=this.editing?this.draft:this.saved,insets=this.insets();
    for(const id of Object.keys(CONTROL_SPECS)){
      const r=controlRect(id,config,innerWidth,innerHeight,insets),el=$(id);
      Object.assign(el.style,{position:'fixed',left:r.x+'px',top:r.y+'px',right:'auto',bottom:'auto',width:r.width+'px',height:r.height+'px',minWidth:'0',padding:'0',transform:'translateZ(0)',opacity:String(r.opacity)});
      el.style.setProperty('--control-size',r.width+'px');
    }
  }
  open(onDone){
    if(this.editing)return;this.draft=sanitizeHudLayout(this.saved);this.onDone=onDone;this.editing=true;this.panel.hidden=false;
    $('hud').classList.add('layout-editing');$('layout-options').hidden=false;$('layout-collapse').textContent='收起';$('layout-collapse').setAttribute('aria-expanded','true');
    this.apply();this.select('fire');$('layout-selected').focus();
  }
  select(id){this.selected=id;const c=this.draft.controls[id]||{},s=CONTROL_SPECS[id];$('layout-selected').value=id;
    Object.assign($('layout-size'),{min:s.min,max:s.max,value:c.size??s.size});$('layout-size-value').textContent=Math.round(c.size??s.size)+' px';
    $('layout-opacity').value=Math.round((c.opacity??.8)*100);$('layout-opacity-value').textContent=$('layout-opacity').value+'%';
    for(const key of Object.keys(CONTROL_SPECS))$(key).classList.toggle('layout-selected',key===id);
  }
  change(key,value){this.draft.controls[this.selected]={...this.draft.controls[this.selected],[key]:value};this.apply();this.select(this.selected);}
  pointer(e){
    if(!this.editing)return;const control=e.target.closest?.('#joystick,#fire,#aim,#reload,#switch,#jump,#backpack,#interact');if(!control)return;
    e.preventDefault();e.stopImmediatePropagation();
    if(e.type==='pointerdown'&&!this.drag&&(e.pointerType!=='mouse'||e.button===0)){
      this.select(control.id);const r=control.getBoundingClientRect();this.drag={pointer:e.pointerId,id:control.id,x:e.clientX,y:e.clientY,cx:r.x+r.width/2,cy:r.y+r.height/2};control.setPointerCapture(e.pointerId);
    }else if(e.type==='pointermove'&&this.drag?.pointer===e.pointerId){
      const d=this.drag;this.draft.controls[d.id]={...this.draft.controls[d.id],x:(d.cx+e.clientX-d.x)/innerWidth,y:(d.cy+e.clientY-d.y)/innerHeight};this.apply();
    }else if(['pointerup','pointercancel','lostpointercapture'].includes(e.type)&&this.drag?.pointer===e.pointerId){this.drag=null;if(control.hasPointerCapture(e.pointerId))control.releasePointerCapture(e.pointerId);}
  }
  finish(save){
    if(!this.editing)return;if(save){this.saved=sanitizeHudLayout(this.draft);this.onSave(this.saved);}
    this.drag=null;this.editing=false;this.panel.hidden=true;$('hud').classList.remove('layout-editing');for(const id of Object.keys(CONTROL_SPECS))$(id).classList.remove('layout-selected');this.apply();this.onDone?.(save);
  }
}
