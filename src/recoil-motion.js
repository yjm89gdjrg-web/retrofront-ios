// Visual viewmodel motion only. Ballistic recoil, aim and damage stay in Game.
const profiles={
 m4:{kick:.026,sway:.0026,returnRate:25},ak:{kick:.038,sway:.0038,returnRate:22},
 scar:{kick:.023,sway:.0024,returnRate:26},an94:{kick:.028,sway:.0028,returnRate:25},
 mp5:{kick:.017,sway:.002,returnRate:29},awm:{kick:.047,sway:.0033,returnRate:19},m700:{kick:.041,sway:.003,returnRate:21},
 usp:{kick:.027,sway:.0026,returnRate:25},deagle:{kick:.041,sway:.0037,returnRate:22},
 anaconda:{kick:.044,sway:.0037,returnRate:21},colt1911:{kick:.03,sway:.0028,returnRate:24}
};
function spring(position,velocity,rate,dt){
 const c=velocity+rate*position,e=Math.exp(-rate*dt);return [(position+c*dt)*e,(velocity-rate*c*dt)*e];
}
export class RecoilMotion {
 constructor(){this.reset();}
 reset(){this.back=0;this.backVelocity=0;this.side=0;this.sideVelocity=0;this.returnRate=25;this.serial=0;}
 kick(weapon,strength=1){
  const profile=profiles[weapon];if(!profile)return false;
  const gain=Number.isFinite(strength)?Math.max(0,Math.min(1,strength)):1;
  this.returnRate=profile.returnRate;this.back=Math.min(.08,this.back+profile.kick*gain);this.backVelocity=Math.min(.35,this.backVelocity+profile.kick*gain*profile.returnRate*.18);
  const sway=profile.sway*gain*Math.sin(++this.serial*2.399963);this.side=Math.max(-.008,Math.min(.008,this.side+sway));this.sideVelocity=Math.max(-.08,Math.min(.08,this.sideVelocity+sway*profile.returnRate*.18));return true;
 }
 update(dt){
  if(!Number.isFinite(dt)||dt<=0)return;
  if(dt>5){this.back=this.backVelocity=this.side=this.sideVelocity=0;return;}
  [this.back,this.backVelocity]=spring(this.back,this.backVelocity,this.returnRate,dt);
  [this.side,this.sideVelocity]=spring(this.side,this.sideVelocity,this.returnRate,dt);
  if(this.back>.08){this.back=.08;this.backVelocity=Math.min(0,this.backVelocity);}
  if(Math.abs(this.side)>.008){this.side=Math.sign(this.side)*.008;this.sideVelocity=0;}
  if(Math.abs(this.back)<1e-7&&Math.abs(this.backVelocity)<1e-7)this.back=this.backVelocity=0;
  if(Math.abs(this.side)<1e-7&&Math.abs(this.sideVelocity)<1e-7)this.side=this.sideVelocity=0;
 }
 pose(aim=false){const scale=aim?.5:1;return {back:this.back*scale,lift:this.back*.14*scale,side:this.side*scale,pitch:this.back*.42*scale,roll:this.side*.9*scale};}
}
export function approachAim(current,aim,dt){return current+((aim?1:0)-current)*(1-Math.exp(-Math.max(0,dt)*18));}
export function visualRecoilScale(actual,nominal,fallbackAim=false){return Number.isFinite(actual)&&Number.isFinite(nominal)&&nominal>0?Math.max(0,Math.min(1,actual/nominal)):fallbackAim?.65:1;}
