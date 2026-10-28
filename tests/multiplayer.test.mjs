import test from 'node:test';
import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
import {RoomMatch} from '../server/match.js';
import {createRoomServer} from '../server/index.mjs';
import {NetworkGame,serverAddress} from '../src/network.js';
import {MAP} from '../src/map.js';
import {fireOrigin} from './map-fixtures.mjs';

const members=[{key:'host',name:'房主',side:'attack',profile:{primary:'m4'}},{key:'guest',name:'朋友',side:'defend',profile:{primary:'ak',character:'fox'}}];
const make=()=>new RoomMatch(structuredClone(members),'easy',1234);
const actor=(g,key)=>[g.player,...g.bots].find(a=>a.id===g.humans.get(key).id);
const tick=(g,n,input={})=>{for(let i=0;i<n;i++){for(const key of g.humans.keys())g.inputFor(key,{yaw:actor(g,key).yaw,pitch:0,...input[key]},i*33);g.update(1/30,i*33);}};

test('each room member replaces one bot and sees their own actor as zero',()=>{
  const g=make();assert.equal(g.bots.length,9);assert.equal([g.player,...g.bots].filter(a=>a.human).length,2);
  const snapshot=g.snapshot('guest');assert.equal(snapshot.player.id,0);assert.equal(snapshot.player.team,'defend');assert.equal(snapshot.player.character,'fox');assert.equal(snapshot.weapons[0],'ak');assert.equal(snapshot.bots.filter(a=>a.team==='defend').length,4);
  assert.equal(new Set([snapshot.player,...snapshot.bots].map(a=>a.id)).size,10);
});
test('round clock advances once and bots do not take over remote humans',()=>{
  const g=make();tick(g,90);assert.equal(g.phase,'live');const p=actor(g,'guest'),before={x:p.x,z:p.z};tick(g,6);assert.ok(Math.abs(g.time-119.8)<1e-6);assert.deepEqual({x:p.x,z:p.z},before);
});
test('per-player fire, damage, ammo, kill feedback and event remapping are isolated',()=>{
  const g=make();g.phase='live';g.updateBots=()=>{};const h=actor(g,'host'),p=actor(g,'guest');
  Object.assign(p,{...fireOrigin,yaw:0,pitch:0});Object.assign(h,{x:p.x,y:p.y,z:p.z-4,hp:1});
  g.inputFor('guest',{yaw:0,pitch:0,trigger:true},0);g.update(1/30,0);
  assert.equal(h.dead,true);assert.equal(g.humans.get('guest').state.ammo[0].clip,29);assert.equal(g.humans.get('host').state.ammo[0].clip,30);
  const events=g.events.splice(0),own=g.snapshot('guest',events).events,other=g.snapshot('host',events).events;
  assert.equal(own.find(e=>e.type==='kill').killer,0);assert.equal(own.find(e=>e.type==='kill').reward.character,'fox');
  assert.ok(own.some(e=>e.type==='shot'));assert.ok(other.some(e=>e.type==='botShot'));assert.ok(other.some(e=>e.type==='hurt'));assert.ok(!other.some(e=>e.type==='hit'));
});
test('weapon commands, jumping and stale input timeout apply only to sender',()=>{
  const g=make();g.phase='live';g.updateBots=()=>{};g.command('guest','switch',1);g.command('guest','jump');g.inputFor('guest',{x:1,yaw:0,pitch:0},0);g.update(1/30,0);
  assert.equal(g.humans.get('guest').state.slot,1);assert.equal(g.humans.get('host').state.slot,0);assert.equal(actor(g,'guest').grounded,false);
  const p=actor(g,'guest'),x=p.x,z=p.z;g.update(1/30,1000);assert.equal(p.x,x);assert.equal(p.z,z);
});
test('remote player can plant and defuse, and new rounds restore human identities',()=>{
  const g=make();g.phase='live';g.updateBots=()=>{};
  const {x,y,z}=MAP.sites[0];Object.assign(actor(g,'host'),{x,y,z});tick(g,92,{host:{interact:true}});assert.equal(g.bomb?.site,'A');
  Object.assign(actor(g,'guest'),{x,y,z});tick(g,151,{guest:{interact:true}});assert.equal(g.score.defend,1);assert.equal(g.phase,'over');
  tick(g,90);assert.equal(g.round,2);assert.equal(g.phase,'ready');assert.equal(actor(g,'guest').character,'fox');assert.equal(actor(g,'guest').hp,100);
});
test('client pause keeps receiving authoritative updates without locally advancing combat',()=>{
  const g=make(),messages=[],client=new NetworkGame(g.snapshot('guest'),m=>messages.push(m));client.paused=true;g.phase='live';g.updateBots=()=>{};tick(g,3);client.applySnapshot(g.snapshot('guest'));client.update(.05,{fire:true,x:1});
  assert.equal(client.paused,true);assert.equal(client.time,g.time);assert.equal(messages.at(-1).input.fire,undefined);assert.equal(client.ammo[0].clip,30);
});
test('server URL normalization works for browser, IPA and secure origins',()=>{
  assert.equal(serverAddress('',{protocol:'http:',hostname:'127.0.0.1',port:'4173'}),'ws://127.0.0.1:8787/rooms');
  assert.equal(serverAddress('https://game.example.com'),'wss://game.example.com/rooms');assert.throws(()=>serverAddress('',{protocol:'file:'}));assert.throws(()=>serverAddress('ws://example.com',{protocol:'https:'}));
});
test('client positions and health cannot override authority and backpack choice survives a round',()=>{
  const g=make();g.phase='live';g.updateBots=()=>{};const p=actor(g,'guest'),before=p.hp;
  g.inputFor('guest',{x:1e20,z:NaN,yaw:Infinity,pitch:99,hp:9999,position:[0,0,0]},0);
  assert.equal(g.humans.get('guest').input.x,1);assert.equal(g.humans.get('guest').input.z,0);assert.equal(g.humans.get('guest').input.pitch,1.25);assert.equal(p.hp,before);
  g.command('guest','backpack',2);g.update(1/30,0);assert.equal(g.humans.get('guest').state.activeBackpack,2);
  g.endRound('attack','test');tick(g,90);assert.equal(g.humans.get('guest').state.activeBackpack,2);assert.equal(g.humans.get('guest').state.weapons[0],'awm');
});
test('online corpse feedback is visual only and does not double a fresh lethal hit',()=>{
  const g=make(),snapshot=g.snapshot('guest'),client=new NetworkGame(snapshot,()=>{}),corpse=snapshot.bots[0];corpse.dead=true;corpse.hp=0;
  client.traceCorpses=()=>[{id:corpse.id,position:[1,2,3],distance:2}];
  const shot={type:'shot',origin:[0,2,3],dir:[1,0,0],distance:4,weapon:'ak'};
  client.applySnapshot({...snapshot,events:[shot]});assert.ok(client.events.some(e=>e.type==='corpseHit'));assert.equal(client.bots[0].hp,0);
  client.events=[];client.applySnapshot({...snapshot,events:[shot,{type:'kill',id:corpse.id}]});assert.ok(!client.events.some(e=>e.type==='corpseHit'));
});

