// 整桌模拟：1 focus 随机座 vs 3 base，打满指定圈数；慢，手动跑：node test/ai-sim.mjs
// 可调：AI_FOCUS（默认hard） AI_BASE（默认normal） AI_TABLES（默认10） AI_THREADS（默认10） AI_CIRCLES（默认4）
// 例：AI_FOCUS=normal AI_BASE=easy AI_TABLES=100 AI_THREADS=10 node test/ai-sim.mjs
import os from 'node:os';
import fs from 'node:fs';
import { Worker } from 'node:worker_threads';

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; }
  else { fail++; console.log('  ✗', name, extra === undefined ? '' : extra); }
}
function section(title) { console.log('\n== ' + title + ' =='); }

// 手写表格：console.table 不支持行着色；中文按双宽对齐，整行绿/红区分好坏
function dispLen(s) {
  let w = 0;
  for (const ch of String(s)) {
    const c = ch.codePointAt(0);
    w += ((c >= 0x4e00 && c <= 0x9fff) || (c >= 0x3000 && c <= 0x303f) || (c >= 0xff00 && c <= 0xffef)) ? 2 : 1;
  }
  return w;
}
function printTable(head, rows) {
  const widths = head.map((h, i) => Math.max(dispLen(h), ...rows.map(r => dispLen(r.cells[i]))));
  const line = cells => '| ' + cells.map((c, i) => String(c) + ' '.repeat(widths[i] - dispLen(c))).join(' | ') + ' |';
  console.log(line(head));
  console.log('|' + widths.map(w => '-'.repeat(w + 2)).join('|') + '|');
  for (const r of rows) {
    const s = line(r.cells);
    console.log(r.good === null ? s : (r.good ? '\x1b[32m' + s + '\x1b[0m' : '\x1b[31m' + s + '\x1b[0m'));
  }
}

// 桌数按线程数均分，每桌焦点座位随机、圈数相同
const TABLES = Math.max(1, Number(process.env.AI_TABLES || 10));
const THREADS = Math.max(1, Number(process.env.AI_THREADS || Math.min(os.cpus().length || 4, 10)));
const CIRCLES = Math.max(1, Number(process.env.AI_CIRCLES || 4));
const FOCUS = process.env.AI_FOCUS || 'hard';
const BASE = process.env.AI_BASE || 'normal';
const LEVEL_CN = { hard: '困难', normal: '中等', easy: '简单' };
if (!LEVEL_CN[FOCUS] || !LEVEL_CN[BASE]) {
  console.error(`非法 matchup：AI_FOCUS=${FOCUS} AI_BASE=${BASE}（仅支持 hard/normal/easy）`);
  process.exit(1);
}
const FOCUS_CN = LEVEL_CN[FOCUS], BASE_CN = LEVEL_CN[BASE];

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

const jobs = [];
{
  const base = Math.floor(TABLES / THREADS);
  const rem = TABLES % THREADS;
  for (let t = 0; t < THREADS; t++) {
    const n = base + (t < rem ? 1 : 0);
    if (n > 0) jobs.push({ tables: n, circles: CIRCLES, focus: FOCUS, base: BASE });
  }
}

console.log(`\n== 整桌模拟：共 ${TABLES} 桌 / ${jobs.length} 线程 / ${CIRCLES} 圈（${FOCUS_CN}随机座 vs 3 ${BASE_CN}）==`);
const simT0 = Date.now();
const results = await runPool(jobs, THREADS);
console.log(`  模拟耗时 ${((Date.now() - simT0) / 1000).toFixed(1)}s`);

const rows = results.flatMap(r => r.tables);
// 汇总用总量比（各桌把数不同，不能桌均值再平均）；排名按桌直接平均
let n = 0, rankSum = 0, winSum = 0, handSum = 0, scoreSum = 0;
let dealHardSum = 0, dealNormSum = 0, tingHardSum = 0, tingHardN = 0, tingNormSum = 0, tingNormN = 0;
let rankG = 0, winG = 0, scoreG = 0, dealG = 0, tingG = 0, tingSkip = 0;
for (const r of rows) {
  n++;
  const h = r.hard;
  rankSum += r.rank;
  winSum += r.wins; handSum += r.hands; scoreSum += r.score;
  if (r.rank < 2.5) rankG++;
  if (r.wins / r.hands > 0.25) winG++;
  if (r.score / r.hands > 0) scoreG++;
  const dealH = r.dealIn[h] / r.hands;
  const dealN = r.dealIn.reduce((s, v, i) => s + (i === h ? 0 : v), 0) / (3 * r.hands);
  dealHardSum += r.dealIn[h]; dealNormSum += r.dealIn.reduce((s, v, i) => s + (i === h ? 0 : v), 0);
  if (dealH < dealN) dealG++;
  const thN = r.tingN[h];
  const tnN = r.tingN.reduce((s, v, i) => s + (i === h ? 0 : v), 0);
  if (thN > 0 && tnN > 0) {
    const thAvg = r.tingSum[h] / thN;
    const tnAvg = r.tingSum.reduce((s, v, i) => s + (i === h ? 0 : v), 0) / tnN;
    tingHardSum += r.tingSum[h]; tingHardN += thN;
    tingNormSum += r.tingSum.reduce((s, v, i) => s + (i === h ? 0 : v), 0); tingNormN += tnN;
    if (thAvg < tnAvg) tingG++;
  } else {
    tingSkip++;
  }
}

