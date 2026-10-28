export const CONTROL_SPECS={
  joystick:{name:'移动摇杆',size:88,min:64,max:160},
  fire:{name:'开火 / 挥砍',size:64,min:32,max:128},
  aim:{name:'开镜',size:44,min:32,max:100},
  reload:{name:'换弹',size:44,min:32,max:100},
  switch:{name:'切枪',size:44,min:32,max:100},
  backpack:{name:'背包',size:44,min:32,max:100},
  jump:{name:'跳跃',size:44,min:32,max:100},
  interact:{name:'安放 / 拆除',size:140,min:100,max:220}
};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function sanitizeHudLayout(raw){
  const controls={};
  if(raw?.version!==1)return {version:1,controls};
  for(const [id,spec] of Object.entries(CONTROL_SPECS)){
    const source=raw.controls?.[id];if(!source||typeof source!=='object')continue;
    const c={};
    if(Number.isFinite(source.size))c.size=clamp(source.size,spec.min,spec.max);
    if(Number.isFinite(source.opacity))c.opacity=clamp(source.opacity,.25,1);
    if(Number.isFinite(source.x)&&Number.isFinite(source.y)){c.x=clamp(source.x,0,1);c.y=clamp(source.y,0,1);}
    controls[id]=c;
  }
  return {version:1,controls};
}
export function controlRect(id,layout,width,height,insets={}){
  const spec=CONTROL_SPECS[id],c=layout.controls[id]||{},size=c.size??spec.size;
  const left=insets.left||0,right=insets.right||0,top=insets.top||0,bottom=insets.bottom||0;
  const w=Math.min(size,width-left-right),h=Math.min(id==='interact'?44:size,height-top-bottom);
  const positions={joystick:[left+51,height-bottom-116],fire:[width-right-38,height-bottom-105],aim:[width-right-110,height-bottom-164],switch:[width-right-38,height-bottom-178],reload:[width-right-118,height-bottom-104],jump:[width-right-188,height-bottom-104],backpack:[left+122,height-bottom-170],interact:[width/2,height-bottom-96]};
  const [x,y]=Number.isFinite(c.x)&&Number.isFinite(c.y)?[c.x*width,c.y*height]:positions[id];
  return {x:clamp(x-w/2,left,width-right-w),y:clamp(y-h/2,top,height-bottom-h),width:w,height:h,opacity:c.opacity??.8};
}
