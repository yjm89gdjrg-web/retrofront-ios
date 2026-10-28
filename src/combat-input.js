// Accept secondary fingers while the joystick owns the first touch.
export function toggleAim(game){
  if(!game||game.paused||game.player.dead||!['ready','live'].includes(game.phase)||game.weapon?.slot==='melee'||(game.weapon?.scoped&&game.reloading>0))return false;
  game.aim=!game.aim;return true;
}
export function bindPress(element, action) {
  const down = event => {
    if (element.disabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    action();
  };
  const click = event => {
    // Keyboard/accessibility clicks have no preceding physical pointerdown.
    // Ignore compatibility clicks so a pointer tap never toggles twice.
    if (!element.disabled && event.detail === 0) action();
  };
  element.addEventListener('pointerdown', down, { passive: false });
  element.addEventListener('click', click);
  return () => {
    element.removeEventListener('pointerdown', down);
    element.removeEventListener('click', click);
  };
}
export function bindCombatActions(elements, getGame, unlockAudio = () => {}, onAction = () => {}) {
  const run = action => () => {
    const game = getGame();
    if (!game || game.paused || game.player.dead || !['ready', 'live'].includes(game.phase)) return;
    unlockAudio();
    if(action(game)!==false)onAction(game);
  };
  const remove = [
    bindPress(elements.aim, run(game => toggleAim(game))),
    bindPress(elements.reload, run(game => game.reload())),
    bindPress(elements.switch, run(game => game.switchWeapon(game.slot + 1)))
  ];
  return () => remove.forEach(dispose => dispose());
}
