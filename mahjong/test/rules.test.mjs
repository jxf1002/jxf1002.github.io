// 麻将规则测试：node test/rules.test.mjs
import * as Tile from '../js/tile.js';
import * as Score from '../js/score.js';
import * as Game from '../js/game.js';
import { HUMAN } from '../js/constants.js';

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; }
  else { fail++; console.log('  ✗', name); }
}
function section(title) { console.log('\n== ' + title + ' =='); }

const T = (type, num) => ({ type, num, suit: { wan: '万', tiao: '条', tong: '筒' }[type], id: num + type });
const Z = { type: 'zhong', num: 0, suit: '红中', id: '红中' };

function newGame() {
  Game.setUI({ update() {}, addLog() {}, showModal() {}, effect() {}, showSummary() {} });
  Game.init();
  const G = Game.G;
  G.players.forEach(p => { p.hand = []; p.melds = []; p.score = 0; });
  return G;
}

// ============ 胡牌牌型 ============
section('胡牌牌型');
ok('标准胡牌（顺子+刻子+幺九）',
  Tile.canWin([T('wan',1),T('wan',2),T('wan',3),T('wan',4),T('wan',5),T('wan',6),T('tiao',5),T('tiao',5),T('tiao',5),T('tong',7),T('tong',8),T('tong',9),T('tong',9),T('tong',9)], []));
ok('无刻子不胡',
  !Tile.canWin([T('wan',1),T('wan',2),T('wan',3),T('wan',4),T('wan',5),T('wan',6),T('wan',7),T('wan',8),T('wan',9),T('tiao',1),T('tiao',2),T('tiao',3),T('tong',9),T('tong',9)], []));
ok('红中对子免刻子',
  Tile.canWin([T('wan',1),T('wan',2),T('wan',3),T('wan',4),T('wan',5),T('wan',6),T('wan',7),T('wan',8),T('wan',9),T('tiao',1),T('tiao',2),T('tiao',3),Z,Z], []));
ok('无幺九不胡',
  !Tile.canWin([T('wan',2),T('wan',3),T('wan',4),T('wan',4),T('wan',5),T('wan',6),T('tiao',5),T('tiao',5),T('tiao',5),T('tong',3),T('tong',4),T('tong',5),T('tong',7),T('tong',7)], []));
ok('无碰牌可胡对倒',
  Tile.canWin([T('wan',1),T('wan',2),T('wan',3),T('wan',4),T('wan',5),T('wan',6),T('tong',7),T('tong',8),T('tong',9),T('tiao',5),T('tiao',5),T('tiao',5),T('tiao',6),T('tiao',6)], []));
ok('无顺子可胡顺子牌',
  Tile.canWin([T('wan',1),T('wan',2),T('wan',3),T('tiao',5),T('tiao',5),T('tiao',5),T('tong',7),T('tong',7),T('tong',7),T('tong',9),T('tong',9),T('tong',9),T('wan',9),T('wan',9)], []));
ok('无对子可胡单吊',
  Tile.canWin([T('wan',1),T('wan',2),T('wan',3),T('wan',4),T('wan',5),T('wan',6),T('tiao',7),T('tiao',8),T('tiao',9),T('tong',5),T('tong',5),T('tong',5),T('tong',9),T('tong',9)], []));
ok('无碰牌有对子可单吊红中',
  Tile.canWin([T('wan',1),T('wan',2),T('wan',3),T('wan',4),T('wan',5),T('wan',6),T('tiao',7),T('tiao',8),T('tiao',9),T('tong',1),T('tong',2),T('tong',3),Z,Z], []));

