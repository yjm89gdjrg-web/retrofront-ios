import test from 'node:test';import assert from 'node:assert/strict';
import {availableCharacters,redeemCharacterCode,sanitizeProfile,BOT_CHARACTERS} from '../src/catalog.js';import {Game} from '../src/game.js';
test('fresh and legacy profiles hide Yun and cannot equip her before redemption',()=>{
 for(const raw of [null,{}, {character:'yun'}, {character:'yun',unlockedCharacters:'yun'},{unlockedCharacters:{yun:true}}]){const p=sanitizeProfile(raw);assert.deepEqual(availableCharacters(p),['omoh','fox','star']);assert.equal(p.character,'omoh');assert.deepEqual(p.unlockedCharacters,[]);assert.equal(new Game({...p,character:'yun'}).player.character,'omoh');}
});
test('empty and incorrect codes do not mutate unlocks or existing equipment',()=>{
 const p=sanitizeProfile({primary:'ak',character:'fox',activeBackpack:4}),before=JSON.stringify(p);
 for(const code of ['',null,'   ',184771]){assert.equal(redeemCharacterCode(p,code),'empty');assert.equal(JSON.stringify(p),before);}
 for(const code of ['184770','184771x','x184771','184 771','１８４７７１','<script>','000000']){assert.equal(redeemCharacterCode(p,code),'invalid');assert.equal(JSON.stringify(p),before);}
});
test('184771 unlocks once, persists across reloads, and keeps all five backpacks and current character',()=>{
 const p=sanitizeProfile({character:'fox',activeBackpack:3}),bags=JSON.stringify(p.backpacks);assert.equal(redeemCharacterCode(p,' 184771 '),'unlocked');assert.ok(availableCharacters(p).includes('yun'));assert.equal(p.character,'fox');assert.equal(JSON.stringify(p.backpacks),bags);assert.equal(p.activeBackpack,3);
 assert.equal(redeemCharacterCode(p,'184771'),'already');assert.deepEqual(p.unlockedCharacters,['yun']);p.character='yun';const restored=sanitizeProfile(JSON.parse(JSON.stringify(p)));assert.equal(restored.character,'yun');assert.deepEqual(restored.unlockedCharacters,['yun']);assert.equal(JSON.stringify(restored.backpacks),bags);assert.equal(new Game(restored).player.character,'yun');assert.ok(new Game(restored).bots.every(b=>b.character!=='yun'));assert.ok(!BOT_CHARACTERS.includes('yun'));
});
test('unlock sanitization discards unknown entries, deduplicates and does not share mutable state',()=>{
 const p=sanitizeProfile({unlockedCharacters:['yun','unknown','yun','omoh',null],character:'yun'});assert.deepEqual(p.unlockedCharacters,['yun']);assert.equal(p.character,'yun');const other=sanitizeProfile({});p.unlockedCharacters.length=0;assert.deepEqual(other.unlockedCharacters,[]);assert.equal(sanitizeProfile({character:'fox'}).character,'fox');
});
