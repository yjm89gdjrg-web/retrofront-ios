import {MAP} from './map.js';

export const LOCAL_ROOMS = {
 easy:{number:'001',name:'新兵热身'},
 normal:{number:'002',name:'标准交锋'},
 hard:{number:'003',name:'老兵挑战'}
};

// The lobby thumbnail uses the same layout as combat and the tactical radar.
export function drawLobbyMap(canvas,side='attack') {
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
 ctx.clearRect(0,0,w,h);
 const ground=ctx.createLinearGradient(0,0,w,h);ground.addColorStop(0,'#535047');ground.addColorStop(1,'#252c2d');ctx.fillStyle=ground;ctx.fillRect(0,0,w,h);
 ctx.strokeStyle='#829b8220';ctx.lineWidth=1;
 for(let x=0;x<w;x+=24){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
 for(let y=0;y<h;y+=24){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
 const span=MAP.size+2,scale=Math.min((w-90)/span,(h-48)/span),offsetX=(w-span*scale)/2,offsetY=7,x=n=>offsetX+(n+span/2)*scale,y=n=>offsetY+(n+span/2)*scale;
 for(const [px,pz,py] of MAP.radarCells){ctx.fillStyle=py>1?'#b2b3a0':'#8c9689';ctx.fillRect(x(px-MAP.radarCellSize/2),y(pz-MAP.radarCellSize/2),MAP.radarCellSize*scale+.25,MAP.radarCellSize*scale+.25);}
 for(const block of MAP.obstacles){const left=x(block.x-block.w/2),top=y(block.z-block.d/2),bw=block.w*scale,bh=block.d*scale;ctx.fillStyle='#070e1255';ctx.fillRect(left+3,top+4,bw,bh);ctx.fillStyle=block.kind==='building'?'#717b70':block.kind==='container'?'#566e6b':block.kind==='crate'?'#a08f65':'#869081';ctx.fillRect(left,top,bw,bh);ctx.strokeStyle='#b8c0a277';ctx.strokeRect(left+.5,top+.5,bw-1,bh-1);}
 for(const site of MAP.sites){ctx.strokeStyle=site.id==='A'?'#e1bd6e':'#a5c1c6';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x(site.x),y(site.z),site.r*scale,0,Math.PI*2);ctx.stroke();ctx.fillStyle=ctx.strokeStyle;ctx.font='bold 17px Tahoma';ctx.textAlign='center';ctx.fillText(site.id,x(site.x),y(site.z)+6);}
 const spawn=MAP.spawn[side];ctx.fillStyle='#eff0cd';ctx.beginPath();ctx.moveTo(x(spawn.x),y(spawn.z)-7);ctx.lineTo(x(spawn.x)-5,y(spawn.z)+4);ctx.lineTo(x(spawn.x)+5,y(spawn.z)+4);ctx.closePath();ctx.fill();
 ctx.textAlign='left';ctx.fillStyle='#a9b5a6';ctx.font='11px Tahoma';ctx.fillText('N ↑',14,22);ctx.fillText(MAP.english,14,h-42);ctx.fillStyle='#d2c294';ctx.font='bold 10px Tahoma';ctx.textAlign='right';ctx.fillText(side==='attack'?'BL / ATTACK':'GR / DEFEND',w-13,22);
}