// ============ 计分 ============
section('计分（分数 = 2^番数）');
let f = Score.calcFan({ isDealer: true, isZimo: true, isBaopi: false, heipao: false });
let r = Score.calcScore({ fan: f, isZimo: true, discarderIsTing: false, discarder: -1, winner: 0, dealer: 0 });
ok('庄家自摸 番2 / 每家-4 / 赢家+12', f === 2 && r.deltas[0] === 12 && r.deltas[1] === -4);
f = Score.calcFan({ isDealer: false, isZimo: true, isBaopi: false, heipao: false });
r = Score.calcScore({ fan: f, isZimo: true, discarderIsTing: false, discarder: -1, winner: 1, dealer: 0 });
ok('非庄自摸 庄家付双倍(-4)/其他-2/赢家+8', r.deltas[0] === -4 && r.deltas[2] === -2 && r.deltas[1] === 8);
f = Score.calcFan({ isDealer: false, isZimo: true, isBaopi: true, heipao: false });
r = Score.calcScore({ fan: f, isZimo: true, discarderIsTing: false, discarder: -1, winner: 1, dealer: 0 });
ok('非庄摸宝自摸 番2 / 庄家-8 / 其他-4 / 赢家+16', f === 2 && r.deltas[0] === -8 && r.deltas[1] === 16);
f = Score.calcFan({ isDealer: true, isZimo: false, isBaopi: false, heipao: true });
r = Score.calcScore({ fan: f, isZimo: false, discarderIsTing: false, discarder: 2, winner: 0, dealer: 0 });
ok('黑炮给庄家 番3 / 放炮者-8 / 赢家+8', f === 3 && r.deltas[2] === -8 && r.deltas[0] === 8);
f = Score.calcFan({ isDealer: false, isZimo: false, isBaopi: false, heipao: true });
r = Score.calcScore({ fan: f, isZimo: false, discarderIsTing: false, discarder: 0, winner: 1, dealer: 0 });
ok('黑炮放炮者是庄 番2 / 庄家-8', f === 2 && r.deltas[0] === -8);
f = Score.calcFan({ isDealer: false, isZimo: false, isBaopi: false, heipao: false });
r = Score.calcScore({ fan: f, isZimo: false, discarderIsTing: true, discarder: 2, winner: 1, dealer: 0 });
ok('听牌点炮给非庄 庄家-2 / 其他-1 / 赢家+4', r.deltas[0] === -2 && r.deltas[2] === -1 && r.deltas[1] === 4);

// ============ 听牌限制 ============
section('听牌限制');
let G = newGame();
G.players[HUMAN].hand = [T('wan',1),T('wan',2),T('wan',3),T('wan',4),T('wan',5),T('wan',6),T('tiao',5),T('tiao',5),T('tiao',5),T('tong',5),T('tong',6),T('tong',9),T('tong',9)];
ok('门前清（0副露）不能听牌', !Game.canDeclareNow(HUMAN));
G.players[HUMAN].melds = [
  { type: 'peng', ts: [T('wan',1),T('wan',1),T('wan',1)] },
  { type: 'peng', ts: [T('wan',2),T('wan',2),T('wan',2)] },
  { type: 'peng', ts: [T('wan',3),T('wan',3),T('wan',3)] },
  { type: 'peng', ts: [T('wan',4),T('wan',4),T('wan',4)] }
];
G.players[HUMAN].hand = [T('wan',9),T('wan',9)];
ok('手把一（4副露）不能听牌', !Game.canDeclareNow(HUMAN) && Game.tingDiscards(HUMAN).length === 0);

G = newGame();
G.players[HUMAN].melds = [{ type: 'peng', ts: [T('wan',1),T('wan',1),T('wan',1)] }];
G.players[HUMAN].hand = [T('wan',2),T('wan',3),T('wan',4),T('wan',5),T('wan',6),T('wan',7),T('tiao',5),T('tiao',5),T('tiao',5),T('tong',8),T('tong',9)];
const td = Game.tingDiscards(HUMAN).map(t => t.id);
ok('唯一幺九（9筒）不可打出听牌', !td.includes('9tong') && td.length > 0);

// ============ 上听吃 / 吃幺九 ============
section('上听吃（吃三家）');
G = newGame();
// 人类 13 张：7万8万 + 1-3筒 + 4-6筒 + 7-8-9条 + 9条9条（无副露）
G.players[HUMAN].hand = [T('wan',7),T('wan',8),T('tong',1),T('tong',2),T('tong',3),T('tong',4),T('tong',5),T('tong',6),T('tiao',7),T('tiao',8),T('tiao',9),T('tiao',9),T('tiao',9)];
G.lastD = T('wan',9); G.lastDB = 2; // 对家（非上家）
G.phase = 'claim'; G.pending = [HUMAN]; G.over = false; G.curP = 2; G.ting = new Set();
let acts = Game.claimActions(HUMAN);
ok('非上家打出可吃听（上听吃）', acts.some(a => a.a === 'chi'));
if (acts.some(a => a.a === 'chi')) {
  const chi = acts.find(a => a.a === 'chi');
  Game.handleAB(HUMAN, 'chi', chi.d);
  ok('上听吃后强制听牌', G.ting.has(HUMAN));
}

