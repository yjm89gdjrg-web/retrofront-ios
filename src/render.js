import * as T from 'three';
import { MAP, traceWorld } from './map.js';
import {buildDesertWorld,disposeDesertWorld} from './desert-world.js';
import { CHARACTERS, WEAPONS } from './catalog.js';
import {CF_WEAPON_ASSETS} from './generated/cf-weapon-assets.js';
import {cfModel,cfWorldWeapon,animateCF,playCF,disposeCF} from './cf-models.js';
import {ShotEffects} from './shot-effects.js';
import {BloodEffects} from './blood-effects.js';
import {traceCorpseModels} from './corpse-hit.js';
import {RenderPacer,ResolutionBudget} from './frame-budget.js';
import {RecoilMotion,approachAim,visualRecoilScale} from './recoil-motion.js';
const mat=(c,metal=.1,rough=.8)=>new T.MeshStandardMaterial({color:c,metalness:metal,roughness:rough});
function box(g,w,h,d,c,x=0,y=0,z=0){const m=new T.Mesh(new T.BoxGeometry(w,h,d),typeof c==='object'?c:mat(c));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;}
function cylinder(g,r,h,c,x,y,z,segments=10){const m=new T.Mesh(new T.CylinderGeometry(r,r,h,segments),mat(c));m.position.set(x,y,z);m.castShadow=true;g.add(m);return m;}
export function weaponMesh(id='m4',view=false,character='omoh',side='attack'){
  const characterAsset=CHARACTERS[character]?.model||(character==='omoh'?'omoh':character+'-'+(side==='attack'?'bl':'gr'));
  if(CF_WEAPON_ASSETS[id]){const model=view?cfModel(id+'-view',{view:true,characterAsset}):cfWorldWeapon(id);if(view)model.scale.x=CF_WEAPON_ASSETS[id].mirror===false?1:-1;return model;}
  if(view&&id!=='m4'&&id!=='ak'){const rig=new T.Group(),arms=cfModel('m4-view',{view:true,characterAsset,armsOnly:true,handSide:['usp','knife'].includes(id)?'right':'both'}),gun=weaponMesh(id);arms.scale.x=-1;rig.add(arms,gun);rig.userData.armRig=arms;rig.userData.viewRig=true;const hand=arms.userData.cf.bones.find(b=>b.name==='R_Wrist');rig.updateMatrixWorld(true);arms.position.add(new T.Vector3(.22,-.21,-.55).sub(hand.getWorldPosition(new T.Vector3())));rig.userData.proceduralGrip={gun,hand};return rig;}
  if(id==='m4'||id==='ak'){const model=view?cfModel(id==='m4'?'m4-view':'ak-view',{view:true,characterAsset}):cfWorldWeapon(id);if(model){if(view)model.scale.x=-1;return model;}}
  const g=new T.Group(),steel=mat(0x333b3d,.65,.42),dark=mat(0x192225,.3),wood=mat(0x795035,.1);
  if(id==='knife'){
    const grip=cylinder(g,.029,.19,0x242a26,0,0,.075,12);grip.rotation.x=Math.PI/2;
    for(let i=0;i<7;i++){const ring=cylinder(g,.032,.012,0x111813,0,0,.005+i*.024,12);ring.rotation.x=Math.PI/2;}
    box(g,.115,.024,.028,steel,0,0,-.035);const pommel=cylinder(g,.034,.025,0x626868,0,0,.18,12);pommel.rotation.x=Math.PI/2;
    const shape=new T.Shape();shape.moveTo(-.033,0);shape.lineTo(.033,0);shape.lineTo(.034,.23);shape.lineTo(.012,.34);shape.lineTo(-.03,.27);shape.closePath();
    const geometry=new T.ExtrudeGeometry(shape,{depth:.008,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.006,bevelThickness:.003});geometry.rotateX(-Math.PI/2);
    const blade=new T.Mesh(geometry,mat(0x9fa9ad,.82,.29));blade.position.set(0,-.004,-.052);g.add(blade);
    box(g,.009,.012,.19,0x414c52,-.013,.006,-.155);for(let i=0;i<5;i++)box(g,.012,.014,.011,0x1f292c,-.033,.004,-.08-i*.02);
    g.rotation.z=Math.PI/2;return g;
  }
  const pistol=id==='usp',sniper=id==='awm',smg=id==='mp5',ak=id==='ak';
  box(g,pistol?.09:.13,pistol?.12:.15,pistol?.32:.44,steel,0,0,0);
  box(g,.1,.2,.1,ak?wood:dark,0,-.13,pistol?.08:.12).rotation.x=-.22;
  if(!pistol){
    box(g,.11,.1,sniper?.46:.27,ak?wood:dark,0,-.015,.32);
    box(g,.13,.19,.07,dark,0,-.045,sniper?.59:.49);
    box(g,.1,.11,.34,ak?wood:dark,0,.01,-.32);
    const mag=box(g,.085,smg?.28:.24,.13,dark,0,-.17,-.075);mag.rotation.x=ak?-.23:.07;
    const barrel=cylinder(g,.024,sniper?.56:smg?.2:.32,0x222a2d,0,.01,sniper?-.7:smg?-.56:-.62);barrel.rotation.x=Math.PI/2;
    const muzzle=cylinder(g,.036,.07,0x171b1c,0,.01,sniper?-.99:smg?-.68:-.79);muzzle.rotation.x=Math.PI/2;
    for(let i=0;i<7;i++)box(g,.115,.014,.018,0x697376,0,.077,-.18-i*.045);
    box(g,.04,.055,.07,0x171b1c,0,.1,.1);box(g,.025,.08,.035,0x22292b,0,.1,-.53);
    if(sniper){const scope=cylinder(g,.063,.32,0x1a2427,0,.18,-.02);scope.rotation.x=Math.PI/2;cylinder(g,.03,.06,0x263a32,0,.26,-.02);box(g,.08,.08,.08,dark,0,.1,.03);}
    else if(!ak)box(g,.025,.095,.17,dark,0,.14,.04);
  }else {box(g,.07,.06,.1,0x171b1c,0,.03,-.2);box(g,.025,.025,.025,0xb1ad91,0,.075,-.1);}
  return g;
}
export function operatorMesh(character='omoh',enemy=false,weaponID=null){
  const asset=CHARACTERS[character]?.model||(character==='omoh'?'omoh':character==='fox'?(enemy?'fox-bl':'fox-gr'):character==='star'?(enemy?'star-bl':'star-gr'):null);
  if(asset){const soldier=cfModel(asset);const gun=weaponMesh(weaponID||(enemy?'ak':'m4'));gun.position.set(.08,1.18,-.28);gun.rotation.y=-.08;soldier.add(gun);gun.scale.multiplyScalar(.82);soldier.userData.gun=gun;const bones=soldier.userData.cf.bones;const right=bones.find(b=>/R Hand/.test(b.name)),left=bones.find(b=>/L Hand/.test(b.name));if(right&&left)soldier.userData.heldGun={gun,right,left,torsoTop:bones.find(b=>b.name==='Bip01 Neck'),torsoBase:bones.find(b=>b.name==='Bip01 Spine'),id:weaponID||(enemy?'ak':'m4')};animateCF(soldier,0);return soldier;}
  const g=new T.Group(),c=CHARACTERS[character],cloth=mat(enemy?0x746453:c.color),vest=mat(0x28302b),leather=mat(0x19221f),skin=mat(0xac9276);
  box(g,.57,.65,.33,cloth,0,1.16,0);box(g,.49,.44,.11,vest,0,1.24,-.2);box(g,.43,.43,.19,vest,0,1.21,.22);
  for(const x of [-.16,0,.16])box(g,.125,.19,.09,0x747257,x,1.16,-.29);
  for(const x of [-.17,.17]){box(g,.22,.53,.23,cloth,x,.63,0);box(g,.2,.35,.2,cloth,x,.27,0);box(g,.22,.27,.09,vest,x,.49,-.16);box(g,.23,.18,.34,leather,x,.1,-.055);}
  box(g,.52,.09,.35,leather,0,.83,0);box(g,.09,.07,.015,0xb5a77b,0,.84,-.19);
  const head=new T.Mesh(new T.SphereGeometry(.215,12,10),skin);head.scale.set(1,1.16,.95);head.position.y=1.69;g.add(head);
  const helmet=new T.Mesh(new T.SphereGeometry(.25,12,8,0,Math.PI*2,0,Math.PI*.57),cloth);helmet.position.y=1.75;g.add(helmet);
  box(g,.34,.105,.065,0x121e22,0,1.73,-.18);box(g,.27,.1,.045,0x344642,0,1.59,-.185);
  for(const x of [-.38,.38]){const arm=box(g,.19,.41,.21,cloth,x,1.23,0);arm.rotation.z=x<0?-.18:.18;const fore=box(g,.17,.34,.18,cloth,x,1.02,-.15);fore.rotation.x=-.75;box(g,.16,.16,.16,leather,x,.94,-.3);}
  box(g,.13,.095,.02,enemy?0xb36846:c.accent,-.38,1.32,-.12);
  const gun=weaponMesh(weaponID||(enemy?'ak':'m4'));gun.position.set(.1,1,-.36);gun.rotation.y=-.35;g.add(gun);
  g.userData.gun=gun;return g;
}
function textPlane(text,color='#b7ac89',width=3,height=1){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,512,128);ctx.fillStyle=color;ctx.font='bold 84px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,64);
  const texture=new T.CanvasTexture(canvas),mesh=new T.Mesh(new T.PlaneGeometry(width,height),new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:T.DoubleSide}));return mesh;
}
export class Renderer {
  constructor(canvas,profile){
    this.renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
    this.pacer=new RenderPacer();this.resolution=new ResolutionBudget(profile.quality,devicePixelRatio);this.renderer.setPixelRatio(this.resolution.ratio);this.renderer.shadowMap.enabled=profile.quality==='high';this.renderer.shadowMap.type=T.PCFSoftShadowMap;
    this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.18;
    this.camera=new T.PerspectiveCamera(68,1,.055,150);this.camera.rotation.order='YXZ';this.menuCamera=new T.PerspectiveCamera(33,1,.05,80);this.mode='menu';this.menu=new T.Scene();this.menu.background=new T.Color(0x17191b);this.menu.fog=new T.FogExp2(0x17191b,.05);
    this.menu.add(new T.HemisphereLight(0xd5d9dc,0x504a41,2));const key=new T.SpotLight(0xffeed8,145,30,.7,.7);key.position.set(-3,6,4);key.target.position.set(0,1,0);key.castShadow=true;key.shadow.mapSize.set(1024,1024);this.menu.add(key,key.target);
    const fill=new T.DirectionalLight(0xc4d0df,1.8);fill.position.set(2,3,6);this.menu.add(fill);
    const rim=new T.PointLight(0xd39a4d,22,12);rim.position.set(2,2,-3);this.menu.add(rim);
    box(this.menu,50,.2,50,0x242629,0,-.16,0);box(this.menu,20,8,.3,0x24272b,0,3,-5);
    for(let i=-4;i<5;i++){box(this.menu,.055,6,.08,0x464a50,i*2,2,-4.8);box(this.menu,1.7,.035,.08,0x5b5b55,i*2,4.5,-4.6);box(this.menu,.65,.09,.06,new T.MeshBasicMaterial({color:0xb99660}),i*2,3.7,-4.6);}
    for(let i=0;i<5;i++)box(this.menu,1.4,1.3,1,0x35383a,-5+i*.3,.55+i*.1,-2-i*.9);
    const ring=new T.Mesh(new T.CylinderGeometry(1.05,1.15,.12,48),mat(0x46494c,.6));ring.position.y=-.03;ring.receiveShadow=true;this.menu.add(ring);
    const stageEdge=new T.Mesh(new T.TorusGeometry(1.06,.018,6,48),mat(0xad8752,.5));stageEdge.rotation.x=Math.PI/2;stageEdge.position.y=.035;this.menu.add(stageEdge);
    this.display=new T.Group();this.menu.add(this.display);this.showOperator(profile.character,profile.primary);
    const label=textPlane('07','#666762',.9,.45);label.position.set(0,2.8,-4.75);this.menu.add(label);
    this.viewScene=new T.Scene();this.viewCamera=new T.PerspectiveCamera(72,innerWidth/innerHeight,.01,10);this.viewScene.add(new T.HemisphereLight(0xe6ece6,0x707267,2.5));const viewLight=new T.DirectionalLight(0xffffff,2);viewLight.position.set(-2,4,1);this.viewScene.add(viewLight);
    this.world=null;this.botMeshes=new Map();this.pendingShots=[];this.pendingHits=[];this.recoilMotion=new RecoilMotion();this.recoil=0;this.aimBlend=0;this.frameSerial=0;this.resize();
    window.addEventListener('resize',()=>this.resize());
  }
  quality(value){this.renderer.setPixelRatio(this.resolution.configure(value,devicePixelRatio));this.renderer.shadowMap.enabled=value==='high';this.pacer.invalidate();}
  resize(){this.renderer.setSize(innerWidth,innerHeight,false);this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.menuLayout=null;this.pacer.invalidate();}
  clearDisplay(){while(this.display.children.length)this.dispose(this.display.children[0]);}
  dispose(node){disposeDesertWorld(node);disposeCF(node);node.traverse(o=>{if(!o.geometry?.userData.cfShared)o.geometry?.dispose();if(o.material){const a=Array.isArray(o.material)?o.material:[o.material];for(const m of a){if(!m.map?.userData.cfShared)m.map?.dispose();if(!m.userData.cfShared)m.dispose();}}});node.removeFromParent();}
  cachePreviewBounds(){const rotation=this.display.rotation.y;this.display.rotation.y=0;this.display.updateMatrixWorld(true);this.previewBounds=new T.Box3().setFromObject(this.display);this.display.rotation.y=rotation;this.menuLayout=null;this.pacer.invalidate();}
  showOperator(id,weaponID='m4'){this.clearDisplay();const soldier=operatorMesh(id,false,weaponID);soldier.rotation.y=Math.PI+.3;this.display.add(soldier);this.preview='operator';animateCF(this.display,0);this.cachePreviewBounds();}
  showWeapon(id){this.clearDisplay();const gun=weaponMesh(id),size=new T.Box3().setFromObject(gun).getSize(new T.Vector3()),span=Math.max(size.x,size.y,size.z);gun.scale.setScalar((WEAPONS[id].slot==='primary'?2.1:1.5)/Math.max(.1,span));gun.position.y=1.1;gun.rotation.y=Math.PI/2;if(id==='m4')gun.traverse(node=>{if(node.material?.name==='SILENCER.bmp')node.visible=false;});this.display.add(gun);this.preview='weapon';this.cachePreviewBounds();}
  start(game){
    this.profile=game.profile;this.visualRound=game.round;this.deathElapsed=0;this.resolution.reset();this.pacer.invalidate();
    this.shotEffects?.dispose();this.bloodEffects?.dispose();if(this.world)this.dispose(this.world);this.pendingShots=[];this.pendingHits=[];this.botMeshes.clear();this.world=new T.Scene();buildDesertWorld(this.world);this.shotEffects=new ShotEffects(this.world,this.viewScene);this.bloodEffects=new BloodEffects(this.world);
    this.bloodEffects.ground.index();
    this.bombMesh=box(this.world,.45,.15,.3,0x384133,0,.09,0);this.bombMesh.visible=false;
    const light=box(this.bombMesh,.04,.03,.04,0xef5b31,0,.09,0);light.material=new T.MeshBasicMaterial({color:0xf96737});
    this.playerMesh=operatorMesh(game.profile.character,game.profile.side==='attack',game.profile.primary);this.playerMesh.visible=false;this.world.add(this.playerMesh);
    game.traceCorpses=(origin,direction,distance)=>traceCorpseModels([game.player,...game.bots],actor=>actor===game.player?this.playerMesh:this.botMeshes.get(actor.id),origin,direction,distance);
    this.setGun(game.weapon.id);this.mode='game';this.syncBots(game);
  }
  endGame(){
    this.shotEffects?.dispose();this.bloodEffects?.dispose();this.shotEffects=null;this.bloodEffects=null;
    if(this.world)this.dispose(this.world);if(this.gun)this.dispose(this.gun);
    this.world=null;this.gun=null;this.gunID=null;this.playerMesh=null;this.bombMesh=null;this.botMeshes.clear();this.pendingShots=[];this.pendingHits=[];
    this.renderer.renderLists.dispose();this.mode='menu';this.menuLayout=null;this.pacer.invalidate();this.resolution.reset();this.recoilMotion.reset();this.recoil=0;this.aimBlend=0;
  }
  syncBots(game){
    const reset=this.visualRound!==game.round;if(reset){this.visualRound=game.round;this.deathElapsed=0;this.spectatorId=null;}
    for(const actor of [game.player,...game.bots]){
      let mesh=actor===game.player?this.playerMesh:this.botMeshes.get(actor.id);
      if(actor!==game.player&&mesh&&mesh.userData.networkIdentity!==undefined&&mesh.userData.networkIdentity!==`${actor.character}:${actor.team}`){this.dispose(mesh);this.botMeshes.delete(actor.id);mesh=null;}
      if(!mesh){mesh=operatorMesh(actor.character||['omoh','fox','star'][(actor.id-1)%3],actor.team==='attack',actor.weapon||null);this.world.add(mesh);this.botMeshes.set(actor.id,mesh);
        mesh.userData.networkIdentity=`${actor.character}:${actor.team}`;
        if(actor.team===game.player.team){const marker=textPlane('队友','#86ddff',.6,.16);marker.position.y=2.06;mesh.add(marker);mesh.userData.teamMarker=marker;}
      }
      if(reset){mesh.userData.dead=false;mesh.userData.lastX=undefined;playCF(mesh,'idle',{restart:true});}
      if(mesh.userData.heldGun&&mesh.userData.heldGun.id!==actor.weapon){const gun=weaponMesh(actor.weapon);gun.scale.multiplyScalar(.82);this.dispose(mesh.userData.gun);mesh.add(gun);mesh.userData.gun=gun;Object.assign(mesh.userData.heldGun,{gun,id:actor.weapon});}
      const moving=mesh.userData.lastX!==undefined&&Math.hypot(actor.x-mesh.userData.lastX,actor.z-mesh.userData.lastZ)>.0001;
      if(actor.dead&&!mesh.userData.dead){playCF(mesh,'death',{once:true,hold:true,restart:true});mesh.userData.dead=true;}
      else if(!actor.dead)playCF(mesh,moving?'run':'idle');
      mesh.userData.lastX=actor.x;mesh.userData.lastZ=actor.z;mesh.position.set(actor.x,actor.y,actor.z);mesh.rotation.y=-actor.yaw;mesh.visible=actor===game.player?actor.dead:true;
      const marker=mesh.userData.teamMarker;if(marker){marker.visible=!actor.dead;marker.quaternion.copy(mesh.quaternion).invert().multiply(this.camera.quaternion);}
    }
  }
  setGun(id){this.shotEffects?.clearPlayerFlash();this.pendingShots=this.pendingShots.filter(e=>e.type==='botShot');this.recoilMotion.reset();this.recoil=0;this.aimBlend=0;if(this.gun)this.dispose(this.gun);this.gun=weaponMesh(id,true,this.profile.character,this.profile.side);this.viewScene.add(this.gun);this.gun.position.set(.26,-.24,-.44);this.gun.rotation.set(0,0,0);this.gun.renderOrder=10;this.gunID=id;this.meleeSwing=0;playCF(this.gun,'draw',{once:true,restart:true,duration:.35});}
  event(e){
    if(e.type==='switch'&&e.weapon){this.setGun(e.weapon);return;}
    if(e.type==='round'){this.deathElapsed=0;this.spectatorId=null;this.pendingShots=[];this.pendingHits=[];this.shotEffects?.clear();this.bloodEffects?.clear();this.recoilMotion.reset();this.recoil=0;this.aimBlend=0;if(e.weapon)this.setGun(e.weapon);}
    if(e.type==='actorHit'||e.type==='corpseHit'){this.pendingHits.push(e);return;}
    if(e.type==='botShot'&&e.origin&&e.to){this.pendingShots.push(e);return;}
    if(e.type==='reload'&&(!e.weapon||e.weapon===this.gunID)){this.recoilMotion.reset();this.recoil=0;this.meleeSwing=0;this.shotEffects?.clearPlayerFlash();this.pendingShots=this.pendingShots.filter(shot=>shot.type==='botShot');playCF(this.gun,'reload',{once:true,restart:true,duration:e.duration});}
    if(e.type==='shot'){
      if(e.weapon!==this.gunID)return;
      playCF(this.gun,'shoot',{once:true,restart:true,...(WEAPONS[e.weapon]?.slot==='melee'?{duration:WEAPONS[e.weapon].interval}:{})});
      if(WEAPONS[e.weapon]?.slot==='melee'){this.recoilMotion.reset();this.recoil=0;if(e.weapon==='knife')this.meleeSwing=.45;return;}
      this.recoilMotion.kick(e.weapon,visualRecoilScale(e.recoil,WEAPONS[e.weapon]?.recoil,this.aimBlend>.5));
      this.pendingShots.push(e);
    }
  }
  renderShots(game,dt){
    // Both scenes have their current camera, bone and held-weapon transforms now.
    this.camera.updateMatrixWorld(true);this.world.updateMatrixWorld(true);this.gun.updateMatrixWorld(true);
    this.shotEffects.update(game.paused?0:dt);
    this.bloodEffects.update(game.paused?0:dt,this.camera);
    for(const hit of this.pendingHits.splice(0)){
      // The local player's body is hidden in first person; keep the existing hurt HUD.
      this.bloodEffects.emit(hit,{spray:hit.id!==game.player.id||game.player.dead});
    }
    this.bloodEffects.update(0,this.camera);
    if(!this.gun.visible)this.shotEffects.clearPlayerFlash();
    for(const e of this.pendingShots.splice(0)){
      if(e.type==='shot'){
        const anchor=this.gun.userData.muzzle;if(game.player.dead||e.weapon!==this.gunID||!anchor)continue;
        const follow=()=>anchor.getWorldPosition(new T.Vector3()),muzzle=follow().applyMatrix4(this.camera.matrixWorld).toArray();
        this.shotEffects.emit({...e,muzzle,firstPerson:true,showFlash:this.gun.visible,follow,trace:traceWorld});
      }else{
        const mesh=this.botMeshes.get(e.id),anchor=mesh?.userData.gun?.userData.muzzle;if(!anchor||mesh.userData.dead)continue;
        const delta=new T.Vector3(...e.to).sub(new T.Vector3(...e.origin)),distance=delta.length();if(distance<.001)continue;
        const follow=()=>anchor.getWorldPosition(new T.Vector3());
        this.shotEffects.emit({...e,muzzle:follow().toArray(),dir:delta.divideScalar(distance).toArray(),distance,follow,trace:traceWorld});
      }
    }
  }
  render(game,dt,time){
    if(document.hidden){this.pacer.invalidate();this.resolution.reset();return;}
    const mode=this.mode==='menu'?'menu':game?.paused?'paused':'game',elapsed=this.pacer.consume(mode,dt);if(elapsed===null)return;dt=elapsed;
    if(mode==='game'){const ratio=this.resolution.sample(dt);if(ratio!==null)this.renderer.setPixelRatio(ratio);}else this.resolution.reset();
    if(this.mode==='menu'){
      if(!this.menuLayout||time-this.menuLayout.time>.25){const pane=['warehouse-preview','lobby-preview'].map(id=>document.getElementById(id)).find(el=>el&&el.getClientRects().length&&el.getBoundingClientRect().width>1&&el.getBoundingClientRect().height>1);this.menuLayout={time,rect:pane?.getBoundingClientRect()||{left:0,top:0,right:innerWidth,bottom:innerHeight,width:innerWidth,height:innerHeight}};}
      const rect=this.menuLayout.rect;
      const left=Math.max(0,rect.left),top=Math.max(0,rect.top),right=Math.min(innerWidth,rect.right),bottom=Math.min(innerHeight,rect.bottom),width=Math.max(1,right-left),height=Math.max(1,bottom-top);
      const camera=this.menuCamera;camera.aspect=width/height;camera.fov=this.preview==='weapon'?31:33;
      this.display.rotation.y=(this.manualRotation||0)+(this.preview==='weapon'?Math.sin(time*.35)*.22:Math.sin(time*.3)*.07-.15);
      const size=this.previewBounds.getSize(new T.Vector3()),center=this.previewBounds.getCenter(new T.Vector3()),angle=this.display.rotation.y;
      const halfFov=T.MathUtils.degToRad(camera.fov*.5),span=this.preview==='weapon'?Math.max(size.x,size.z):Math.abs(Math.cos(angle))*size.x+Math.abs(Math.sin(angle))*size.z,distance=Math.max(size.y/(2*Math.tan(halfFov)),span/(2*Math.tan(halfFov)*camera.aspect))*(this.preview==='weapon'?1.22:1.12)+size.z*(this.preview==='weapon'?.5:.2);
      camera.position.set(center.x,center.y+distance*.055,center.z+Math.max(2.4,distance));camera.lookAt(center);camera.updateProjectionMatrix();
      animateCF(this.display,dt);
      this.renderer.setScissorTest(false);this.renderer.setViewport(0,0,innerWidth,innerHeight);this.renderer.setClearColor(0x272a2b,1);this.renderer.clear();
      this.renderer.setViewport(left,innerHeight-bottom,width,height);this.renderer.setScissor(left,innerHeight-bottom,width,height);this.renderer.setScissorTest(true);this.renderer.render(this.menu,camera);
      this.renderer.setScissorTest(false);this.renderer.setViewport(0,0,innerWidth,innerHeight);this.frameSerial++;return;
    }
    if(!game||!this.world)return;
    this.syncBots(game);const p=game.player;
    this.camera.position.set(p.x,p.y+(p.dead?.7:1.6),p.z);this.camera.rotation.set(p.pitch,p.yaw,0,'YXZ');
    // Three.js positive camera pitch looks up; yaw uses the opposite sign.
    this.camera.rotation.y=-p.yaw;
    if(p.dead&&game.spectator.mode==='free'){
      const s=game.spectator;this.spectatorId=null;this.camera.position.set(s.x,s.y,s.z);this.camera.rotation.set(s.pitch,-s.yaw,0,'YXZ');
    }else if(p.dead){
      if(!game.paused)this.deathElapsed+=dt;
      const watched=this.deathElapsed>2.2?game.aliveAllies[0]:null;this.spectatorId=watched?.id??null;const actor=watched||p,eye=new T.Vector3(actor.x,actor.y+(watched?1.55:1),actor.z),desired=new T.Vector3(-Math.sin(actor.yaw)*2.8,watched?.9:1.15,Math.cos(actor.yaw)*2.8),distance=desired.length(),direction=desired.clone().normalize();let safe=Math.min(distance,Math.max(.2,traceWorld(eye.toArray(),direction.toArray(),distance)-.2));this.camera.position.copy(eye).addScaledVector(direction,safe);this.camera.lookAt(actor.x,actor.y+(watched?1.25:.65),actor.z);
    }else{this.deathElapsed=0;this.spectatorId=null;}
    const motionTime=game.paused?0:dt,targetFov=!p.dead&&game.aim?(game.weapon.scoped?24:49):72;this.camera.fov+=(targetFov-this.camera.fov)*(1-Math.exp(-motionTime*14));this.camera.updateProjectionMatrix();
    if(this.gunID!==game.weapon.id)this.setGun(game.weapon.id);
    this.gun.visible=!p.dead&&!(game.aim&&game.weapon.scoped);if(p.dead)this.recoilMotion.reset();this.recoilMotion.update(motionTime);this.aimBlend=approachAim(this.aimBlend,!p.dead&&game.aim,motionTime);const kick=this.recoilMotion.pose();this.recoil=kick.back;
    // Lower the proximal arms below the frame; tilt the complete rig back up
    // so the muzzle keeps its familiar height without changing the grip.
    this.gun.rotation.z=kick.roll;
    if(this.gun.userData.cf||this.gun.userData.viewRig){this.gun.position.set(-.08*this.aimBlend+kick.side,(['axe','shovel'].includes(this.gunID)?-.13:-.095)+kick.lift,-.04+kick.back);this.gun.rotation.x=.09+kick.pitch;}else{this.gun.position.set(.26-.22*this.aimBlend+kick.side,-.24-(game.reloading>0?.18:0)+Math.sin(time*3)*.003+kick.lift,-.44+kick.back);this.gun.rotation.x=kick.pitch+(game.reloading>0?-.5:0);}
    if(this.gunID==='knife'){if(!game.paused)this.meleeSwing=Math.max(0,this.meleeSwing-dt);const swing=Math.sin((1-this.meleeSwing/.45)*Math.PI);this.gun.rotation.z=-swing*.7;this.gun.rotation.x-=swing*.35;this.gun.position.z-=swing*.23;}
    animateCF(this.world,game.paused?0:dt);animateCF(this.gun,game.paused?0:dt);
    this.bombMesh.visible=!!game.bomb;if(game.bomb)this.bombMesh.position.set(game.bomb.x,game.bomb.y+.09,game.bomb.z);
    this.renderShots(game,dt);
    this.renderer.render(this.world,this.camera);this.viewCamera.aspect=this.camera.aspect;this.viewCamera.fov=this.camera.fov;this.viewCamera.updateProjectionMatrix();this.renderer.autoClear=false;this.renderer.clearDepth();this.renderer.render(this.viewScene,this.viewCamera);this.renderer.autoClear=true;this.frameSerial++;
  }
}
