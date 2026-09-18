// AI 难度测试：node test/ai.test.mjs
import * as Game from '../js/game.js';

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

// ============ 三级无头模拟 ============
section('三级 AI 无头模拟（听牌速度 / 听牌人数 / 和牌率）');
const ROUNDS = Number(process.env.AI_ROUNDS || 60);
const levels = ['easy', 'normal', 'hard'];
const stat = {};

for (const lv of levels) {
  let win = 0, ting = 0, tingCounts = 0, firstTingSum = 0, firstTingN = 0;
  for (let i = 0; i < ROUNDS; i++) {
    let r = Game.simulateRound(lv);
    if (r.over && r.winner !== null && r.winner !== undefined) win++;
    if (r.firstTing !== null) { firstTingSum += r.firstTing; firstTingN++; }
    if (r.over) {
      // 统计进入听牌的人数（simulateRound 结束时 G.ting 可能被清空，用近似：有 firstTing 记 1）
      if (r.firstTing !== null) { ting++; tingCounts += 1; }
    }
  }
  stat[lv] = {
    winRate: win / ROUNDS,
    tingRate: ting / ROUNDS,
    avgFirstTing: firstTingN ? firstTingSum / firstTingN : Infinity
  };
  console.log(`  ${lv.padEnd(6)} 和牌率=${stat[lv].winRate.toFixed(3)} 听牌率=${stat[lv].tingRate.toFixed(3)} 平均首次听牌巡=${stat[lv].avgFirstTing === Infinity ? '∞' : stat[lv].avgFirstTing.toFixed(1)}`);
}

ok('困难比简单更早听牌', stat.hard.avgFirstTing < stat.easy.avgFirstTing,
  `hard=${stat.hard.avgFirstTing.toFixed(1)} easy=${stat.easy.avgFirstTing.toFixed(1)}`);
ok('困难听牌率不低于简单', stat.hard.tingRate >= stat.easy.tingRate - 0.05,
  `hard=${stat.hard.tingRate.toFixed(3)} easy=${stat.easy.tingRate.toFixed(3)}`);
ok('中等听牌率不低于简单', stat.normal.tingRate >= stat.easy.tingRate - 0.05,
  `normal=${stat.normal.tingRate.toFixed(3)} easy=${stat.easy.tingRate.toFixed(3)}`);
ok('困难和牌率不低于简单', stat.hard.winRate >= stat.easy.winRate - 0.05,
  `hard=${stat.hard.winRate.toFixed(3)} easy=${stat.easy.winRate.toFixed(3)}`);

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
