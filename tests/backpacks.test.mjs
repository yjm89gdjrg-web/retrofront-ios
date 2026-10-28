import test from 'node:test';import assert from 'node:assert/strict';
import {BACKPACK_COUNT,WEAPON_SLOTS,WEAPONS,sanitizeProfile,selectBackpack,equipBackpackWeapon} from '../src/catalog.js';
import {Game} from '../src/game.js';import {MAP} from '../src/map.js';
test('legacy loadout migrates intact into bag one; all five bags survive native JSON storage',()=>{
 const p=sanitizeProfile({primary:'an94',secondary:'anaconda',melee:'shovel',character:'fox'});
 assert.equal(BACKPACK_COUNT,5);assert.equal(p.backpacks.length,5);assert.deepEqual(p.backpacks[0],{primary:'an94',secondary:'anaconda',melee:'shovel'});
 for(let index=0;index<5;index++){assert.equal(selectBackpack(p,index),true);for(const [slot,ids]of Object.entries(WEAPON_SLOTS))assert.equal(equipBackpackWeapon(p,slot,ids[index%ids.length]),true);}
 const saved=JSON.stringify(p);assert.ok(new TextEncoder().encode(saved).length<8192);assert.deepEqual(sanitizeProfile(JSON.parse(saved)),p);
 assert.equal(p.activeBackpack,4);assert.equal(p.character,'fox');
});
test('editing one bag changes no other bag or profile; cross-slot equips and invalid indices are rejected',()=>{
 const p=sanitizeProfile(),other=sanitizeProfile(),before=structuredClone(p.backpacks);selectBackpack(p,4);equipBackpackWeapon(p,'primary','an94');
 assert.deepEqual(p.backpacks.slice(0,4),before.slice(0,4));assert.deepEqual(other.backpacks,before);
 const snapshot=JSON.stringify(p);for(const index of [-1,5,NaN,1.2,'2',null])assert.equal(selectBackpack(p,index),false);
 assert.equal(equipBackpackWeapon(p,'secondary','ak'),false);assert.equal(equipBackpackWeapon(p,'other','ak'),false);assert.equal(JSON.stringify(p),snapshot);
});
test('corrupt bag records and selection recover to five valid independent loadouts',()=>{
 for(const raw of [null,{}, {backpacks:[]}, {backpacks:[null,'bad',{primary:'knife',secondary:'ak',melee:'usp'}],activeBackpack:99}, {backpacks:Array(20).fill({primary:'ak'}),activeBackpack:'4'}]){
  const p=sanitizeProfile(raw);assert.equal(p.backpacks.length,5);assert.equal(p.activeBackpack,0);
  for(const bag of p.backpacks)for(const [slot,ids]of Object.entries(WEAPON_SLOTS))assert.ok(ids.includes(bag[slot]));
  p.backpacks[0].primary='m700';assert.notEqual(p.backpacks[1].primary,'m700');
 }
});
test('ready and untouched spawn can equip all five bags; active weapon, magazines and next round agree',()=>{
 for(const side of ['attack','defend']){const g=new Game({side});for(const i of [1,2,3,4,0]){
  g.aim=true;g.reloading=1;g.slot=1;g.events=[];assert.equal(g.selectBackpack(i),true);assert.equal(g.slot,0);assert.equal(g.aim,false);assert.equal(g.reloading,0);
  assert.deepEqual(g.weapons,Object.values(g.profile.backpacks[i]));assert.equal(g.player.weapon,g.weapons[0]);
  assert.deepEqual(g.ammo,g.weapons.map(id=>({clip:WEAPONS[id].clip,reserve:WEAPONS[id].reserve})));
  assert.deepEqual(g.events.map(e=>e.type),['switch','backpack']);assert.equal(g.selectBackpack(i),false);
 }g.phase='live';assert.equal(g.selectBackpack(4),true);g.beginRound();assert.equal(g.activeBackpack,4);assert.equal(g.weapon.id,'scar');assert.equal(g.canSelectBackpack,true);}
});
test('firing every weapon slot locks all backpacks so switching cannot refill ammunition',()=>{
 for(const slot of [0,1,2]){const g=new Game();g.phase='live';g.switchWeapon(slot);g.cooldown=0;assert.equal(g.fire(),true);const ammo=structuredClone(g.ammo);assert.equal(g.selectBackpack(1),false);assert.deepEqual(g.ammo,ammo);g.beginRound();assert.equal(g.selectBackpack(1),true);}
});
test('injury and leaving spawn lock the bag until the next round, including returning to spawn',()=>{
 const g=new Game();g.phase='live';g.updateBots=()=>{};g.damage(g.player,1,g.aliveEnemies[0]);assert.equal(g.canSelectBackpack,false);
 g.beginRound();g.phase='live';g.player.x+=4;g.update(.01);Object.assign(g.player,MAP.spawn[g.player.team],{grounded:true});assert.equal(g.canSelectBackpack,false);assert.equal(g.selectBackpack(2),false);
 g.beginRound();assert.equal(g.selectBackpack(2),true);
});
test('paused, airborne, dead, round-end, finished and invalid swaps have no side effects',()=>{
 for(const mutate of [g=>g.paused=true,g=>g.player.grounded=false,g=>g.player.dead=true,g=>g.phase='over',g=>g.phase='finished',g=>g.player.y+=2]){
  const g=new Game();mutate(g);const before=JSON.stringify([g.weapons,g.ammo,g.profile,g.events]);assert.equal(g.selectBackpack(4),false);assert.equal(JSON.stringify([g.weapons,g.ammo,g.profile,g.events]),before);
 }
 const g=new Game();for(const index of [-1,5,.1,'1',NaN])assert.equal(g.selectBackpack(index),false);assert.equal(g.weapon.id,'m4');
});
