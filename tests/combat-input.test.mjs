import test from 'node:test';
import assert from 'node:assert/strict';
import { bindCombatActions } from '../src/combat-input.js';
import { Game } from '../src/game.js';
import {blocked} from '../src/map.js';
import {fireOrigin} from './map-fixtures.mjs';
function setup() {
  const game = new Game(); game.phase = 'live'; game.updateBots = () => {};
  Object.assign(game.player,{...fireOrigin,yaw:0,pitch:0});assert.equal(blocked(game.player.x,game.player.z),false);
  const buttons = { aim: new EventTarget(), reload: new EventTarget(), switch: new EventTarget() };
  bindCombatActions(buttons, () => game);
  return { game, buttons };
}
function send(target, type, fields = {}) {
  const event = new Event(type, { cancelable: true });
  for (const [key, value] of Object.entries(fields)) Object.defineProperty(event, key, { value });
  target.dispatchEvent(event);
  return event;
}
const secondFinger = { pointerType: 'touch', pointerId: 2, isPrimary: false, button: 0 };

test('accepted aim actions notify the HUD synchronously without compatibility-click duplicates',()=>{
 const game=new Game(),buttons={aim:new EventTarget(),reload:new EventTarget(),switch:new EventTarget()},seen=[];
 bindCombatActions(buttons,()=>game,()=>{},g=>seen.push(g.aim));
 send(buttons.aim,'pointerdown',secondFinger);assert.deepEqual(seen,[true]);send(buttons.aim,'click',{detail:1});assert.deepEqual(seen,[true]);
 game.player.dead=true;send(buttons.aim,'pointerdown',secondFinger);assert.deepEqual(seen,[true]);
});
test('second finger opens/closes scope while joystick movement continues without click', () => {
  const { game, buttons } = setup(), movement = { x: 0, z: -1 };
  game.update(.05, movement); const before = game.player.z;
  const press = send(buttons.aim, 'pointerdown', secondFinger);
  assert.equal(game.aim, true); assert.equal(press.defaultPrevented, true);
  game.update(.05, movement); assert.ok(game.player.z < before);
  send(buttons.aim, 'pointerup', secondFinger); assert.equal(game.aim, true);
  send(buttons.aim, 'pointerdown', secondFinger); assert.equal(game.aim, false);
  const after = game.player.z; game.update(.05, movement); assert.ok(game.player.z < after);
});
test('synthesized pointer click does not close the scope again', () => {
  const { game, buttons } = setup();
  send(buttons.aim, 'pointerdown', secondFinger);
  send(buttons.aim, 'pointerup', secondFinger);
  send(buttons.aim, 'click', { detail: 1 }); assert.equal(game.aim, true);
});
test('moving, aiming and firing can be active together', () => {
  const { game, buttons } = setup(); send(buttons.aim, 'pointerdown', secondFinger);
  const before = game.player.z;
  game.update(.05, { z: -1, fire: true, trigger: true });
  assert.equal(game.aim, true); assert.ok(game.player.z < before); assert.equal(game.ammo[0].clip, 29);
});
test('secondary finger reloads and switches while movement is held', () => {
  const { game, buttons } = setup(); game.ammo[0].clip = 15;
  send(buttons.reload, 'pointerdown', secondFinger); assert.ok(game.reloading > 0);
  const before = game.player.z; game.update(.05, { z: -1 }); assert.ok(game.player.z < before);
  send(buttons.switch, 'pointerdown', secondFinger); assert.equal(game.slot, 1);
  send(buttons.switch, 'click', { detail: 1 }); assert.equal(game.slot, 1);
});
test('mouse and keyboard activation remain available', () => {
  const { game, buttons } = setup();
  send(buttons.aim, 'pointerdown', { pointerType: 'mouse', button: 2 }); assert.equal(game.aim, false);
  send(buttons.aim, 'pointerdown', { pointerType: 'mouse', button: 0 });
  send(buttons.aim, 'click', { detail: 1 }); assert.equal(game.aim, true);
  send(buttons.aim, 'click', { detail: 0 }); assert.equal(game.aim, false);
});
test('paused, eliminated and completed games reject combat buttons', () => {
  for (const state of ['paused', 'dead', 'finished']) {
    const { game, buttons } = setup();
    if (state === 'paused') game.paused = true;
    if (state === 'dead') game.player.dead = true;
    if (state === 'finished') game.phase = 'finished';
    send(buttons.aim, 'pointerdown', secondFinger);
    send(buttons.switch, 'pointerdown', secondFinger);
    assert.equal(game.aim, false); assert.equal(game.slot, 0);
  }
});
