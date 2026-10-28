const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export function sanitizeAimSettings(raw={}){
 const sensitivity=Number.isFinite(raw.sensitivity)?clamp(raw.sensitivity,.3,2):1;
 // Old saves multiplied the single slider by .5 while aiming. Preserve that
 // exact feel until the player chooses the new independent aiming values.
 const legacy=sensitivity*.5;
 return {sensitivity,aimSensitivity:Number.isFinite(raw.aimSensitivity)?clamp(raw.aimSensitivity,.15,2):legacy,scopeSensitivity:Number.isFinite(raw.scopeSensitivity)?clamp(raw.scopeSensitivity,.15,2):legacy};
}
export function lookSensitivity(profile,game){
 if(game.player.dead||!game.aim||game.weapon.slot==='melee')return profile.sensitivity;
 return game.weapon.scoped?profile.scopeSensitivity:profile.aimSensitivity;
}
export function applyLook(target,dx,dy,sensitivity){
 if(![dx,dy,sensitivity].every(Number.isFinite)||sensitivity<=0)return false;
 const factor=.0033*sensitivity;target.yaw+=dx*factor;target.pitch=clamp(target.pitch-dy*factor,-1.25,1.25);return true;
}
