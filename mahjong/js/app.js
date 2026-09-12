import * as Game from './game.js';
import * as UI from './ui.js';

Game.setUI(UI);

const startBtn = document.getElementById('btn-s');
startBtn.addEventListener('click', () => {
  startBtn.blur();
  if (Game.G.playing) Game.endGame();
  else Game.init();
});

// 页面被 Live Server 等自动刷新后，尝试恢复未结束的牌局
Game.restore();