const avgRank = rankSum / n;
const winRate = winSum / handSum;
const avgScore = scoreSum / handSum;
const avgDealH = dealHardSum / handSum;
const avgDealN = dealNormSum / (3 * handSum);
const avgTingH = tingHardN ? tingHardSum / tingHardN : Infinity;
const avgTingN = tingNormN ? tingNormSum / tingNormN : Infinity;
const tingCounted = n - tingSkip;

section(`汇总（${n} 桌，平均 ${(handSum / n).toFixed(1)} 把/桌）`);
printTable(['指标', FOCUS_CN, BASE_CN], [
  { cells: ['平均排名（越小越好）', avgRank.toFixed(3), '2.5'], good: avgRank < 2.5 },
  { cells: ['和牌胜率（含流局）', winRate.toFixed(3), '0.25'], good: winRate > 0.25 },
  { cells: ['每局均分', avgScore.toFixed(3), '0'], good: avgScore > 0 },
  { cells: ['点黑炮率（越低越好）', avgDealH.toFixed(3), avgDealN.toFixed(3)], good: avgDealH < avgDealN },
  { cells: ['上听轮数（越小越早）', avgTingH === Infinity ? '∞' : avgTingH.toFixed(1), avgTingN === Infinity ? '∞' : avgTingN.toFixed(1)], good: avgTingH < avgTingN },
  { cells: ['平均把数/桌（仅观察）', (handSum / n).toFixed(1), '—'], good: null }
]);

section('分桌计数（试水线：好桌超过计入桌数 50%）');
printTable(['指标', '好桌', '结论'], [
  { cells: ['排名好桌（<2.5）', `${rankG}/${n}`, rankG > n * 0.5 ? '✓' : '✗'], good: rankG > n * 0.5 },
  { cells: ['胜率好桌（>0.25）', `${winG}/${n}`, winG > n * 0.5 ? '✓' : '✗'], good: winG > n * 0.5 },
  { cells: ['均分好桌（>0）', `${scoreG}/${n}`, scoreG > n * 0.5 ? '✓' : '✗'], good: scoreG > n * 0.5 },
  { cells: ['黑炮好桌（低于同桌均值）', `${dealG}/${n}`, dealG > n * 0.5 ? '✓' : '✗'], good: dealG > n * 0.5 },
  { cells: ['上听好桌（早于同桌均值）', `${tingG}/${tingCounted}${tingSkip ? `（${tingSkip}桌无数据）` : ''}`, tingG > tingCounted * 0.5 ? '✓' : '✗'], good: tingG > tingCounted * 0.5 }
]);
ok('排名好桌超 50%', rankG > n * 0.5, `${rankG}/${n}`);
ok('胜率好桌超 50%', winG > n * 0.5, `${winG}/${n}`);
ok('均分好桌超 50%', scoreG > n * 0.5, `${scoreG}/${n}`);
ok('黑炮好桌超 50%', dealG > n * 0.5, `${dealG}/${n}`);
ok('上听好桌超 50%', tingG > tingCounted * 0.5, `${tingG}/${tingCounted}`);

// 趋势记录：每次跑完追加一行（过没过都记）
{
  const csv = new URL('./ai-sim-log.csv', import.meta.url);
  const fmt = (v, d) => (v === Infinity || v === undefined || Number.isNaN(v)) ? '' : Number(v).toFixed(d);
  const now = new Date();
  const pad = x => String(x).padStart(2, '0');
  const time = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const row = [time, n, THREADS, CIRCLES, fmt(avgRank, 3), fmt(winRate, 3), fmt(avgScore, 3),
    fmt(avgDealH, 3), fmt(avgDealN, 3), fmt(avgTingH, 1), fmt(avgTingN, 1), fmt(handSum / n, 1),
    rankG, winG, scoreG, dealG, tingG, tingCounted, pass, fail, ''].join(',');
  if (!fs.existsSync(csv)) fs.writeFileSync(csv, 'time(时间),tables(桌数),threads(线程数),circles(圈数),avgRank(平均排名),winRate(和牌胜率),avgScore(每局均分),avgDealHard(困难黑炮率),avgDealNorm(同桌黑炮率),avgTingHard(困难上听轮数),avgTingNorm(同桌上听轮数),avgHands(平均把数),rankG(排名好桌),winG(胜率好桌),scoreG(均分好桌),dealG(黑炮好桌),tingG(上听好桌),tingCounted(上听计入桌),pass(通过),fail(失败),note(备注)\n');
  fs.appendFileSync(csv, row + '\n');
  console.log('  已记入 test/ai-sim-log.csv');
}

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
