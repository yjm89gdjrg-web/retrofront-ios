import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {WEAPONS} from '../src/catalog.js';
import {NetworkGame} from '../src/network.js';
import {RoomMatch} from '../server/match.js';

const solo=primary=>{const game=new Game({primary});game.phase='live';game.events=[];game.updateBots=()=>{};return game;};
const room=primary=>{const game=new RoomMatch([{key:'host',name:'host',side:'attack',profile:{primary}}],'easy',123);game.phase='live';game.events=[];game.updateBots=()=>{};return game;};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,`${a} != ${b}`);

test('only a legal scoped reload exits ADS, without moving ammunition before completion',()=>{
 const game=solo('awm');game.aim=true;game.ammo[0].clip=2;const reserve=game.ammo[0].reserve;
 assert.equal(game.canReload,true);assert.equal(game.reload(),true);assert.equal(game.aim,false);assert.equal(game.reloading,WEAPONS.awm.reload);assert.equal(game.ammo[0].clip,2);assert.equal(game.ammo[0].reserve,reserve);
 assert.deepEqual(game.events,[{type:'reload',weapon:'awm',duration:WEAPONS.awm.reload}]);
 for(let i=0;i<61;i++)game.update(.05,{});assert.equal(game.ammo[0].clip,5);assert.equal(game.ammo[0].reserve,reserve-3);
 const rifle=solo('m4');rifle.aim=true;rifle.ammo[0].clip=2;assert.equal(rifle.reload(),true);assert.equal(rifle.aim,true);
});
test('paused, dead, full, empty-reserve, melee and non-live reloads do not change ADS or emit actions',()=>{
 const cases=[g=>g.paused=true,g=>g.player.dead=true,g=>g.ammo[0].clip=5,g=>g.ammo[0].reserve=0,g=>g.slot=2,g=>g.phase='ready',g=>g.reloading=1];
 for(const change of cases){const game=solo('awm');game.aim=true;game.ammo[0].clip=2;change(game);const before=game.reloading;assert.equal(game.canReload,false);assert.equal(game.reload(),false);assert.equal(game.aim,true);assert.equal(game.reloading,before);assert.deepEqual(game.events,[]);}
});
test('shot events carry firing-time recoil while preserving weapon stats and pitch cap',()=>{
 for(const aim of [false,true]){
  const game=solo('m4');game.aim=aim;game.player.pitch=.1;game.random=()=>.5;const clip=game.ammo[0].clip;
  assert.equal(game.fire(),true);const shot=game.events.find(e=>e.type==='shot'),kick=WEAPONS.m4.recoil*(aim?.65:1);near(shot.recoil,kick);near(game.player.pitch,.1+kick);assert.equal(game.ammo[0].clip,clip-1);assert.equal(game.cooldown,WEAPONS.m4.interval);
 }
 const capped=solo('m4');capped.player.pitch=1.195;assert.equal(capped.fire(),true);assert.equal(capped.player.pitch,1.2);
 const knife=solo('m4');knife.slot=2;knife.player.pitch=.2;assert.equal(knife.fire(),true);assert.equal(knife.events.find(e=>e.type==='shot').recoil,0);assert.equal(knife.player.pitch,.2);
});
test('late ADS changes do not reinterpret the shot recoil, and old event packets still work',()=>{
 const server=room('m4'),before=server.snapshot('host'),client=new NetworkGame(before,()=>{});
 server.withHuman(server.humans.get('host'),()=>{server.aim=false;server.fire();});const shot=server.events.find(e=>e.type==='shot');client.aim=true;client.applySnapshot(server.snapshot('host',[shot]));near(client.player.pitch,WEAPONS.m4.recoil);
 const legacy=new NetworkGame(before,()=>{});legacy.aim=true;const oldShot={...shot};delete oldShot.recoil;legacy.applySnapshot(server.snapshot('host',[oldShot]));near(legacy.player.pitch,WEAPONS.m4.recoil*.65);
});
test('initial and new-round snapshots do not kick twice, and death suppresses late shot impulses',()=>{
 const server=room('m4');server.withHuman(server.humans.get('host'),()=>server.fire());const shot=server.events.find(e=>e.type==='shot'),snapshot=server.snapshot('host',[shot]);
 const initial=new NetworkGame(snapshot,()=>{});near(initial.player.pitch,snapshot.player.pitch);
 const client=new NetworkGame(server.snapshot('host'),()=>{}),next={...snapshot,round:snapshot.round+1,player:{...snapshot.player,pitch:.12}};client.applySnapshot(next);near(client.player.pitch,.12);
 client.player.pitch=.2;client.applySnapshot({...next,player:{...next.player,dead:true,hp:0},events:[shot]});near(client.player.pitch,.2);assert.equal(client.aim,false);
});
test('network scoped reload shares the legal-action guard and auto reload events close the scope',()=>{
 const server=room('awm'),human=server.humans.get('host');human.state.ammo[0].clip=2;const messages=[],client=new NetworkGame(server.snapshot('host'),m=>messages.push(m));client.aim=true;
 assert.equal(client.reload(),true);assert.equal(client.aim,false);assert.equal(client.reloading,0);assert.equal(messages.at(-1).action,'reload');
 for(const invalid of [g=>g.paused=true,g=>g.player.dead=true,g=>g.ammo[0].clip=5,g=>g.ammo[0].reserve=0,g=>g.reloading=1]){const sent=[],c=new NetworkGame(server.snapshot('host'),m=>sent.push(m));c.aim=true;invalid(c);assert.equal(c.reload(),false);assert.equal(c.aim,true);assert.deepEqual(sent,[]);}
 const auto=new NetworkGame(server.snapshot('host'),()=>{});auto.aim=true;auto.applySnapshot({...server.snapshot('host'),reloading:3,events:[{type:'reload',weapon:'awm',duration:3}]});assert.equal(auto.aim,false);
});
