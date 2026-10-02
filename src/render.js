import * as T from 'three';
import { MAP } from './map.js';
import { CHARACTERS } from './catalog.js';
const mat=(c,metal=.1,rough=.8)=>new T.MeshStandardMaterial({color:c,metalness:metal,roughness:rough});
function box(g,w,h,d,c,x=0,y=0,z=0){const m=new T.Mesh(new T.BoxGeometry(w,h,d),typeof c==='object'?c:mat(c));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;}
function cylinder(g,r,h,c,x,y,z,segments=10){const m=new T.Mesh(new T.CylinderGeometry(r,r,h,segments),mat(c));m.position.set(x,y,z);m.castShadow=true;g.add(m);return m;}
export function weaponMesh(id='m4'){
  const g=new T.Group(),steel=mat(0x333b3d,.65,.42),dark=mat(0x192225,.3),wood=mat(0x795035,.1);
  if(id==='knife'){
    box(g,.065,.07,.36,dark,0,0,.11);box(g,.18,.03,.035,steel,0,0,-.08);const blade=box(g,.075,.025,.36,0xc0c6c4,0,.008,-.27);blade.rotation.z=.18;return g;
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
export function operatorMesh(character='ranger',enemy=false,weaponID=null){
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
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,profile.quality==='high'?1.6:1));this.renderer.shadowMap.enabled=profile.quality==='high';this.renderer.shadowMap.type=T.PCFSoftShadowMap;
    this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.18;
    this.camera=new T.PerspectiveCamera(68,1,.055,150);this.camera.rotation.order='YXZ';this.mode='menu';this.menu=new T.Scene();this.menu.background=new T.Color(0x111a1c);this.menu.fog=new T.FogExp2(0x111a1c,.038);
    this.menu.add(new T.HemisphereLight(0xc4d8ce,0x555043,2.8));const key=new T.SpotLight(0xd8e5d6,170,30,.7,.7);key.position.set(-3,6,4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);this.menu.add(key);
    const fill=new T.DirectionalLight(0xd6e7de,2.5);fill.position.set(2,3,6);this.menu.add(fill);
    const rim=new T.PointLight(0xd49c45,25,12);rim.position.set(2,2,-3);this.menu.add(rim);
    box(this.menu,50,.2,50,0x202827,0,-.16,0);box(this.menu,20,8,.3,0x1e282a,0,3,-5);
    for(let i=-4;i<5;i++){box(this.menu,.055,6,.08,0x3e4846,i*2,2,-4.8);box(this.menu,1.7,.035,.08,0x48514a,i*2,4.5,-4.6);}
    for(let i=0;i<5;i++)box(this.menu,1.4,1.3,1,0x303e36,-5+i*.3,.55+i*.1,-2-i*.9);
    const ring=new T.Mesh(new T.CylinderGeometry(1.25,1.45,.12,48),mat(0x3b4540,.7));ring.position.y=-.03;this.menu.add(ring);
    this.display=new T.Group();this.menu.add(this.display);this.showOperator(profile.character,profile.primary);
    const label=textPlane('SECTOR 07','#77867a',3,.7);label.position.set(0,2.5,-4.75);this.menu.add(label);
    this.world=null;this.botMeshes=new Map();this.effects=[];this.recoil=0;this.flash=0;this.resize();
    window.addEventListener('resize',()=>this.resize());
  }
  quality(value){this.renderer.setPixelRatio(Math.min(devicePixelRatio,value==='high'?1.6:1));this.renderer.shadowMap.enabled=value==='high';}
  resize(){this.renderer.setSize(innerWidth,innerHeight,false);this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();}
  clearDisplay(){while(this.display.children.length)this.dispose(this.display.children[0]);}
  dispose(node){node.traverse(o=>{o.geometry?.dispose();if(o.material){const a=Array.isArray(o.material)?o.material:[o.material];for(const m of a){m.map?.dispose();m.dispose();}}});node.removeFromParent();}
  showOperator(id,weaponID='m4'){this.clearDisplay();const soldier=operatorMesh(id,false,weaponID);soldier.rotation.y=Math.PI+.3;this.display.add(soldier);this.preview='operator';}
  showWeapon(id){this.clearDisplay();const gun=weaponMesh(id);gun.scale.setScalar(2.1);gun.position.y=1.1;gun.rotation.y=Math.PI/2;this.display.add(gun);this.preview='weapon';}
  start(game){
    if(this.world)this.dispose(this.world);this.effects=[];this.botMeshes.clear();this.world=new T.Scene();this.world.background=new T.Color(0xb3b6aa);this.world.fog=new T.Fog(0xb3b6aa,30,80);
    this.world.add(new T.HemisphereLight(0xdde6e1,0x656451,2.4));const sun=new T.DirectionalLight(0xffefd0,3);sun.position.set(-15,28,12);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-28,right:28,top:28,bottom:-28,near:1,far:75});sun.shadow.bias=-.0005;this.world.add(sun);
    const floor=box(this.world,43,.2,43,0x8d8c78,0,-.15,0);
    const grid=new T.GridHelper(42,28,0x8c8875,0x999680);grid.position.y=-.04;this.world.add(grid);
    for(const b of MAP.obstacles){
      box(this.world,b.w,b.h,b.d,b.kind==='container'?0x597675:b.kind==='crate'?0x887759:0xa5a390,b.x,b.h/2,b.z);
      if(b.kind==='building'){box(this.world,b.w+.18,.2,b.d+.18,0x727970,b.x,b.h,b.z);for(const s of [-1,1]){const label=textPlane('07  /  DEPOT','#444a43',b.w*.7,.7);label.position.set(b.x,2.5,b.z+s*(b.d/2+.012));if(s===-1)label.rotation.y=Math.PI;this.world.add(label);}for(const x of [-1,1])box(this.world,1.4,.9,.06,0x384b4b,b.x+x*b.w*.25,2.8,b.z+b.d/2+.03);}
      if(b.kind==='container')for(let x=-b.w/2+.2;x<b.w/2;x+=.4)box(this.world,.035,b.h-.15,b.d+.05,0x475e5d,b.x+x,b.h/2,b.z);
      if(b.kind==='crate'){for(const y of [.2,b.h-.2])box(this.world,b.w+.03,.13,b.d+.03,0x505448,b.x,y,b.z);box(this.world,.13,b.h+.01,b.d+.03,0x505448,b.x, b.h/2,b.z);}
    }
    for(const site of MAP.sites){
      const marker=new T.Mesh(new T.RingGeometry(site.r-.12,site.r,48),new T.MeshBasicMaterial({color:site.id==='A'?0xc79b43:0x6c9eaa,side:T.DoubleSide}));marker.rotation.x=-Math.PI/2;marker.position.set(site.x,.015,site.z);this.world.add(marker);
      const label=textPlane(site.id,site.id==='A'?'#dcad50':'#8fc5d0',2,1.3);label.rotation.x=-Math.PI/2;label.position.set(site.x,.025,site.z);this.world.add(label);
    }
    for(let i=0;i<10;i++){const x=-26+(i%5)*13,z=i<5?-28:28;box(this.world,8,8+i%3*3,7,0x929b92,x,(8+i%3*3)/2,z);}
    this.bombMesh=box(this.world,.45,.15,.3,0x384133,0,.09,0);this.bombMesh.visible=false;
    const light=box(this.bombMesh,.04,.03,.04,0xef5b31,0,.09,0);light.material=new T.MeshBasicMaterial({color:0xf96737});
    this.setGun(game.weapon.id);this.mode='game';this.syncBots(game);
  }
  syncBots(game){
    for(const bot of game.bots){let mesh=this.botMeshes.get(bot.id);if(!mesh){mesh=operatorMesh(bot.team==='attack'?'ranger':'assault',true);this.world.add(mesh);this.botMeshes.set(bot.id,mesh);}mesh.position.set(bot.x,0,bot.z);mesh.rotation.y=-bot.yaw;mesh.visible=!bot.dead;}
  }
  setGun(id){if(this.gun)this.dispose(this.gun);this.gun=weaponMesh(id);this.camera.add(this.gun);if(this.world)this.world.add(this.camera);this.gun.position.set(.26,-.24,-.44);this.gun.rotation.set(0,0,0);this.gun.renderOrder=10;this.gun.traverse(o=>{if(o.material)o.material.depthTest=false;});this.gunID=id;}
  event(e){
    if(e.type==='shot'){
      this.recoil=.07;this.flash=.07;
      if(e.weapon==='knife')return;
      const from=new T.Vector3(...e.origin),to=from.clone().addScaledVector(new T.Vector3(...e.dir),Math.min(e.distance,65));from.y-=.12;
      const geo=new T.BufferGeometry().setFromPoints([from,to]),line=new T.Line(geo,new T.LineBasicMaterial({color:0xffd891,transparent:true,opacity:.8}));this.world.add(line);this.effects.push({node:line,time:.06});
    }
  }
  render(game,dt,time){
    if(this.mode==='menu'){
      this.camera.position.set(3.3,2.2,5.8);this.camera.lookAt(0,1.08,0);this.camera.fov=33;this.camera.updateProjectionMatrix();this.display.rotation.y=(this.manualRotation||0)+(this.preview==='weapon'?Math.sin(time*.35)*.22:Math.sin(time*.3)*.07-.15);
      this.renderer.render(this.menu,this.camera);return;
    }
    if(!game||!this.world)return;
    this.syncBots(game);const p=game.player;
    this.camera.position.set(p.x,p.dead?.7:1.6,p.z);this.camera.rotation.set(p.pitch,p.yaw,0,'YXZ');
    // Three.js positive camera pitch looks up; yaw uses the opposite sign.
    this.camera.rotation.y=-p.yaw;
    const targetFov=game.aim?(game.weapon.id==='awm'?24:49):72;this.camera.fov+=(targetFov-this.camera.fov)*Math.min(1,dt*14);this.camera.updateProjectionMatrix();
    if(this.gunID!==game.weapon.id)this.setGun(game.weapon.id);
    this.gun.visible=!p.dead&&!(game.aim&&game.weapon.id==='awm');this.recoil=Math.max(0,this.recoil-dt*.7);this.flash=Math.max(0,this.flash-dt);
    this.gun.position.set(game.aim?.04:.26,-.24-(game.reloading>0?.18:0)+Math.sin(time*3)*.003,-.44+this.recoil);this.gun.rotation.x=this.recoil*1.3+(game.reloading>0?-.5:0);
    this.bombMesh.visible=!!game.bomb;if(game.bomb)this.bombMesh.position.set(game.bomb.x,.09,game.bomb.z);
    for(let i=this.effects.length-1;i>=0;i--){this.effects[i].time-=dt;if(this.effects[i].time<=0){this.dispose(this.effects[i].node);this.effects.splice(i,1);}}
    this.renderer.render(this.world,this.camera);
  }
}
