// 无头模拟工作线程：按 job 跑若干局，返回原始计数（由主线程合并）
// 由 test/ai.test.mjs 通过 worker_threads 调用，无文件写入
import { parentPort, workerData } from 'node:worker_threads';
import * as Game from '../js/game.js';

const noop = () => {};
Game.setUI({ update: noop, addLog: noop, showModal: noop, effect: noop, showWinBanner: noop, showSummary: noop, hideWinBanner: noop });

const { mode, level, rounds } = workerData;

if (mode === 'aggregate') {
  let win = 0, ting = 0, firstSum = 0, firstN = 0;
  for (let i = 0; i < rounds; i++) {
    const r = Game.simulateRound(level);
    if (r.winner !== null && r.winner !== undefined) win++;
    if (r.firstTing !== null) { ting++; firstSum += r.firstTing; firstN++; }
  }
  parentPort.postMessage({ mode, level, n: rounds, win, ting, firstSum, firstN });
} else {
  let seatWin = 0, baseWin = 0, score = 0, dealIn = 0;
  for (let i = 0; i < rounds; i++) {
    const r = Game.simulateRound([level, 'normal', 'normal', 'normal']);
    const per = Game.G.stats.per;
    score += Game.G.players[0].score;
    dealIn += per[0].dianpao + per[0].dianhei;
    if (r.winner !== null && r.winner !== undefined) {
      if (r.winner === 0) seatWin++; else baseWin++;
    }
  }
  parentPort.postMessage({ mode, level, n: rounds, seatWin, baseWin, score, dealIn });
}
