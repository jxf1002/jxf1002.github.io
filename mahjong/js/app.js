import * as Game from './game.js';
import * as UI from './ui.js';

Game.setUI(UI);

// 移动端开局尝试锁定横屏（iOS 不支持则静默失败，靠竖屏遮罩提示）
function tryLandscape() {
  try {
    if (matchMedia('(pointer: coarse)').matches && screen.orientation && screen.orientation.lock)
      screen.orientation.lock('landscape').catch(() => {})
  } catch (e) {}
}

document.getElementById('btn-new').addEventListener('click', e => {
  e.target.blur();
  tryLandscape();
  Game.init();
});

document.getElementById('btn-continue').addEventListener('click', e => {
  e.target.blur();
  tryLandscape();
  Game.resumeGame();
});

document.getElementById('btn-stats').addEventListener('click', e => {
  e.target.blur();
  Game.showStats();
});

const backBtn = document.getElementById('btn-s');
backBtn.addEventListener('click', () => {
  backBtn.blur();
  Game.toLobby();
});

const logBtn = document.getElementById('log-btn');
const logModal = document.getElementById('log-modal');
const logClose = document.getElementById('log-close');
logBtn.addEventListener('click', () => { logModal.classList.add('show'); });
logClose.addEventListener('click', () => { logModal.classList.remove('show'); logClose.blur(); });
logModal.addEventListener('click', e => { if (e.target === logModal) logModal.classList.remove('show'); });

const rulesBtn = document.getElementById('rules-btn');
const rulesModal = document.getElementById('rules-modal');
const rulesClose = document.getElementById('rules-close');
rulesBtn.addEventListener('click', () => { rulesModal.classList.add('show'); });
rulesClose.addEventListener('click', () => { rulesModal.classList.remove('show'); rulesClose.blur(); });
rulesModal.addEventListener('click', e => { if (e.target === rulesModal) rulesModal.classList.remove('show'); });

// 启动：有存档则大厅显示继续游戏，否则只显示新的游戏
Game.G.playing = false;
if (Game.restore()) {
  UI.update();
} else {
  Game.G.players = [];
  UI.update();
}
