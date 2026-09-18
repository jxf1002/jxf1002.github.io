import * as Game from './game.js';
import * as UI from './ui.js';

Game.setUI(UI);

// 移动端横屏偏好：尝试锁定方向（不请求全屏）；不支持的浏览器静默失败，靠 CSS 伪横屏旋转
function tryLandscape() {
  try {
    if (UI.getOrient() !== 'landscape') return
    if (!matchMedia('(pointer: coarse)').matches) return
    if (screen.orientation && screen.orientation.lock)
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

document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.blur();
    Game.setAILevel(btn.dataset.level);
    UI.renderAILevel();
  });
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

const orientBtn = document.getElementById('orient-btn');
orientBtn.addEventListener('click', e => { e.target.blur(); UI.cycleOrient(); });

const autoBtn = document.getElementById('auto-btn');
autoBtn.addEventListener('click', e => {
  e.target.blur();
  Game.setAuto(!Game.getAuto());
});

// 启动：有存档则大厅显示继续游戏，否则只显示新的游戏
Game.G.playing = false;
Game.loadAILevel();
UI.applyOrient();
if (Game.restore()) {
  UI.update();
} else {
  Game.G.players = [];
  UI.update();
}
