import {MAP,clearLine} from './map.js';

export function radarContacts(game,observer=game.player){
  const contacts=[];
  for(const bot of game.bots)if(!bot.dead&&(bot.team===game.player.team||(!observer.dead&&(bot.x-observer.x)**2+(bot.z-observer.z)**2<=144&&clearLine(observer,bot))))contacts.push(bot);
  return contacts;
}
export function radarZone(player){
  const site=MAP.sites.find(s=>Math.hypot(player.x-s.x,player.z-s.z)<s.r+1);
  const zone=MAP.zones.find(b=>Math.abs(player.x-b.x)<=b.w/2&&Math.abs(player.z-b.z)<=b.d/2);
  return site?`${site.id} 区 · 爆破点`:zone?.name??'连接通道';
}
export class TacticalRadar {
  constructor(canvas){
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.base=canvas.ownerDocument.createElement('canvas');this.base.width=this.base.height=288;
    const half=MAP.size/2,c=this.base.getContext('2d'),scale=128/(half*Math.SQRT2),point=n=>144+n*scale;
    c.clearRect(0,0,288,288);c.save();c.beginPath();c.arc(144,144,134,0,Math.PI*2);c.clip();
    c.fillStyle='#1a252bdc';c.fillRect(0,0,288,288);
    c.fillStyle='#869491e8';for(const [x,z,y] of MAP.radarCells){c.fillStyle=y>1?'#9aa8a3':'#71827e';c.fillRect(point(x-MAP.radarCellSize/2),point(z-MAP.radarCellSize/2),MAP.radarCellSize*scale+.25,MAP.radarCellSize*scale+.25);}
    // Route markings use the same world coordinates as movement and collision.
    c.strokeStyle='#d3dfdd15';c.lineWidth=1;
    for(let i=-half;i<=half;i+=4){c.beginPath();c.moveTo(point(i),point(-half));c.lineTo(point(i),point(half));c.moveTo(point(-half),point(i));c.lineTo(point(half),point(i));c.stroke();}
    for(const b of MAP.obstacles){
      const x=point(b.x-b.w/2),y=point(b.z-b.d/2),w=b.w*scale,h=b.d*scale;
      c.fillStyle='#11171c55';c.fillRect(x+2,y+3,w,h);
      c.fillStyle=b.kind==='crate'?'#596864':b.kind==='container'?'#4d5c5f':'#334249';c.fillRect(x,y,w,h);
      c.strokeStyle='#17252bd9';c.lineWidth=1.8;c.strokeRect(x+.5,y+.5,w-1,h-1);
      if(b.kind==='building'){c.strokeStyle='#647077';c.lineWidth=1;c.beginPath();c.moveTo(x+3,y+3);c.lineTo(x+w-3,y+3);c.lineTo(x+w-3,y+h-3);c.stroke();}
    }
    for(const site of MAP.sites){
      const x=point(site.x),y=point(site.z),r=site.r*scale;
      c.fillStyle='#daca7220';c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();c.strokeStyle='#e9d986';c.lineWidth=1.6;c.stroke();
      c.font='bold 21px Arial';c.textAlign='center';c.textBaseline='middle';c.lineWidth=3;c.strokeStyle='#343b32';c.strokeText(site.id,x,y);c.fillStyle='#f2e4a0';c.fillText(site.id,x,y);
    }
    for(const [side,label] of [['attack','BL'],['defend','GR']]){const p=MAP.spawn[side];c.font='bold 12px Arial';c.textAlign='center';c.fillStyle='#26333a';c.fillText(label,point(p.x),point(p.z));}
    c.restore();c.strokeStyle='#bec7bf';c.lineWidth=2;c.beginPath();c.arc(144,144,135,0,Math.PI*2);c.stroke();
    c.strokeStyle='#36464a';c.lineWidth=2;c.beginPath();c.arc(144,144,131,0,Math.PI*2);c.stroke();
    this.point=point;this.scale=scale;
  }
  reset(){this.lastGame=null;this.lastState=null;}
  draw(game,observer=game.player){
    // Pause/idle HUD refreshes must not repeat canvas work or visibility rays.
    // Include every actor and the bomb blink so online snapshots still redraw
    // while the local pause menu is open.
    const state=[game.round,game.phase,game.player.team,observer.x,observer.y,observer.z,observer.yaw,observer.dead,game.bomb?.x,game.bomb?.z,game.bomb?Math.floor(game.bomb.time*3)%2:null];
    for(const actor of game.bots)state.push(actor.id,actor.x,actor.y,actor.z,actor.yaw,actor.team,actor.dead);
    if(this.lastGame===game&&this.lastState?.length===state.length&&state.every((value,index)=>value===this.lastState[index]))return false;
    this.lastGame=game;this.lastState=state;
    const c=this.ctx,p=this.point;c.clearRect(0,0,288,288);c.drawImage(this.base,0,0);
    c.save();c.beginPath();c.arc(144,144,133,0,Math.PI*2);c.clip();
    if(!observer.dead){
      c.save();c.translate(p(observer.x),p(observer.z));c.rotate(observer.yaw);c.fillStyle='#d8f8c738';c.beginPath();c.moveTo(0,0);c.arc(0,0,33,-Math.PI/2-.53,-Math.PI/2+.53);c.closePath();c.fill();c.restore();
    }
    for(const bot of radarContacts(game,observer)){
      if(bot===observer)continue;
      c.save();c.translate(p(bot.x),p(bot.z));
      if(bot.team===game.player.team){c.rotate(bot.yaw);c.fillStyle='#80d8ef';c.strokeStyle='#142d38';c.lineWidth=2;c.beginPath();c.moveTo(0,-6);c.lineTo(4,4);c.lineTo(0,2);c.lineTo(-4,4);c.closePath();c.fill();c.stroke();}
      else{c.fillStyle='#ee6453';c.strokeStyle='#5b211b';c.lineWidth=2;c.beginPath();c.arc(0,0,4.5,0,Math.PI*2);c.fill();c.stroke();}c.restore();
    }
    if(game.bomb){const x=p(game.bomb.x),y=p(game.bomb.z);c.save();c.translate(x,y);c.rotate(Math.PI/4);c.fillStyle=Math.floor(game.bomb.time*3)%2?'#ff684b':'#ffe2a0';c.strokeStyle='#572e1a';c.lineWidth=2;c.fillRect(-6,-6,12,12);c.strokeRect(-6,-6,12,12);c.restore();}
    c.save();c.translate(p(observer.x),p(observer.z));c.rotate(observer.yaw);c.fillStyle=observer.dead?'#a4a8a6':'#e2ffbb';c.strokeStyle='#293720';c.lineWidth=2.2;c.beginPath();c.moveTo(0,-9);c.lineTo(6,6);c.lineTo(0,3);c.lineTo(-6,6);c.closePath();c.fill();c.stroke();c.restore();c.restore();return true;
  }
}
