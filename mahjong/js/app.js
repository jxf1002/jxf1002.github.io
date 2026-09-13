import * as Game from './game.js';
import * as UI from './ui.js';

Game.setUI(UI);

const startBtn = document.getElementById('btn-s');
startBtn.addEventListener('click', () => {
  startBtn.blur();
  if (Game.G.playing) Game.endGame();
  else Game.init();
});

const logBtn = document.getElementById('log-btn');
const logModal = document.getElementById('log-modal');
const logClose = document.getElementById('log-close');
logBtn.addEventListener('click', () => { logModal.classList.add('show'); });
logClose.addEventListener('click', () => { logModal.classList.remove('show'); logClose.blur(); });
logModal.addEventListener('click', e => { if (e.target === logModal) logModal.classList.remove('show'); });

// 页面被 Live Server 等自动刷新后，尝试恢复未结束的牌局
Game.restore();