async function connect(url){
  const ws=new WebSocket(url),messages=[];ws.on('message',raw=>messages.push(JSON.parse(raw)));
  await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
  return {ws,messages,send:m=>ws.send(JSON.stringify(m)),wait:async(predicate)=>{const end=Date.now()+6000;while(Date.now()<end){const index=messages.findIndex(predicate);if(index>=0)return messages.splice(index,1)[0];await new Promise(r=>setTimeout(r,15));}throw new Error('WebSocket response timed out');}};
}
test('real sockets enforce rooms, readiness, host start, synchronization, leave and host migration',async()=>{
  const app=createRoomServer({port:0,host:'127.0.0.1'}),clients=[];
  try{
    const address=await app.ready,url=`ws://127.0.0.1:${address.port}/rooms`;
    const a=await connect(url),b=await connect(url),c=await connect(url);clients.push(a,b,c);
    a.send({type:'create',difficulty:'hard',name:'A',profile:{side:'attack'}});const ar=await a.wait(m=>m.type==='room'),code=ar.room.code;assert.match(code,/^\d{6}$/);
    b.send({type:'join',code:'000000'});assert.match((await b.wait(m=>m.type==='error')).message,/不存在/);
    b.send({type:'join',code,name:'B',profile:{side:'defend'}});await b.wait(m=>m.type==='room');await a.wait(m=>m.type==='room'&&m.room.members.length===2);
    b.send({type:'start'});assert.match((await b.wait(m=>m.type==='error')).message,/房主/);
    a.send({type:'start'});assert.match((await a.wait(m=>m.type==='error')).message,/准备/);
    b.send({type:'ready'});await a.wait(m=>m.type==='room'&&m.room.members[1].ready);a.send({type:'start'});
    const sa=await a.wait(m=>m.type==='start'),sb=await b.wait(m=>m.type==='start');assert.equal(sa.snapshot.profile.difficulty,'hard');assert.equal(sb.snapshot.player.team,'defend');
    c.send({type:'join',code});assert.match((await c.wait(m=>m.type==='error')).message,/正在对局/);
    const room=app.rooms.get(code);room.match.phase='live';room.match.updateBots=()=>{};
    const before=actor(room.match,room.members[1].key).x;
    b.send({type:'input',input:{x:1,yaw:0,pitch:0}});
    await b.wait(m=>m.type==='snapshot'&&m.snapshot.player.x>before+.05);
    const mirrored=await a.wait(m=>m.type==='snapshot'&&m.snapshot.bots.some(p=>p.human&&p.x>before+.05));assert.equal(mirrored.snapshot.bots.filter(p=>p.human).length,1);
    const key=room.members[1].key;a.ws.close();await b.wait(m=>m.type==='room'&&m.room.host===key);assert.equal(room.members.length,1);
    room.match.endRound('defend','test');tick(room.match,90);assert.equal(room.match.player.team,'defend');assert.equal(room.match.player.name,'B');
    b.ws.close();const end=Date.now()+2000;while(app.rooms.size&&Date.now()<end)await new Promise(r=>setTimeout(r,20));assert.equal(app.rooms.size,0);
  }finally{for(const c of clients)c.ws.terminate();await app.close();}
});
test('rooms cap teams at five, reject the eleventh player and stay isolated',async()=>{
  const app=createRoomServer({port:0,host:'127.0.0.1'}),clients=[];
  try{
    const address=await app.ready,url=`ws://127.0.0.1:${address.port}/rooms`;
    for(let i=0;i<11;i++)clients.push(await connect(url));
    clients[0].send({type:'create'});const {room}=await clients[0].wait(m=>m.type==='room');
    for(let i=1;i<10;i++){clients[i].send({type:'join',code:room.code,profile:{side:'attack'}});await clients[i].wait(m=>m.type==='room');}
    const full=await clients[0].wait(m=>m.type==='room'&&m.room.members.length===10);assert.equal(full.room.members.filter(m=>m.side==='attack').length,5);assert.equal(full.room.members.filter(m=>m.side==='defend').length,5);
    clients[0].send({type:'side',side:'defend'});assert.match((await clients[0].wait(m=>m.type==='error')).message,/已满/);
    clients[10].send({type:'join',code:room.code});assert.match((await clients[10].wait(m=>m.type==='error')).message,/已满/);
    clients[10].send({type:'create'});const separate=await clients[10].wait(m=>m.type==='room');assert.notEqual(separate.room.code,room.code);assert.equal(separate.room.members.length,1);assert.equal(app.rooms.size,2);
  }finally{for(const client of clients)client.ws.terminate();await app.close();}
});
