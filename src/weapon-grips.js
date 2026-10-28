import {Vector3} from 'three';
// Local contact points on the world models, measured at the grip and fore-end.
const points={
 m4:[[-.008174,-.09,.079743],[.014098,.117421,-.33]],
 ak:[[-.010317,-.09,-.000511],[.055940,.154344,-.38]],
 scar:[[-.016,-.045,.025],[-.016,.045,-.31]],
 an94:[[-.022,-.065,.012],[-.022,.025,-.45]],
 mp5:[[-.014,-.045,-.02],[-.014,.025,-.31]],
 awm:[[-.015,-.06,-.015],[-.015,.025,-.35]],
 m700:[[.015,-.055,.01],[.015,.025,-.45]],
 usp:[[0,-.035,-.035]],deagle:[[.03,.055,-.015]],anaconda:[[-.01,-.035,-.03]],colt1911:[[.005,-.035,-.025]],
};
export function weaponGrips(id){const p=points[id];return p?{grip:new Vector3(...p[0]),...(p[1]?{support:new Vector3(...p[1])}:{})}:{};}
