// AI 难度测试：node test/ai.test.mjs
import * as Game from '../js/game.js';
import { HUMAN } from '../js/constants.js';
import os from 'node:os';
import { Worker } from 'node:worker_threads';

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; }
  else { fail++; console.log('  ✗', name, extra === undefined ? '' : extra); }
}
function section(title) { console.log('\n== ' + title + ' =='); }

// 内存版 localStorage，供存档相关用例使用
globalThis.localStorage = {
  _s: {},
  getItem(k) { return Object.prototype.hasOwnProperty.call(this._s, k) ? this._s[k] : null; },
  setItem(k, v) { this._s[k] = String(v); },
  removeItem(k) { delete this._s[k]; }
};

// UI 全部 no-op，避免碰 DOM
Game.setUI({ update() {}, addLog() {}, showModal() {}, effect() {}, showWinBanner() {}, showSummary() {}, hideWinBanner() {} });

// ============ 难度读写 ============
section('难度读写与校验');
ok('默认 normal', Game.getAILevel() === 'normal', Game.getAILevel());
ok('非法值被拒绝', Game.setAILevel('impossible') === false);
ok('合法值精确匹配', Game.setAILevel('hard') === true && Game.getAILevel() === 'hard');
ok('easy/normal 均可设置', Game.setAILevel('easy') && Game.setAILevel('normal'));
Game.setAILevel('hard');

// ============ 存档兼容 ============
section('存档兼容（旧档默认 normal）');
localStorage.setItem('mahjong_save_v2', JSON.stringify({ players: [{}, {}, {}, {}], ting: [], stats: {} }));
ok('旧存档恢复成功', Game.restore() === true);
ok('旧存档缺失 aiLevel 时默认 normal', Game.getAILevel() === 'normal', Game.getAILevel());

Game.setAILevel('hard');
Game.saveState();
Game.setAILevel('easy');
ok('存档恢复后难度为 hard', Game.restore() === true && Game.getAILevel() === 'hard', Game.getAILevel());

// ============ 托管 ============
section('托管');
Game.setAILevel('normal');
Game.setAuto(true);
ok('托管时东家用困难 AI', Game.getAILevel(HUMAN) === 'hard', Game.getAILevel(HUMAN));
ok('托管不影响其他座位', Game.getAILevel(1) === 'normal', Game.getAILevel(1));
Game.setAuto(false);
ok('关闭托管后东家恢复', Game.getAILevel(HUMAN) === 'normal', Game.getAILevel(HUMAN));

// ============ 听牌弃牌标注 ============
section('听牌弃牌标注');
{
  const T = (type, num) => ({ type, num, suit: { wan: '万', tiao: '条', tong: '筒' }[type], id: num + type });
  Game.init();
  const G = Game.G;
  G.players.forEach(p => { p.hand = []; p.melds = []; p.disc = []; });
  G.players[HUMAN].melds = [{ type: 'peng', ts: [T('tiao', 5), T('tiao', 5), T('tiao', 5)] }];
  G.players[HUMAN].hand = [T('wan', 2), T('wan', 3), T('wan', 4), T('wan', 5), T('wan', 6), T('wan', 7), T('tiao', 8), T('tiao', 8), T('tong', 8), T('tong', 8), T('tong', 9)];
  G.phase = 'discard'; G.curP = HUMAN; G.over = false; G.lock = false; G.playing = true;
  G.tingIntent = true; G.forceTing = false; G.discard = []; G.ting = new Set(); G.deck = [];
  let idx = G.players[HUMAN].hand.findIndex(t => t.id === '8tong');
  Game.handleDiscard(idx);
  ok('听牌弃牌被打上 tingDiscard 标记', G.players[HUMAN].disc.some(t => t.tingDiscard));
  ok('该弃牌同时进入听牌', G.ting.has(HUMAN));
}

// ============ 三级无头模拟（worker_threads 多核并行）============
const ROUNDS = Number(process.env.AI_ROUNDS || 60);
const levels = ['easy', 'normal', 'hard'];

function runJob(job) {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('./sim-worker.mjs', import.meta.url), { workerData: job });
    w.once('message', resolve);
    w.once('error', reject);
    w.once('exit', code => { if (code !== 0) reject(new Error('worker exited ' + code)); });
  });
}

async function runPool(jobs, size) {
  const results = new Array(jobs.length);
  let next = 0;
  async function run() {
    while (next < jobs.length) {
      const i = next++;
      results[i] = await runJob(jobs[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(size, jobs.length)) }, run));
  return results;
}

