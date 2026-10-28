const pointerInput=event=>(event.pointerType==='touch'||event.pointerType==='pen')&&(event.button===undefined||event.button===0);
const point=event=>Number.isFinite(event.clientX)&&Number.isFinite(event.clientY)?{x:event.clientX,y:event.clientY}:null;

// Each gesture owns exactly one pointer. Releasing a look or movement finger
// cannot release an independent fire finger, including secondary iOS touches.
export function bindTouchControls(elements,{input,getGame,look,unlockAudio=()=>{},otherFireActive=()=>false,windowTarget=globalThis.window,documentTarget=globalThis.document}){
 const active={stick:null,look:null,fire:null},removers=[];let disposed=false;
 const listen=(target,type,handler)=>{if(!target?.addEventListener)return;target.addEventListener(type,handler,{passive:false});removers.push(()=>target.removeEventListener(type,handler));};
 const available=role=>{
  const game=getGame();if(!game||game.paused||game.phase==='finished')return false;
  if(role==='fire')return !game.player?.dead&&['ready','live'].includes(game.phase);
  return !game.player?.dead||game.spectator?.mode==='free';
 };
 const syncFire=()=>{input.fire=!!active.fire||!!otherFireActive();};
 const release=(role,cancel=false)=>{
  const owner=active[role];if(!owner)return;
  // Clear ownership first; releasePointerCapture can synchronously dispatch loss.
  active[role]=null;
  if(role==='stick'){input.x=0;input.z=0;if(elements.stick)elements.stick.style.transform='none';}
  if(role==='fire'){syncFire();if(cancel&&!input.fire)input.trigger=false;}
  try{if(!owner.element.hasPointerCapture||owner.element.hasPointerCapture(owner.id))owner.element.releasePointerCapture?.(owner.id);}catch{}
 };
 const claim=(role,element,event)=>{
  if(disposed||element.disabled||!pointerInput(event)||!Number.isInteger(event.pointerId)||active[role]||Object.values(active).some(owner=>owner?.id===event.pointerId)||!available(role))return false;
  const position=point(event);if(!position)return false;
  try{element.setPointerCapture?.(event.pointerId);}catch{return false;}
  event.preventDefault();active[role]={id:event.pointerId,element,position};unlockAudio();return true;
 };
 const moveStick=event=>{
  const position=point(event),rect=elements.joystick.getBoundingClientRect(),radius=Math.min(rect.width,rect.height)/2,max=radius*.65;
  if(!position||![rect.left,rect.top,rect.width,rect.height,max].every(Number.isFinite)||max<=0)return false;
  const dx=position.x-rect.left-rect.width/2,dy=position.y-rect.top-rect.height/2,distance=Math.hypot(dx,dy),scale=distance>max?max/distance:1;
  input.x=dx*scale/max;input.z=dy*scale/max;
  if(elements.stick)elements.stick.style.transform=`translate(${dx*scale}px,${dy*scale}px)`;return true;
 };
 const bind=(role,element)=>{
  listen(element,'pointerdown',event=>{
   if(!claim(role,element,event))return;
   if(role==='stick'&&!moveStick(event)){release(role,true);return;}
   if(role==='fire'){input.fire=true;input.trigger=true;}
  });
  listen(element,'pointermove',event=>{
   const owner=active[role];if(!owner||event.pointerId!==owner.id)return;
   event.preventDefault();if(element.disabled||!available(role)){release(role,true);return;}
   if(role==='stick'){if(!moveStick(event))release(role,true);return;}
   const position=point(event);if(!position)return;
   const dx=position.x-owner.position.x,dy=position.y-owner.position.y;if(!Number.isFinite(dx)||!Number.isFinite(dy))return;
   look(dx,dy);owner.position=position;
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(element,type,event=>{
   if(active[role]?.id!==event.pointerId)return;event.preventDefault();release(role,type!=='pointerup');
  });
 };
 bind('stick',elements.joystick);bind('look',elements.lookZone);bind('fire',elements.fire);
 const clear=()=>{for(const role of Object.keys(active))release(role,true);input.x=input.z=0;input.fire=false;input.trigger=false;if(elements.stick)elements.stick.style.transform='none';};
 for(const type of ['blur','pagehide','resize','retrofront-pause'])listen(windowTarget,type,clear);
 listen(documentTarget,'visibilitychange',()=>{if(documentTarget.hidden)clear();});
 return {clear,get firing(){return !!active.fire;},dispose(){if(disposed)return;disposed=true;clear();for(const remove of removers)remove();}};
}
