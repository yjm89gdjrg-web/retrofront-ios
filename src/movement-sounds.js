const valid=a=>a&&Number.isFinite(a.id)&&['x','y','z'].every(k=>Number.isFinite(a[k]));

// Client-side travel tracking also works for interpolated network actors. It
// emits at most one step per actor per frame and never catches up old steps.
export class MovementSounds {
  constructor(){this.reset();}
  reset(){this.game=null;this.round=null;this.actors=new Map();}
  update(game,dt){
    if(!game){this.reset();return [];}
    const changed=this.game!==game||this.round!==game.round;
    if(changed){this.actors.clear();this.game=game;this.round=game.round;}
    const active=!changed&&!game.paused&&['live','over'].includes(game.phase)&&Number.isFinite(dt)&&dt>0&&dt<=.15,events=[],seen=new Set();
    for(const actor of [game.player,...(game.bots||[])]){
      if(!valid(actor)||actor.dead)continue;seen.add(actor.id);
      const previous=this.actors.get(actor.id),dx=previous?actor.x-previous.x:0,dz=previous?actor.z-previous.z:0,dy=previous?actor.y-previous.y:0,travel=Math.hypot(dx,dz);
      // Bots have no grounded flag. Offline falling is explicit; abrupt
      // vertical snapshot corrections are silent rather than ground steps.
      const grounded=actor.grounded!==false&&actor.fallTarget===undefined&&!(actor.grounded===undefined&&Math.abs(dy)>Math.max(.08,(dt||0)*2.4));
      const state={x:actor.x,y:actor.y,z:actor.z,grounded,walk:previous?.walk??0,air:previous?.air??0,airKnown:previous?.airKnown??false,peak:previous?.peak??actor.y,foot:previous?.foot??0};
      this.actors.set(actor.id,state);
      const correction=!previous||travel>Math.max(.8,dt*12)||Math.abs(dy)>3;
      if(!active||correction){state.walk=0;state.air=0;state.airKnown=false;state.peak=actor.y;continue;}
      if(!grounded){state.walk=0;state.air+=dt;state.airKnown||=actor.grounded===false||(!game.online&&actor.fallTarget!==undefined);state.peak=Math.max(state.peak,actor.y);continue;}
      const position=[actor.x,actor.y+.12,actor.z];
      if(!previous.grounded){
        if(state.airKnown&&state.air>=.08&&state.peak-actor.y>.12)events.push({type:'land',id:actor.id,position,strength:Math.min(1,Math.max(.3,(state.peak-actor.y)/2.2))});
        state.air=0;state.airKnown=false;state.peak=actor.y;state.walk=0;continue;
      }
      state.air=0;state.peak=actor.y;
      // Ignore interpolation tails and tiny separation nudges, but accumulate
      // normal travel by distance so cadence does not depend on frame rate.
      if(travel/dt<.65){state.walk=0;continue;}
      state.walk+=travel;
      if(state.walk>=1.65){state.walk%=1.65;state.foot^=1;events.push({type:'footstep',id:actor.id,position,foot:state.foot,strength:Math.min(1,travel/dt/4.5)});}
    }
    for(const id of this.actors.keys())if(!seen.has(id))this.actors.delete(id);
    return events;
  }
}