const cpu = os.cpus().length || 4;
// 每个 难度×模式 再切块，尽量铺满核心（hard 最重，排最前先跑）
const chunks = Math.max(1, Math.min(4, Math.round((cpu * 2) / 6)));
const per = Math.max(1, Math.round(ROUNDS / chunks));
const jobs = [];
for (const lv of ['hard', 'normal', 'easy']) {
  for (let c = 0; c * per < ROUNDS; c++) {
    const rounds = Math.min(per, ROUNDS - c * per);
    jobs.push({ mode: 'aggregate', level: lv, rounds });
    jobs.push({ mode: 'vs', level: lv, rounds });
  }
}

console.log(`\n== 模拟任务：${jobs.length} 个，${cpu} 核并行，每档 ${ROUNDS} 局 ==`);
const simT0 = Date.now();
const results = await runPool(jobs, cpu);
console.log(`  模拟耗时 ${((Date.now() - simT0) / 1000).toFixed(1)}s`);

const agg = {}, vss = {};
for (const r of results) {
  const t = r.mode === 'aggregate' ? agg : vss;
  const a = t[r.level] || (t[r.level] = { n: 0, win: 0, ting: 0, firstSum: 0, firstN: 0, seatWin: 0, baseWin: 0, score: 0, dealIn: 0 });
  a.n += r.n;
  a.win += r.win || 0;
  a.ting += r.ting || 0;
  a.firstSum += r.firstSum || 0;
  a.firstN += r.firstN || 0;
  a.seatWin += r.seatWin || 0;
  a.baseWin += r.baseWin || 0;
  a.score += r.score || 0;
  a.dealIn += r.dealIn || 0;
}

const stat = {}, vs = {};
for (const lv of levels) {
  const a = agg[lv];
  stat[lv] = { winRate: a.win / a.n, tingRate: a.ting / a.n, avgFirstTing: a.firstN ? a.firstSum / a.firstN : Infinity };
  const v = vss[lv];
  vs[lv] = { seatWinRate: v.seatWin / v.n, baseWinRate: v.baseWin / (v.n * 3), avgScore: v.score / v.n, dealIn: v.dealIn / v.n };
}

section('三级 AI 无头模拟（听牌速度 / 听牌率 / 和牌率）');
for (const lv of levels) {
  const s = stat[lv];
  console.log(`  ${lv.padEnd(6)} 和牌率=${s.winRate.toFixed(3)} 听牌率=${s.tingRate.toFixed(3)} 平均首次听牌巡=${s.avgFirstTing === Infinity ? '∞' : s.avgFirstTing.toFixed(1)}`);
}
ok('困难比简单更早听牌', stat.hard.avgFirstTing < stat.easy.avgFirstTing,
  `hard=${stat.hard.avgFirstTing.toFixed(1)} easy=${stat.easy.avgFirstTing.toFixed(1)}`);
ok('困难听牌率不低于简单', stat.hard.tingRate >= stat.easy.tingRate - 0.05,
  `hard=${stat.hard.tingRate.toFixed(3)} easy=${stat.easy.tingRate.toFixed(3)}`);
ok('中等听牌率不低于简单', stat.normal.tingRate >= stat.easy.tingRate - 0.05,
  `normal=${stat.normal.tingRate.toFixed(3)} easy=${stat.easy.tingRate.toFixed(3)}`);
ok('困难和牌率不低于简单', stat.hard.winRate >= stat.easy.winRate - 0.05,
  `hard=${stat.hard.winRate.toFixed(3)} easy=${stat.easy.winRate.toFixed(3)}`);

// ============ 模块对战：座0=候选难度，座1-3=基准 normal ============
section('模块对战（座0 候选 vs 座1-3 基准 normal，随机庄家）');
for (const lv of levels) {
  const v = vs[lv];
  console.log(`  ${lv.padEnd(6)} 座0胜率=${v.seatWinRate.toFixed(3)} 基准座位均胜率=${v.baseWinRate.toFixed(3)} 座0均分=${v.avgScore.toFixed(2)} 座0点炮/局=${v.dealIn.toFixed(2)}`);
}
ok('困难对基准胜率高于简单对基准', vs.hard.seatWinRate > vs.easy.seatWinRate,
  `hard=${vs.hard.seatWinRate.toFixed(3)} easy=${vs.easy.seatWinRate.toFixed(3)}`);
ok('困难座0均分不低于简单', vs.hard.avgScore >= vs.easy.avgScore,
  `hard=${vs.hard.avgScore.toFixed(2)} easy=${vs.easy.avgScore.toFixed(2)}`);
console.log(`  [观察] 困难 vs 中等：胜率差=${(vs.hard.seatWinRate - vs.normal.seatWinRate).toFixed(3)} 均分差=${(vs.hard.avgScore - vs.normal.avgScore).toFixed(2)}`);

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
