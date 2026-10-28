import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import crypto from 'node:crypto';
import {Game} from '../src/game.js';
import {fireOrigin} from './map-fixtures.mjs';
import {recordPlayerKill,KILL_CHAIN_WINDOW} from '../src/kill-feedback.js';
import {CF_SOUNDS} from '../src/generated/cf-sounds.js';
const live=()=>{const g=new Game();g.phase='live';g.events=[];return g;};
test('only confirmed opposing kills by the player generate personal rewards',()=>{
 const g=live(),enemy=g.aliveEnemies[0],ally=g.aliveAllies[0];
 g.damage(enemy,10,g.player);g.damage(ally,100,g.player);assert.equal(g.events.some(e=>e.reward),false);
 g.damage(enemy,100,ally);assert.equal(g.events.some(e=>e.reward),false);
 const victim=g.aliveEnemies[0];g.damage(victim,100,g.player);g.damage(victim,100,g.player);
 const rewards=g.events.filter(e=>e.reward);assert.equal(rewards.length,1);assert.equal(rewards[0].reward.tier,1);assert.equal(g.player.kills,1);
});
test('five opponents trigger all five rewards including the round-ending kill',()=>{
 const g=live();assert.equal(g.aliveEnemies.length,5);
 for(const [i,bot] of [...g.aliveEnemies].entries()){g.elapsed=i;g.damage(bot,100,g.player);}
 const rewards=g.events.filter(e=>e.reward).map(e=>e.reward);
 assert.deepEqual(rewards.map(e=>e.tier),[1,2,3,4,5]);assert.deepEqual(rewards.map(e=>e.voice),['kill_1','kill_2','kill_3','kill_4','kill_5']);
 assert.equal(g.phase,'over');assert.equal(g.events.at(-2).reward.tier,5);assert.equal(g.events.at(-1).type,'roundEnd');
 assert.equal(new Game().bots.length,9,'normal gameplay is five versus five');
});
test('streak expires, resets on death and cannot carry across rounds',()=>{
 const g=live();g.checkElimination=()=>{};g.damage(g.aliveEnemies[0],100,g.player);g.elapsed=KILL_CHAIN_WINDOW+.01;g.damage(g.aliveEnemies[0],100,g.player);
 assert.equal(g.events.filter(e=>e.reward).at(-1).reward.tier,1);g.damage(g.player,100,g.aliveEnemies[0]);assert.equal(g.killChain.count,0);
 g.beginRound();assert.equal(g.killChain.count,0);assert.equal(g.killChain.last,-Infinity);
});
test('headshot and melee rewards use the attacker voice and preserve multi-kill priority',()=>{
 const chain={count:0,last:-Infinity};let r=recordPlayerKill(chain,0,{character:'fox',headshot:true});
 assert.equal(r.voice,'headshot');assert.equal(r.gender,'female');assert.equal(r.icon,'assets/killmarks/headshot.png');
 r=recordPlayerKill(chain,1,{character:'fox',headshot:true});assert.equal(r.voice,'kill_2');assert.equal(r.tier,2);assert.match(r.detail,/爆头/);
 r=recordPlayerKill(chain,20,{character:'omoh',melee:true,headshot:true});assert.equal(r.voice,'knife');assert.equal(r.gender,'male');assert.equal(r.icon,'assets/killmarks/knife.png');
});
test('the weapon hit path passes lethal headshot information into the reward',()=>{
 const g=new Game({primary:'ak',character:'fox'});g.phase='live';Object.assign(g.player,{...fireOrigin,yaw:0,pitch:0});
 const victim=g.aliveEnemies[0];g.bots=[victim];Object.assign(victim,{x:fireOrigin.x,y:fireOrigin.y,z:fireOrigin.z-3,hp:1});g.random=()=>.5;g.events=[];g.fire();
 const event=g.events.find(e=>e.reward);assert.ok(event.reward.headshot);assert.equal(event.reward.voice,'headshot');assert.equal(event.reward.gender,'female');
});
test('reward tier clamps safely above five while retaining the actual count',()=>{
 const chain={count:0,last:-Infinity};let reward;for(let n=0;n<7;n++)reward=recordPlayerKill(chain,n,{});
 assert.equal(reward.count,7);assert.equal(reward.tier,5);assert.equal(reward.icon,'assets/killmarks/kill-5.png');
});
test('all seven images and fourteen non-silent PCM samples are offline and match their manifest',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../assets-source/cf/kill-feedback/manifest.json',import.meta.url)));
 assert.equal(manifest.entries.filter(e=>e.kind==='image').length,7);assert.equal(manifest.entries.filter(e=>e.kind==='audio').length,14);
 for(const entry of manifest.entries){
  const data=fs.readFileSync(new URL('../'+entry.output,import.meta.url));assert.equal(crypto.createHash('sha256').update(data).digest('hex'),entry.sha256);
  if(entry.kind==='image'){assert.equal(data.subarray(1,4).toString(),'PNG');assert.ok(data.readUInt32BE(16)>50);continue;}
  assert.equal(data.subarray(0,4).toString(),'RIFF');let pcm,format;
  for(let offset=12;offset+8<=data.length;){const size=data.readUInt32LE(offset+4),id=data.subarray(offset,offset+4).toString(),chunk=data.subarray(offset+8,offset+8+size);if(id==='fmt ')format=chunk;if(id==='data')pcm=chunk;offset+=8+size+(size%2);}
  assert.equal(format.readUInt16LE(0),1);assert.equal(format.readUInt16LE(2),1);assert.equal(format.readUInt32LE(4),22050);assert.equal(format.readUInt16LE(14),16);assert.ok(pcm.length>1000);assert.ok(pcm.some(b=>b!==0));
  assert.deepEqual(Buffer.from(CF_SOUNDS[entry.name],'base64'),data,'generated bundle sample must match source');
 }
});
