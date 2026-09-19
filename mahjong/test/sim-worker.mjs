// 无头模拟工作线程：跑若干桌（每桌困难随机座+3 normal，打满指定圈数），返回单桌行
// 由 test/ai-sim.mjs 通过 worker_threads 调用，无文件写入
import { parentPort, workerData } from 'node:worker_threads';
import * as Game from '../js/game.js';

const noop = () => {};
Game.setUI({ update: noop, addLog: noop, showModal: noop, effect: noop, showWinBanner: noop, showSummary: noop, hideWinBanner: noop });

const { tables, circles } = workerData;
const rows = [];
for (let t = 0; t < tables; t++) {
  const hard = Math.floor(Math.random() * 4);
  const levels = ['normal', 'normal', 'normal', 'normal'];
  levels[hard] = 'hard';
  rows.push(Game.simulateTable(levels, circles));
}
parentPort.postMessage({ tables: rows });
