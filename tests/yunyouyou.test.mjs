import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
import {Box3,Vector3} from 'three';import {Game} from '../src/game.js';import {CHARACTERS,BOT_CHARACTERS,sanitizeProfile,WEAPONS} from '../src/catalog.js';
import {CF_MODELS} from '../src/generated/cf-models.js';import {CF_SOUNDS} from '../src/generated/cf-sounds.js';import {operatorMesh,weaponMesh} from '../src/render.js';import {animateCF,playCF,disposeCF} from '../src/cf-models.js';
test('Yun is selectable and saved, but excluded from both bot teams in every round',()=>{
 assert.equal(CHARACTERS.yun.playerOnly,true);assert.deepEqual([...BOT_CHARACTERS],['omoh','fox','star']);
 const saved=sanitizeProfile(JSON.parse(JSON.stringify(sanitizeProfile({character:'yun',unlockedCharacters:['yun'],activeBackpack:4}))));assert.equal(saved.character,'yun');assert.equal(saved.backpacks.length,5);assert.equal(saved.activeBackpack,4);
 for(const side of ['attack','defend']){const game=new Game({...saved,side});for(let n=0;n<4;n++){assert.equal(game.player.character,'yun');assert.equal(game.bots.length,9);assert.ok(game.bots.every(bot=>BOT_CHARACTERS.includes(bot.character)&&bot.character!=='yun'));game.beginRound();}}
});
test('Yun rewards carry the player voice through all five kills and death preserves character metadata',()=>{
 const game=new Game({character:'yun',unlockedCharacters:['yun']});game.phase='live';game.events=[];for(const [i,bot]of [...game.aliveEnemies].entries()){game.elapsed=i;game.damage(bot,100,game.player);}const rewards=game.events.filter(e=>e.reward).map(e=>e.reward);assert.deepEqual(rewards.map(r=>r.voice),['kill_1','kill_2','kill_3','kill_4','kill_5']);assert.ok(rewards.every(r=>r.character==='yun'&&r.gender==='female'));
 game.beginRound();game.phase='live';game.events=[];game.damage(game.player,100,game.aliveEnemies[0]);assert.equal(game.events.find(e=>e.type==='kill').character,'yun');
});
test('recorded SKC/BNC model and seven voices match sources and the offline bundle',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../assets-source/cf/yunyouyou/manifest.json',import.meta.url)));assert.equal(manifest.model.bones,30);assert.equal(manifest.entries.length,7);
 for(const entry of [...manifest.modelFiles,...manifest.entries]){const b=fs.readFileSync(new URL('../'+entry.file,import.meta.url));assert.equal(b.length,entry.bytes);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),entry.sha256);if(entry.event)assert.deepEqual(Buffer.from(CF_SOUNDS[`yun_${entry.event}.mp3`],'base64'),b);}
 const model=CF_MODELS['yun-gr'];assert.equal(model.bones.length,30);assert.equal(model.meshes.reduce((n,m)=>n+m.vertices/3,0),11748);assert.deepEqual(model.textures.map(t=>[t.w,t.h]),[[256,256],[512,512],[256,256]]);assert.ok(!model.textures.some(t=>t.name.includes('vtf')));
 for(const mesh of model.meshes){const w=new Float32Array(Uint8Array.from(Buffer.from(mesh.skinWeights,'base64')).buffer),indices=Buffer.from(mesh.skinIndices,'base64');assert.equal(w.length,mesh.vertices*4);assert.ok([...indices].every(i=>i<30));for(let i=0;i<w.length;i+=4)assert.ok(Math.abs(w[i]+w[i+1]+w[i+2]+w[i+3]-1)<.001);}
});
function bounds(model){const b=new Box3(),p=new Vector3();model.traverse(m=>{if(m.isSkinnedMesh)for(let i=0;i<m.geometry.attributes.position.count;i++)b.expandByPoint(m.getVertexPosition(i,p).applyMatrix4(m.matrixWorld));});return b;}
test('Yun has finite standing/running geometry and a grounded frozen corpse that resets',()=>{
 const actor=operatorMesh('yun',false,'m4');for(const action of ['idle','run','ref_shoot_rifle']){playCF(actor,action,{restart:true});animateCF(actor,.2);const b=bounds(actor);assert.ok(b.min.toArray().every(Number.isFinite)&&b.max.toArray().every(Number.isFinite));assert.ok(b.max.y>1.6&&b.max.y<2.1);assert.ok(b.getSize(new Vector3()).length()<3.5);}
 playCF(actor,'death',{once:true,hold:true,restart:true});animateCF(actor,10);const b=bounds(actor);assert.ok(Math.abs(b.min.y)<.015,'feet/body touch the floor');assert.ok(b.max.y<.85,'corpse lies down');const pose=actor.userData.cf.bones.map(b=>[...b.position,...b.quaternion]);animateCF(actor,10);assert.deepEqual(actor.userData.cf.bones.map(b=>[...b.position,...b.quaternion]),pose);playCF(actor,'idle',{restart:true});animateCF(actor,0);assert.ok(bounds(actor).max.y>1.6);disposeCF(actor);
});
test('Yun equips all first-person weapons without missing arm profiles or invalid skinning',()=>{
 for(const id of Object.keys(WEAPONS)){const gun=weaponMesh(id,true,'yun','attack');for(const action of ['idle','shoot','draw']){playCF(gun,action,{restart:true});animateCF(gun,.1);gun.traverse(m=>{if(m.isSkinnedMesh){const p=m.getVertexPosition(Math.floor(m.geometry.attributes.position.count/2),new Vector3());assert.ok(p.toArray().every(Number.isFinite),id);assert.ok(p.length()<150,id);}});}disposeCF(gun);}
});

