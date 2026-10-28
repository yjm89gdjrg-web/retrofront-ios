// Local gameplay setting; independent of the number of actors in a match.
export const KILL_CHAIN_WINDOW=8;
export const KILL_LABELS=['','击杀','双杀','三杀','四杀','五杀'];
export function recordPlayerKill(chain,time,{character,headshot=false,melee=false}={}){
  chain.count=time-chain.last<=KILL_CHAIN_WINDOW?chain.count+1:1;chain.last=time;
  const tier=Math.min(5,chain.count),special=melee?'knife':headshot?'headshot':null;
  const kind=tier===1&&special?special:`kill-${tier}`;
  return {count:chain.count,tier,headshot,melee,character,gender:['fox','star','yun'].includes(character)?'female':'male',
    icon:`assets/killmarks/${kind}.png`,voice:tier===1&&special?special:`kill_${tier}`,
    label:tier===1&&special?(melee?'近战击杀':'爆头击杀'):KILL_LABELS[tier],
    detail:[`${chain.count} 连杀`,tier>1&&(melee?'近战':headshot?'爆头':'')].filter(Boolean).join(' · ')};
}

export class KillBadge {
  constructor(element){this.element=element;this.remaining=0;this.clear();}
  clear(){this.remaining=0;this.element.hidden=true;this.element.classList.remove('show');}
  event(e){
    if(e.type==='round'||(e.type==='kill'&&e.id===0)){this.clear();return;}
    if(e.type!=='kill'||e.killer!==0||!e.reward)return;
    const reward=e.reward,root=this.element;this.remaining=2.1;
    root.querySelector('img').src=reward.icon;root.querySelector('img').alt=reward.label;
    root.querySelector('strong').textContent=reward.label;root.querySelector('small').textContent=reward.detail;
    root.dataset.tier=String(reward.tier);root.hidden=false;root.classList.remove('show');void root.offsetWidth;root.classList.add('show');root.style.opacity='1';
  }
  update(dt){
    if(this.remaining<=0)return;this.remaining=Math.max(0,this.remaining-dt);
    this.element.style.opacity=String(Math.min(1,this.remaining/.4));if(!this.remaining)this.clear();
  }
}