section('手中无幺九，吃幺九可听牌');
G = newGame();
// 人类 13 张：2万3万 + 4-6筒 + 2-4条 + 5条5条5条 + 7筒7筒（手牌无幺九）
G.players[HUMAN].hand = [T('wan',2),T('wan',3),T('tong',4),T('tong',5),T('tong',6),T('tiao',2),T('tiao',3),T('tiao',4),T('tiao',5),T('tiao',5),T('tiao',5),T('tong',7),T('tong',7)];
ok('构造的手牌确实无幺九', !G.players[HUMAN].hand.some(t => t.num === 1 || t.num === 9 || t.type === 'zhong'));
G.lastD = T('wan',1); G.lastDB = 2; // 对家打出幺九 1万
G.phase = 'claim'; G.pending = [HUMAN]; G.over = false; G.curP = 2; G.ting = new Set();
acts = Game.claimActions(HUMAN);
ok('手中无幺九，吃幺九(1万)可听牌', acts.some(a => a.a === 'chi'));
if (acts.some(a => a.a === 'chi')) {
  const chi = acts.find(a => a.a === 'chi');
  Game.handleAB(HUMAN, 'chi', chi.d);
  ok('吃幺九后强制听牌', G.ting.has(HUMAN));
  ok('副露包含幺九 1万', G.players[HUMAN].melds.some(m => m.ts.some(t => t.id === '1wan')));
}

section('手中无幺九，恰巧吃到幺九可听牌');
G = newGame();
// 人类 13 张：2万3万 + 3筒 + 5-6-7筒 + 6筒 + 2-3-4条 + 8条8条8条（手牌无幺九，且本身不成听）
G.players[HUMAN].hand = [
  T('wan',2),T('wan',3),
  T('tong',3),T('tong',5),T('tong',6),T('tong',6),T('tong',7),
  T('tiao',2),T('tiao',3),T('tiao',4),T('tiao',8),T('tiao',8),T('tiao',8)
];
ok('构造的手牌确实无幺九', !G.players[HUMAN].hand.some(Tile.isYao));
ok('无幺九且无副露时不听牌', !Tile.isTing(G.players[HUMAN].hand, G.players[HUMAN].melds));
G.lastD = T('wan',1); G.lastDB = 2; // 对家打出幺九 1万
G.phase = 'claim'; G.pending = [HUMAN]; G.over = false; G.curP = 2; G.ting = new Set();
acts = Game.claimActions(HUMAN);
const chiYao = acts.find(a => a.a === 'chi');
ok('恰巧吃到幺九(1万)可听牌', !!chiYao && chiYao.ting === true);
if (chiYao) {
  Game.handleAB(HUMAN, 'chi', chiYao.d);
  ok('吃幺九后强制听牌', G.ting.has(HUMAN));
  ok('听牌后手牌仍无幺九', !G.players[HUMAN].hand.some(Tile.isYao));
  ok('幺九仅来自副露（1万）', G.players[HUMAN].melds.some(m => m.ts.some(t => t.id === '1wan')));
  ok('听牌张正确（6筒）', Tile.winTiles(G.players[HUMAN].hand, G.players[HUMAN].melds).some(t => t.id === '6tong'));
}

// ============ 每人统计 ============
section('每人统计（自摸/点炮/黑炮/宝牌）');
G = newGame();
G.dealer = 0;
G.players.forEach((p, i) => { p.isD = (i === 0); });
// 南(1) 听牌；东(庄)打出红中后南摸到 6筒自摸
G.players[0].hand = [Z,T('wan',1),T('wan',2),T('wan',3),T('wan',4),T('wan',5),T('wan',6),T('wan',7),T('wan',8),T('wan',9),T('tiao',1),T('tiao',2),T('tiao',3),T('tiao',4)];
G.players[1].hand = [T('wan',1),T('wan',2),T('wan',3),T('wan',4),T('wan',5),T('wan',6),T('tiao',5),T('tiao',5),T('tiao',5),T('tong',7),T('tong',8),T('tong',9),T('tong',9)];
G.players[2].hand = [T('tong',1),T('tong',2),T('tong',3),T('tong',4),T('tong',5),T('tong',6),T('tong',7),T('tong',8),T('tong',9),T('tiao',7),T('tiao',8),T('tiao',9),T('tiao',6)];
G.players[3].hand = [T('wan',7),T('wan',8),T('wan',9),T('tiao',1),T('tiao',3),T('tiao',5),T('tiao',7),T('tong',2),T('tong',4),T('tong',6),T('tong',8),T('wan',2),T('wan',4)];
G.ting = new Set([1]);
G.deck[G.deck.length - 1] = T('tong',6);
G.curP = 0; G.phase = 'discard'; G.lock = false; G.over = false;
Game.handleDiscard(G.players[0].hand.findIndex(t => t.id === '红中'));
ok('南自摸 记入南 zimo=1', G.stats.per[1].zimo === 1);
ok('其他玩家无胡牌记录', G.stats.per[0].zimo === 0 && G.stats.per[0].ron === 0 && G.stats.per[2].zimo === 0);


console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
