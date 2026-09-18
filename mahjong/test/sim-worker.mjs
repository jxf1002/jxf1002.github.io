// 无头模拟工作线程：按 job 跑若干局，返回原始计数（由主线程合并）
// 由 test/ai.test.mjs 通过 worker_threads 调用，无文件写入
import { parentPort, workerData } from 'node:worker_threads';
import * as Game from '../js/game.js';

const noop = () => {};
Game.setUI({ update: noop, addLog: noop, showModal: noop, effect: noop, showWinBanner: noop, showSummary: noop, hideWinBanner: noop });

const { mode, level, rounds } = workerData;

if (mode === 'mixed') {
  // 一个线程跑 rounds 局，按轮次轮流覆盖各难度；同一局同时做“同级四家”与“座0对基准”两种统计
  const levels = workerData.levels || ['easy', 'normal', 'hard'];
  const per = {};
  levels.forEach(lv => { per[lv] = { agg: { n: 0, win: 0, ting: 0, firstSum: 0, firstN: 0 }, vs: { n: 0, seatWin: 0, baseWin: 0, score: 0, dealIn: 0 } }; });
  for (let i = 0; i < rounds; i++) {
    const lv = levels[i % levels.length];
    const a = per[lv].agg;
    const r = Game.simulateRound(lv);
    a.n++;
    if (r.winner !== null && r.winner !== undefined) a.win++;
    if (r.firstTing !== null) { a.ting++; a.firstSum += r.firstTing; a.firstN++; }
    const v = per[lv].vs;
    const r2 = Game.simulateRound([lv, 'normal', 'normal', 'normal']);
    v.n++;
    v.score += Game.G.players[0].score;
    const pp = Game.G.stats.per;
    v.dealIn += pp[0].dianpao + pp[0].dianhei;
    if (r2.winner !== null && r2.winner !== undefined) { if (r2.winner === 0) v.seatWin++; else v.baseWin++; }
  }
  parentPort.postMessage({ mode, n: rounds, per });
} else if (mode === 'aggregate') {
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
