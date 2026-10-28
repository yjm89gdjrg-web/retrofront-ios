import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {WEAPONS,WEAPON_SLOTS,sanitizeProfile} from '../src/catalog.js';
import {CF_WEAPON_ASSETS} from '../src/generated/cf-weapon-assets.js';
import {CF_MODELS} from '../src/generated/cf-models.js';
import {CF_SOUNDS} from '../src/generated/cf-sounds.js';
import {weaponMesh} from '../src/render.js';
import {playCF,animateCF,disposeCF} from '../src/cf-models.js';
import {Box3,Vector3} from 'three';

test('old saves gain secondary/melee defaults and cross-slot values cannot corrupt the loadout',()=>{
 assert.equal(sanitizeProfile({primary:'ak'}).secondary,'usp');assert.equal(sanitizeProfile({primary:'ak'}).melee,'knife');
 const p=sanitizeProfile({primary:'shovel',secondary:'scar',melee:'deagle'});assert.equal(p.primary,'m4');assert.equal(p.secondary,'usp');assert.equal(p.melee,'knife');
 for(const [slot,ids] of Object.entries(WEAPON_SLOTS))for(const id of ids)assert.equal(sanitizeProfile({[slot]:id})[slot],id);
});
test('selected weapons enter each round, preserve separate magazines and melee never spends ammo',()=>{
 const g=new Game({primary:'scar',secondary:'deagle',melee:'shovel'});assert.deepEqual(g.weapons,['scar','deagle','shovel']);g.phase='live';g.updateBots=()=>{};
 g.fire();assert.equal(g.ammo[0].clip,29);g.switchWeapon(1);assert.equal(g.player.weapon,'deagle');g.cooldown=0;g.fire();assert.equal(g.ammo[1].clip,6);
 g.reload();g.switchWeapon(2);assert.equal(g.reloading,0);g.cooldown=0;g.fire();assert.deepEqual(g.ammo[2],{clip:1,reserve:0});g.reload();assert.equal(g.reloading,0);
 g.switchWeapon(0);assert.equal(g.ammo[0].clip,29);g.beginRound();assert.deepEqual(g.weapons,['scar','deagle','shovel']);assert.equal(g.ammo[0].clip,30);assert.equal(g.ammo[1].clip,7);
});
test('switch emits the chosen weapon once; same slot, paused, dead and invalid input are silent',()=>{
 const g=new Game({secondary:'anaconda',melee:'axe'});g.events=[];g.switchWeapon(0);assert.equal(g.events.length,0);g.switchWeapon(1);assert.deepEqual(g.events.at(-1),{type:'switch',weapon:'anaconda',slot:1,duration:.35});
 g.events=[];g.switchWeapon(1);g.switchWeapon(NaN);g.switchWeapon(.5);g.paused=true;g.switchWeapon(2);assert.equal(g.slot,1);g.paused=false;g.player.dead=true;g.switchWeapon(2);assert.equal(g.events.length,0);
});
test('drawing locks firing until the weapon is raised',()=>{const g=new Game({secondary:'colt1911'});g.phase='live';g.updateBots=()=>{};g.switchWeapon(1);assert.equal(g.fire(),false);for(let i=0;i<6;i++)g.update(.05);assert.equal(g.fire(),false);g.update(.05);g.update(.01);assert.equal(g.fire(),true);assert.equal(g.ammo[1].clip,7);});
test('every imported weapon has usable action clips and every referenced sample is packaged',()=>{
 for(const [id,meta] of Object.entries(CF_WEAPON_ASSETS)){
  const data=CF_MODELS[id+'-view'];assert.ok(data.meshes.length>0,id);assert.ok(Object.keys(data.clips).some(n=>n.startsWith('idle')),id);assert.ok(data.clips.select||data.clips.draw,id);
  assert.ok(data.clips.prefire||data.clips.shoot1||data.clips.combo_1,id);if(WEAPONS[id].slot!=='melee')assert.ok(data.clips.reload,id);
  for(const name of [meta.fire,meta.draw,...Object.values(meta.audio).flat().map(e=>e.file)].filter(Boolean))assert.ok(CF_SOUNDS[name],`${id}: missing ${name}`);
 }
});
test('new native weapon actions stay finite and warehouse models contain no hand meshes',()=>{
 for(const id of Object.keys(CF_WEAPON_ASSETS)){
  const view=weaponMesh(id,true,'fox','attack');
  for(const action of ['idle','draw','shoot',...(WEAPONS[id].slot==='melee'?[]:['reload'])]){playCF(view,action,{once:action!=='idle',restart:true});for(const dt of [0,.15,.3,.6]){animateCF(view,dt);const size=new Box3().setFromObject(view).getSize(new Vector3());assert.ok(size.toArray().every(n=>Number.isFinite(n)&&n<10),`${id}/${action}`);}}
  const world=weaponMesh(id);let meshes=0;world.traverse(node=>{if(node.isMesh){meshes++;assert.ok(!/FVIEW_(HAND|ARM)|CSLC (hand|glove)|view_(skin|glove|finger)/i.test(node.material.name),id);}});assert.ok(meshes>0,id);disposeCF(view);
 }
});
