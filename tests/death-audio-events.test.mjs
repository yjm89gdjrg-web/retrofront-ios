import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {sanitizeProfile} from '../src/catalog.js';
import {fireOrigin} from './map-fixtures.mjs';

test('a fatal hit emits one positional death event with the equipped player character',()=>{
 const game=new Game({character:'star'});game.phase='live';game.events=[];
 Object.assign(game.player,fireOrigin);
 game.damage(game.player,40,game.aliveEnemies[0]);assert.equal(game.events.some(e=>e.type==='kill'),false);
 game.damage(game.player,100,game.aliveEnemies[0]);game.damage(game.player,100,game.aliveEnemies[0]);
 const deaths=game.events.filter(e=>e.type==='kill');assert.equal(deaths.length,1);assert.equal(deaths[0].character,'star');assert.deepEqual(deaths[0].position,[fireOrigin.x,fireOrigin.y+1.25,fireOrigin.z]);
 game.player.x+=5;assert.deepEqual(deaths[0].position,[fireOrigin.x,fireOrigin.y+1.25,fireOrigin.z],'sound position must remain at the original death location');
});

test('the last enemy death retains character metadata before round completion',()=>{
 const game=new Game({side:'attack'});game.phase='live';const fox=game.aliveEnemies.find(a=>a.character==='fox');
 for(const actor of game.aliveEnemies)if(actor!==fox)actor.dead=true;game.events=[];
 game.damage(fox,100,game.player);
 assert.equal(game.events[0].type,'kill');assert.equal(game.events[0].character,'fox');assert.equal(game.events[1].type,'roundEnd');
});

test('a bot shot identifies its displayed weapon and source position for spatial audio',()=>{
 const game=new Game({side:'defend'});game.phase='live';Object.assign(game.player,fireOrigin);
 const ally=game.aliveAllies[0],enemy=game.aliveEnemies[0];Object.assign(ally,{x:fireOrigin.x,y:fireOrigin.y,z:fireOrigin.z-2,yaw:0,cooldown:0});Object.assign(enemy,{x:fireOrigin.x,y:fireOrigin.y,z:fireOrigin.z-5,cooldown:99});game.bots=[ally,enemy];game.events=[];game.random=()=>0;
 game.updateBots(.02);assert.equal(game.events.some(e=>e.type==='botShot'),false,'reaction time must elapse before shooting');for(let n=0;n<20;n++)game.updateBots(.02);
 const shot=game.events.find(e=>e.type==='botShot');assert.equal(shot.weapon,'m4');assert.equal(shot.character,ally.character);assert.deepEqual(shot.origin,[fireOrigin.x,fireOrigin.y+1.35,fireOrigin.z-2]);
});

test('music preference migrates old saves and remains separate from the master sound switch',()=>{
 assert.equal(sanitizeProfile({sound:false}).music,true);assert.equal(sanitizeProfile({sound:true,music:false}).music,false);assert.equal(sanitizeProfile({music:'false'}).music,true);
});
