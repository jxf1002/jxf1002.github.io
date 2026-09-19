// AI 单测（快）：node test/ai.test.mjs
import * as Game from '../js/game.js';
import { HUMAN } from '../js/constants.js';

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

// 慢速整桌模拟已移至 test/ai-sim.mjs，手动跑：node test/ai-sim.mjs

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
