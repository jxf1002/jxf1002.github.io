// 无头模拟工作线程：跑若干桌（每桌 1 focus 随机座 + 3 base，打满指定圈数），返回单桌行
// 由 test/ai-sim.mjs 通过 worker_threads 调用，无文件写入
// matchup 由 workerData 的 focus/base 决定（默认 hard vs 3 normal）
import { parentPort, workerData } from 'node:worker_threads';
import * as Game from '../js/game.js';

const noop = () => {};
Game.setUI({ update: noop, addLog: noop, showModal: noop, effect: noop, showWinBanner: noop, showSummary: noop, hideWinBanner: noop });

const { tables, circles, focus = 'hard', base = 'normal' } = workerData;
const rows = [];
for (let t = 0; t < tables; t++) {
  const seat = Math.floor(Math.random() * 4);
  const levels = [base, base, base, base];
  levels[seat] = focus;
  rows.push(Game.simulateTable(levels, circles));
}
parentPort.postMessage({ tables: rows });
