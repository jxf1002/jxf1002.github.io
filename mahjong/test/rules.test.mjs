// 麻将规则测试：node test/rules.test.mjs
import * as Tile from '../js/tile.js';
import * as Score from '../js/score.js';
import * as Game from '../js/game.js';
import * as UI from '../js/ui.js';
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
G.players[HUMAN].melds = [{ type: 'peng', ts: [T('tiao',5),T('tiao',5),T('tiao',5)] }];
G.players[HUMAN].hand = [T('wan',2),T('wan',3),T('wan',4),T('wan',5),T('wan',6),T('wan',7),T('tiao',8),T('tiao',8),T('tong',8),T('tong',8),T('tong',9)];
ok('打出 9筒后断幺九，不可听牌；打 8筒听 7筒',
  !Game.tingDiscards(HUMAN).some(t => t.id === '9tong') &&
  Game.tingDiscards(HUMAN).some(t => t.id === '8tong'));
G.players[HUMAN].melds = [{ type: 'peng', ts: [T('wan',1),T('wan',1),T('wan',1)] }];
ok('副露有幺九时手牌幺九（9筒）可打出听牌',
  Game.tingDiscards(HUMAN).some(t => t.id === '9tong') &&
  Game.isTingDiscard(G.players[HUMAN].hand, G.players[HUMAN].melds, T('tong',9)));

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
  ok('上听吃后设forceTing标记（未自动出牌）', G.forceTing === true && !G.ting.has(HUMAN));
  ok('上听吃后玩家只能打听牌张', Game.tingDiscards(HUMAN).length > 0);
  // 玩家选择打第一张听牌张
  let td = Game.tingDiscards(HUMAN);
  let discardTile = td[0];
  let discardIdx = G.players[HUMAN].hand.findIndex(t => Tile.tid(t) === Tile.tid(discardTile));
  Game.handleDiscard(discardIdx);
  ok('打出听牌张后进入听牌', G.ting.has(HUMAN));
  ok('forceTing标记已清除', G.forceTing === false);
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
  ok('吃幺九后设forceTing标记（未自动出牌）', G.forceTing === true && !G.ting.has(HUMAN));
  ok('副露包含幺九 1万', G.players[HUMAN].melds.some(m => m.ts.some(t => t.id === '1wan')));
  // 玩家选择打第一张听牌张
  let td = Game.tingDiscards(HUMAN);
  let discardTile = td[0];
  let discardIdx = G.players[HUMAN].hand.findIndex(t => Tile.tid(t) === Tile.tid(discardTile));
  Game.handleDiscard(discardIdx);
  ok('打出听牌张后进入听牌', G.ting.has(HUMAN));
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
  ok('吃幺九后设forceTing标记（未自动出牌）', G.forceTing === true && !G.ting.has(HUMAN));
  ok('forceTing后手牌仍无幺九', !G.players[HUMAN].hand.some(Tile.isYao));
  ok('幺九仅来自副露（1万）', G.players[HUMAN].melds.some(m => m.ts.some(t => t.id === '1wan')));
  // 玩家选择打第一张听牌张
  let td = Game.tingDiscards(HUMAN);
  ok('听牌张正确（6筒）', td.some(t => t.id === '6tong'));
  let discardTile = td[0];
  let discardIdx = G.players[HUMAN].hand.findIndex(t => Tile.tid(t) === Tile.tid(discardTile));
  Game.handleDiscard(discardIdx);
  ok('打出听牌张后进入听牌', G.ting.has(HUMAN));
}

// ============ 断幺九不能听牌 ============
section('断幺九不能听牌（幺九须在手，胡到幺九不算）');
G = newGame();
// 手牌无幺九，仅胡 1万 才能凑成顺子 1-2-3万
G.players[HUMAN].hand = [
  T('wan',2),T('wan',3),
  T('tong',4),T('tong',5),T('tong',6),
  T('tiao',2),T('tiao',3),T('tiao',4),
  T('tiao',5),T('tiao',5),T('tiao',5),
  T('tong',7),T('tong',7)
];
ok('断幺九手牌确实无幺九', !G.players[HUMAN].hand.some(Tile.isYao));
ok('断幺九不能听牌', !Tile.isTing(G.players[HUMAN].hand, []));
ok('胡到幺九(1万)不算，无听牌张', Tile.winTiles(G.players[HUMAN].hand, []).length === 0);

// 同型手牌只要手里已有幺九即可听牌
G = newGame();
G.players[HUMAN].hand = [
  T('wan',1),T('wan',2),T('wan',3),
  T('tong',4),T('tong',5),T('tong',6),
  T('tiao',2),T('tiao',3),T('tiao',4),
  T('tiao',5),T('tiao',5),T('tiao',5),
  T('tong',7)
];
ok('手中有幺九时可以听牌', Tile.isTing(G.players[HUMAN].hand, []));
ok('听牌张为 7筒', Tile.winTiles(G.players[HUMAN].hand, []).some(t => t.id === '7tong'));

// 副露非幺九 + 断幺九手牌：不能宣告听牌
G = newGame();
G.players[HUMAN].melds = [{ type: 'peng', ts: [T('tong',2),T('tong',2),T('tong',2)] }];
G.players[HUMAN].hand = [
  T('wan',2),T('wan',3),
  T('tiao',2),T('tiao',3),T('tiao',4),
  T('tiao',5),T('tiao',5),T('tiao',5),
  T('tong',7),T('tong',7)
];
ok('副露非幺九 + 断幺九手牌不能听牌', !Game.canDeclareNow(HUMAN) && Game.tingDiscards(HUMAN).length === 0);

// 同型手牌，副露为幺九刻子：幺九可来自副露，可以听牌
G = newGame();
G.players[HUMAN].melds = [{ type: 'peng', ts: [T('tong',1),T('tong',1),T('tong',1)] }];
G.players[HUMAN].hand = [
  T('wan',2),T('wan',3),
  T('tiao',2),T('tiao',3),T('tiao',4),
  T('tiao',5),T('tiao',5),T('tiao',5),
  T('tong',7),T('tong',7)
];
ok('幺九来自副露时可以听牌', Game.canDeclareNow(HUMAN));

// ============ 吃/碰都能听牌时给予选择 ============
section('吃牌与碰牌都能听牌时给予玩家选择');
// 3万：手中 3万3万 可碰，4万5万 可吃，两种打法打完都能听牌
function choiceGame(lastDB) {
  G = newGame();
  G.players[HUMAN].hand = [
    T('wan',3),T('wan',3),T('wan',4),T('wan',5),
    T('tong',1),T('tong',2),T('tong',3),
    T('tong',5),T('tong',5),T('tong',5),
    T('tiao',7),T('tiao',7),T('tiao',9)
  ];
  G.lastD = T('wan',3); G.lastDB = lastDB;
  G.phase = 'claim'; G.pending = [HUMAN]; G.over = false; G.curP = lastDB; G.ting = new Set();
  return G;
}

// 对家打出 3万：吃、碰都可听，两个选项都要给出
choiceGame(2);
let ca = Game.claimActions(HUMAN);
let cChi = ca.find(a => a.a === 'chi');
let cPeng = ca.find(a => a.a === 'peng');
ok('同时给出吃与碰两个选择', !!cChi && !!cPeng);
ok('吃牌选项标注可听牌', !!cChi && cChi.ting === true && cChi.l.includes('·听'));
ok('碰牌选项标注可听牌', !!cPeng && cPeng.ting === true && cPeng.l.includes('·听'));

// 选择吃：上听吃，设forceTing标记让用户选择出牌
choiceGame(2);
Game.handleAB(HUMAN, 'chi', Game.claimActions(HUMAN).find(a => a.a === 'chi').d);
ok('选择吃后设forceTing标记（未自动出牌）', G.forceTing === true && !G.ting.has(HUMAN));
// 玩家选择打第一张听牌张
let td2 = Game.tingDiscards(HUMAN);
let discardTile2 = td2[0];
let discardIdx2 = G.players[HUMAN].hand.findIndex(t => Tile.tid(t) === Tile.tid(discardTile2));
Game.handleDiscard(discardIdx2);
ok('打出听牌张后进入听牌', G.ting.has(HUMAN));

// 选择碰：不强制听牌，保留玩家是否听牌的选择权
choiceGame(2);
Game.handleAB(HUMAN, 'peng');
ok('选择碰后不强制听牌', !G.ting.has(HUMAN));
ok('碰后仍可主动听牌（打 9条）',
  Game.canStartTing(HUMAN) && Game.tingDiscards(HUMAN).some(t => t.id === '9tiao'));
Game.handleAB(HUMAN, 'ting');
Game.handleDiscard(G.players[HUMAN].hand.findIndex(t => t.id === '9tiao'));
ok('碰后主动听牌成功', G.ting.has(HUMAN));

// 上家打出 3万：普通吃与「碰·听」同样都给出
choiceGame(3);
ca = Game.claimActions(HUMAN);
ok('上家打出时吃、碰都可选',
  ca.some(a => a.a === 'chi') && ca.some(a => a.a === 'peng' && a.ting === true));

// ============ 吃上家可选择听牌，吃另外两家必须上听 ============
section('吃上家可选择听牌，吃另外两家必须上听');
function upperChiGame(lastDB) {
  G = newGame();
  G.players[HUMAN].hand = [
    T('wan',7),T('wan',8),
    T('tong',1),T('tong',2),T('tong',3),
    T('tong',4),T('tong',5),T('tong',6),
    T('tiao',7),T('tiao',8),T('tiao',9),T('tiao',9),T('tiao',9)
  ];
  G.lastD = T('wan',9); G.lastDB = lastDB;
  G.phase = 'claim'; G.pending = [HUMAN]; G.over = false; G.curP = lastDB; G.ting = new Set();
  return G;
}

// 上家打出 9万：普通吃，吃后是否听牌由玩家决定
upperChiGame(3);
let uActs = Game.claimActions(HUMAN);
let uChi = uActs.find(a => a.a === 'chi');
ok('吃上家能听时标为上听（优先于碰杠，但仍不强制）', !!uChi && uChi.ting === true && uChi.l.includes('·听'));
Game.handleAB(HUMAN, 'chi', uChi.d);
ok('吃上家后不强制听牌', !G.ting.has(HUMAN));
ok('吃上家后可主动听牌（打 7条）',
  Game.canStartTing(HUMAN) && Game.tingDiscards(HUMAN).some(t => t.id === '7tiao'));
Game.handleAB(HUMAN, 'ting');
Game.handleDiscard(G.players[HUMAN].hand.findIndex(t => t.id === '7tiao'));
ok('吃上家后主动听牌成功', G.ting.has(HUMAN));

// 吃上家后也可以选择不听：直接打出听牌张也不自动上听
upperChiGame(3);
Game.handleAB(HUMAN, 'chi', Game.claimActions(HUMAN).find(a => a.a === 'chi').d);
Game.handleDiscard(G.players[HUMAN].hand.findIndex(t => t.id === '7tiao'));
ok('吃上家后选择不听牌则保持未听', !G.ting.has(HUMAN));

// 吃另外两家（上听吃）：必须听牌，但由用户选择打出哪张
upperChiGame(2);
let nActs = Game.claimActions(HUMAN);
let nChi = nActs.find(a => a.a === 'chi');
ok('吃另外两家标注强制听牌', !!nChi && nChi.ting === true && nChi.l.includes('·听'));
Game.handleAB(HUMAN, 'chi', nChi.d);
ok('吃另外两家后设forceTing标记（未自动出牌）', G.forceTing === true && !G.ting.has(HUMAN));
// 玩家选择打第一张听牌张
let td3 = Game.tingDiscards(HUMAN);
let discardTile3 = td3[0];
let discardIdx3 = G.players[HUMAN].hand.findIndex(t => Tile.tid(t) === Tile.tid(discardTile3));
Game.handleDiscard(discardIdx3);
ok('打出听牌张后进入听牌', G.ting.has(HUMAN));

// ============ 上家打出幺九：吃上听应优先于下家碰 ============
section('上家打出幺九：吃上听优先于下家碰');
G = newGame();
// 断幺九手牌：5条5条5条 + 2-4条 + 2-4万 + 7万7万 + 7筒8筒
G.players[HUMAN].hand = [
  T('tiao',5),T('tiao',5),T('tiao',5),
  T('tiao',2),T('tiao',3),T('tiao',4),
  T('wan',2),T('wan',3),T('wan',4),
  T('wan',7),T('wan',7),
  T('tong',7),T('tong',8)
];
ok('构造的断幺九手牌确实无幺九', !G.players[HUMAN].hand.some(Tile.isYao));
// 下家(1)手中有两张九筒可碰
G.players[1].hand = [T('tong',9),T('tong',9),T('wan',1),T('wan',2),T('wan',3),T('tiao',1),T('tiao',2),T('tiao',3),T('tong',2),T('tong',3),T('tong',4),T('wan',6),T('wan',6)];
G.lastD = T('tong',9); G.lastDB = 3; // 上家打出九筒（人类的下家是 1）
G.phase = 'claim'; G.pending = []; G.over = false; G.curP = 3; G.ting = new Set();
let upChiActs = Game.claimActions(HUMAN);
let upChiTing = upChiActs.find(a => a.a === 'chi');
ok('人类可吃九筒上听（吃 7-8-9筒）', !!upChiTing && upChiTing.ting === true);
let downPengActs = Game.claimActions(1);
ok('下家可碰九筒', downPengActs.some(a => a.a === 'peng'));
let chosenChi = Game.pickClaim([{ i: HUMAN, acts: upChiActs }, { i: 1, acts: downPengActs }], 3);
ok('吃上听优先于下家碰', !!chosenChi && chosenChi.i === HUMAN);
// 若人类选择不听，下家仍可碰
G.pending = [HUMAN];
Game.handleAB(HUMAN, 'pass');
ok('人类放弃后不再等待人类响应', !G.pending.includes(HUMAN));

// ============ 上听吃后用户选择权 ============
section('上听吃后用户选择权（forceTing行为）');
// 构造上听吃场景：手牌有多种听牌方式
G = newGame();
// 手牌：7万8万 + 1-3筒 + 4-6筒 + 7-8-9条 + 9条9条（与upperChiGame相同）
// 吃9万后：1-3筒 + 4-6筒 + 7-8-9条 + 9条9条（11张）
// 听牌张：打9条后听1筒/4筒/7筒
G.players[HUMAN].hand = [
  T('wan',7),T('wan',8),
  T('tong',1),T('tong',2),T('tong',3),
  T('tong',4),T('tong',5),T('tong',6),
  T('tiao',7),T('tiao',8),T('tiao',9),T('tiao',9),T('tiao',9)
];
G.lastD = T('wan',9); G.lastDB = 1; // 下家打出9万（非上家）
G.phase = 'claim'; G.pending = [HUMAN]; G.over = false; G.curP = 1; G.ting = new Set();
acts = Game.claimActions(HUMAN);
let chiAct = acts.find(a => a.a === 'chi');
ok('上听吃场景构造正确', !!chiAct && chiAct.ting === true);

// 执行上听吃
Game.handleAB(HUMAN, 'chi', chiAct.d);
ok('上听吃后forceTing为true', G.forceTing === true);
ok('上听吃后未自动出牌（hand仍为11张）', G.players[HUMAN].hand.length === 11);
ok('上听吃后未听牌', !G.ting.has(HUMAN));

// 计算听牌张
let validDiscards = Game.tingDiscards(HUMAN);
ok('有听牌张可打', validDiscards.length > 0);

// 尝试打非听牌张（应无效）
let nonTingIdx = G.players[HUMAN].hand.findIndex(t => {
  return !validDiscards.some(v => Tile.tid(v) === Tile.tid(t));
});
if (nonTingIdx >= 0) {
  let beforeLen = G.players[HUMAN].hand.length;
  Game.handleDiscard(nonTingIdx);
  ok('打非听牌张无效（手牌数不变）', G.players[HUMAN].hand.length === beforeLen);
  ok('打非听牌张后仍为forceTing', G.forceTing === true);
}

// 打正确的听牌张
let tingIdx = G.players[HUMAN].hand.findIndex(t => Tile.tid(t) === Tile.tid(validDiscards[0]));
Game.handleDiscard(tingIdx);
ok('打正确听牌张后听牌', G.ting.has(HUMAN));
ok('forceTing标记已清除', G.forceTing === false);

// ============ 禁止清一色 ============
section('禁止清一色（万/条/筒至少两种，红中不算颜色）');
// 清一色（全万）完整牌型
let qing = [
  T('wan',1),T('wan',2),T('wan',3),
  T('wan',4),T('wan',5),T('wan',6),
  T('wan',7),T('wan',8),T('wan',9),
  T('wan',2),T('wan',2),T('wan',2),
  T('wan',5),T('wan',5)
];
ok('清一色不能胡', !Tile.canWin(qing, []));

// 同型换成两种颜色即可胡
let duo = [
  T('wan',1),T('wan',2),T('wan',3),
  T('wan',4),T('wan',5),T('wan',6),
  T('tong',7),T('tong',8),T('tong',9),
  T('wan',2),T('wan',2),T('wan',2),
  T('wan',5),T('wan',5)
];
ok('两种颜色可以胡', Tile.canWin(duo, []));

// 红中不算一种颜色：一色 + 红中对子仍不能胡
let qingZhong = [
  T('wan',1),T('wan',2),T('wan',3),
  T('wan',4),T('wan',5),T('wan',6),
  T('wan',7),T('wan',8),T('wan',9),
  T('wan',2),T('wan',2),T('wan',2),
  Z,Z
];
ok('清一色加红中不算两种颜色，不能胡', !Tile.canWin(qingZhong, []));

// 清一色不能听牌
let qingTing = [
  T('wan',1),T('wan',2),T('wan',3),
  T('wan',4),T('wan',5),T('wan',6),
  T('wan',7),T('wan',8),T('wan',9),
  T('wan',2),T('wan',2),T('wan',2),
  T('wan',5)
];
ok('清一色不能听牌', !Tile.isTing(qingTing, []) && Tile.winTiles(qingTing, []).length === 0);

// 两种颜色可听牌
let duoTing = [
  T('wan',1),T('wan',2),T('wan',3),
  T('wan',4),T('wan',5),T('wan',6),
  T('tong',7),T('tong',8),T('tong',9),
  T('wan',2),T('wan',2),T('wan',2),
  T('wan',5)
];
ok('两种颜色可以听牌',
  Tile.isTing(duoTing, []) && Tile.winTiles(duoTing, []).some(t => t.id === '5wan'));

// ============ 鸣牌优先级 ============
section('鸣牌优先级（上听 > 杠碰 > 吃，同级按牌序）');
const P = Game.claimPriority;
ok('胡优先级最高', P({ a: 'hu' }) > P({ a: 'peng', ting: true }));
ok('上听（吃听/碰听）高于普通杠碰',
  P({ a: 'chi', ting: true }) > P({ a: 'peng' }) &&
  P({ a: 'chi', ting: true }) > P({ a: 'kong' }) &&
  P({ a: 'peng', ting: true }) > P({ a: 'peng' }));
ok('普通杠碰高于吃', P({ a: 'peng' }) > P({ a: 'chi' }) && P({ a: 'kong' }) > P({ a: 'chi' }));
ok('吃听与碰听同级', P({ a: 'chi', ting: true }) === P({ a: 'peng', ting: true }));

// pickClaim：lastDB=0 时下家顺序为 1 → 2 → 3
ok('都不上听：碰高于吃（吃家更近也不行）', Game.pickClaim([
  { i: 1, acts: [{ a: 'chi' }] },
  { i: 2, acts: [{ a: 'peng' }] }
], 0).i === 2);
ok('上听高于不上听（上听家更远也优先）', Game.pickClaim([
  { i: 1, acts: [{ a: 'peng' }] },
  { i: 3, acts: [{ a: 'chi', ting: true }] }
], 0).i === 3);
ok('都上听：按牌序取近者', Game.pickClaim([
  { i: 2, acts: [{ a: 'peng', ting: true }] },
  { i: 1, acts: [{ a: 'chi', ting: true }] }
], 0).i === 1);
ok('均吃：按牌序取近者', Game.pickClaim([
  { i: 3, acts: [{ a: 'chi' }] },
  { i: 1, acts: [{ a: 'chi' }] }
], 0).i === 1);
ok('均吃：牌序跨圈仍取近者', Game.pickClaim([
  { i: 3, acts: [{ a: 'chi' }] },
  { i: 0, acts: [{ a: 'chi' }] }
], 2).i === 3);
ok('胡高于上听', Game.pickClaim([
  { i: 3, acts: [{ a: 'hu' }] },
  { i: 1, acts: [{ a: 'peng', ting: true }] }
], 0).i === 3);
ok('同一玩家多选项按最高优先级比较', Game.pickClaim([
  { i: 2, acts: [{ a: 'chi' }, { a: 'peng' }] },
  { i: 1, acts: [{ a: 'chi', ting: true }] }
], 0).i === 1);
ok('无鸣牌返回 null', Game.pickClaim([], 0) === null);

// ============ 上听检测复核（本地规则 vs 标准向听） ============
section('上听检测复核（无刻子无对子时不误报“还差一张”）');
G = newGame();
// 1 副露 + 10 张：无刻子、无对子，标准向听=1，但本地规则缺刻子又缺对子，远未上听
G.players[HUMAN].melds = [{ type: 'chi', ts: [T('tong',1),T('tong',2),T('tong',3)] }];
G.players[HUMAN].hand = [T('wan',2),T('wan',3),T('wan',4),T('wan',5),T('wan',6),T('wan',7),T('tiao',1),T('tiao',2),T('tong',8),T('wan',9)];
let hh = Game.handHints(HUMAN);
ok('标准向听为 1（旧提示误报“还差1张”的来源）',
  Tile.shanten(G.players[HUMAN].hand, G.players[HUMAN].melds) === 1);
ok('本地规则下打不出听牌张', Game.tingDiscards(HUMAN).length === 0);
ok('hint 不再误报：plans/draws/wins 均为空',
  hh.plans.length === 0 && hh.draws.length === 0 && hh.wins.length === 0);
ok('hint 标签指出无碰牌、缺对子', hh.tri === false && hh.pair === false);

section('断幺九时摸到幺九可上听');
G = newGame();
// 1 副露 + 10 张：形状标准已听（向听 0），但手牌无幺九，本地不能听
G.players[HUMAN].melds = [{ type: 'peng', ts: [T('tiao',5),T('tiao',5),T('tiao',5)] }];
G.players[HUMAN].hand = [T('wan',2),T('wan',3),T('wan',4),T('wan',5),T('wan',6),T('wan',7),T('wan',8),T('wan',8),T('tong',7),T('tong',8)];
ok('标准向听为 0 但本地未听',
  Tile.shanten(G.players[HUMAN].hand, G.players[HUMAN].melds) === 0 &&
  !Tile.isTing(G.players[HUMAN].hand, G.players[HUMAN].melds));
hh = Game.handHints(HUMAN);
ok('hint 不误报已听/可打听', hh.plans.length === 0 && hh.wins.length === 0);
ok('差的一张是幺九：摸 1万/9筒可上听',
  Game.drawsForTing(HUMAN).map(t => t.id).sort().join(',') === '1wan,9tong');

// ============ 抓牌上听方案（差的是哪张：打哪张、听哪张） ============
section('抓牌上听方案（打哪张、听哪张）');
G = newGame();
G.players[HUMAN].melds = [{ type: 'peng', ts: [T('wan',1),T('wan',1),T('wan',1)] }];
G.players[HUMAN].hand = [T('wan',2),T('wan',3),T('wan',4),T('wan',5),T('wan',6),T('wan',7),T('tiao',5),T('tiao',5),T('tiao',5),T('tong',8),T('tong',9)];
let plans = Game.tingPlans(HUMAN);
ok('有上听方案', plans.length > 0);
ok('方案弃张与听牌张一致',
  plans.map(p => p.discard.id).sort().join(',') ===
  Game.tingDiscards(HUMAN).map(t => t.id).sort().join(','));
ok('每个方案都有胡牌', plans.every(p => p.wins.length > 0));
ok('打 5条听 7筒', plans.some(p => p.discard.id === '5tiao' && p.wins.some(w => w.id === '7tong')));
ok('打 8筒听 9筒', plans.some(p => p.discard.id === '8tong' && p.wins.some(w => w.id === '9tong')));
ok('副露有幺九时 9筒可打：打 9筒听 8筒', plans.some(p => p.discard.id === '9tong' && p.wins.some(w => w.id === '8tong')));
ok('方案弃张均为合法上听弃张',
  plans.every(p => Game.isTingDiscard(G.players[HUMAN].hand, G.players[HUMAN].melds, p.discard)));
ok('14 张时不计算摸牌 draws', Game.drawsForTing(HUMAN).length === 0);
hh = Game.handHints(HUMAN);
ok('hint 给出 plans 且无 draws', hh.plans.length > 0 && hh.draws.length === 0);

// ============ 摸牌上听（13 张差一摸：差哪张、见光排除） ============
section('摸牌上听（差哪张、见光排除）');
G = newGame();
G.players[HUMAN].melds = [{ type: 'peng', ts: [T('tiao',5),T('tiao',5),T('tiao',5)] }];
G.players[HUMAN].hand = [T('wan',1),T('wan',2),T('wan',3),T('wan',4),T('wan',5),T('wan',6),T('tiao',7),T('tiao',7),T('tong',8),T('tiao',9)];
ok('13 张未听', !Tile.isTing(G.players[HUMAN].hand, G.players[HUMAN].melds));
let draws = Game.drawsForTing(HUMAN);
ok('差的一张含 7条：摸到即打 9条/8筒可听', draws.some(t => t.id === '7tiao'));
G.discard = [T('tiao',7),T('tiao',7)]; // 另两张 7条见光，无剩余
draws = Game.drawsForTing(HUMAN);
ok('见光无剩余的 7条不再提示', !draws.some(t => t.id === '7tiao'));
ok('仍有其他摸牌可上听', draws.length > 0);
hh = Game.handHints(HUMAN);
ok('hint 给出 draws 且无 plans', hh.draws.length > 0 && hh.plans.length === 0 && hh.wins.length === 0);

// ============ 回归：吃九万后可打九筒上听（副露有幺九不断幺九） ============
section('回归：吃九万后可打九筒上听');
G = newGame();
// 2 副露（碰 5条 + 吃 345筒）+ 7 张：二三四五七八万 + 九筒
G.players[HUMAN].melds = [
  { type: 'peng', ts: [T('tiao',5),T('tiao',5),T('tiao',5)] },
  { type: 'chi', ts: [T('tong',3),T('tong',4),T('tong',5)] }
];
G.players[HUMAN].hand = [T('wan',2),T('wan',3),T('wan',4),T('wan',5),T('wan',7),T('wan',8),T('tong',9)];
G.lastD = T('wan',9); G.lastDB = 2; // 对家打出九万（非上家）
G.phase = 'claim'; G.pending = [HUMAN]; G.over = false; G.curP = 2; G.ting = new Set();
let chi9 = Game.claimActions(HUMAN).find(a => a.a === 'chi');
ok('吃九万可上听', !!chi9 && chi9.ting === true);
Game.handleAB(HUMAN, 'chi', chi9.d);
ok('吃后待打听牌张', G.forceTing === true && !G.ting.has(HUMAN));
ok('九筒可打出上听', Game.tingDiscards(HUMAN).some(t => t.id === '9tong'));
let plan9 = Game.tingPlans(HUMAN).find(p => p.discard.id === '9tong');
ok('打九筒听二万/五万', !!plan9 && plan9.wins.some(w => w.id === '2wan') && plan9.wins.some(w => w.id === '5wan'));
Game.handleDiscard(G.players[HUMAN].hand.findIndex(t => t.id === '9tong'));
ok('打出九筒后进入听牌', G.ting.has(HUMAN));

// ============ 吃/碰上听与抓牌上听的区分 ============
section('吃碰上听与抓牌上听的区分');
function tingClaimGame(lastDB) {
  const g = newGame();
  g.players[HUMAN].hand = [
    T('wan',3),T('wan',3),T('wan',4),T('wan',5),
    T('tong',1),T('tong',2),T('tong',3),
    T('tong',5),T('tong',5),T('tong',5),
    T('tiao',7),T('tiao',7),T('tiao',9)
  ];
  g.lastD = T('wan',3); g.lastDB = lastDB;
  g.phase = 'claim'; g.pending = [HUMAN]; g.over = false; g.curP = lastDB; g.ting = new Set();
  return g;
}
// 对家打出：吃/碰都能上听（吃碰别家），与抓牌无关
tingClaimGame(2);
let tas = Game.claimActions(HUMAN).filter(a => a.ting);
ok('吃碰别家可上听（吃·听/碰·听）',
  tas.some(a => a.a === 'chi') && tas.some(a => a.a === 'peng'));
// 上家打出：能听则标为上听（优先于碰杠），但不强制；抓牌上听另看提示栏
tingClaimGame(3);
let upperChi = Game.claimActions(HUMAN).find(a => a.a === 'chi');
ok('吃上家能听时标为上听', !!upperChi && upperChi.ting === true);

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
await new Promise(r => setTimeout(r, Game.TICK + 50)); // 出牌后经 TICK 节拍才轮到下家摸牌
ok('南自摸 记入南 zimo=1', G.stats.per[1].zimo === 1);
ok('其他玩家无胡牌记录', G.stats.per[0].zimo === 0 && G.stats.per[0].ron === 0 && G.stats.per[2].zimo === 0);

// ============ 战绩口径（宝牌自摸仅计宝牌胡） ============
section('战绩口径（宝牌自摸仅计宝牌胡）');
let st = UI.statOf({ stat: { zimo: 3, ron: 4, dianpao: 2, heipao: 2, baopi: 2, dianhei: 1 } });
ok('自摸宝牌不计入自摸胡', st.zimo === 1 && st.baopi === 2);
ok('点炮胡+黑炮胡+自摸胡+宝牌胡=总胡', st.zong === 2 + 2 + 1 + 2);
ok('零数据为零', UI.statOf({ stat: {} }).zong === 0);

// ============ 听牌弹窗（失焦不残留） ============
section('听牌弹窗（失焦不残留）');
{
  let fakeEl = () => {
    let s = new Set();
    return {
      id: '', className: '', title: '', innerHTML: '', style: {}, children: [],
      classList: { add: c => s.add(c), remove: c => s.delete(c), contains: c => s.has(c) },
      appendChild(c) { this.children.push(c); return c; },
      get offsetWidth() { return 60; }, get offsetHeight() { return 40; }
    };
  };
  let popRef = null;
  globalThis.document = {
    getElementById: id => id === 'ting-pop' ? popRef : null,
    createElement: () => fakeEl(),
    body: { appendChild(e) { if (e.id === 'ting-pop') popRef = e; } },
    addEventListener() {}
  };
  globalThis.window = { innerWidth: 800 };
  let anchor = { getBoundingClientRect: () => ({ left: 100, top: 200, width: 40, height: 50 }) };
  UI.showTingPop(anchor, [T('wan', 1), T('tong', 2)]);
  ok('悬停显示两张听牌', !!popRef && !popRef.classList.contains('hide') && popRef.children.length === 2);
  UI.hideTingPop();
  ok('失焦后关闭并清空', popRef.classList.contains('hide') && popRef.innerHTML === '');
  UI.hideTingPop();
  ok('无弹窗时关闭不报错', true);
  delete globalThis.document;
  delete globalThis.window;
}


// ============ 右侧长显：还差一张上听（吃/碰 vs 手抓） ============
section('右侧长显：还差一张上听');
G = newGame();
G.players[HUMAN].melds = [{ type: 'peng', ts: [T('tiao',5),T('tiao',5),T('tiao',5)] }];
G.players[HUMAN].hand = [T('wan',1),T('wan',2),T('wan',3),T('wan',4),T('wan',5),T('wan',6),T('tiao',7),T('tiao',7),T('tong',8),T('tiao',9)];
let watch = Game.tingWatch(HUMAN);
ok('吃/碰含碰 7条与吃 8条',
  !!watch && watch.claim.map(t => t.id).join(',') === '7tiao,8tiao');
ok('重复进张只在吃/碰里，手抓不再列 7条/8条',
  !!watch && !watch.draws.some(t => t.id === '7tiao' || t.id === '8tiao'));
ok('手抓仍有其余进张', !!watch && watch.draws.length > 0);
G.discard = [T('tiao',7),T('tiao',7)]; // 7条见光无剩余
watch = Game.tingWatch(HUMAN);
ok('见光的 7条移出吃/碰', !!watch && watch.claim.map(t => t.id).join(',') === '8tiao');
ok('见光后手抓也不含 7条', !!watch && !watch.draws.some(t => t.id === '7tiao'));

// 碰开门上听：碰 8条后打 9筒/1万可听
G = newGame();
G.players[HUMAN].melds = [{ type: 'chi', ts: [T('tong',1),T('tong',2),T('tong',3)] }];
G.players[HUMAN].hand = [T('wan',2),T('wan',3),T('wan',4),T('wan',5),T('wan',6),T('wan',7),T('tiao',8),T('tiao',8),T('tong',9),T('wan',1)];
watch = Game.tingWatch(HUMAN);
ok('碰开门上听：吃/碰含 8条', !!watch && watch.claim.some(t => t.id === '8tiao'));
ok('碰开门上听：手抓含 4万（摸 4万打 9筒可听）', !!watch && watch.draws.some(t => t.id === '4wan'));

// 门前清也能吃/碰开门上听（手抓为空）
G = newGame();
G.players[HUMAN].hand = [T('wan',1),T('wan',2),T('wan',3),T('wan',4),T('wan',5),T('wan',6),T('tong',7),T('tong',8),T('tong',9),T('tiao',7),T('tiao',7),T('tiao',9),T('wan',9)];
watch = Game.tingWatch(HUMAN);
ok('门前清：吃/碰 7条可开门上听',
  !!watch && watch.claim.map(t => t.id).join(',') === '7tiao' && watch.draws.length === 0);

// 差多张 / 已听牌：不显示
G = newGame();
G.players[HUMAN].melds = [{ type: 'chi', ts: [T('tong',1),T('tong',2),T('tong',3)] }];
G.players[HUMAN].hand = [T('wan',2),T('wan',3),T('wan',4),T('wan',5),T('wan',6),T('wan',7),T('tiao',1),T('tiao',2),T('tong',8),T('wan',9)];
ok('差多张时不显示', Game.tingWatch(HUMAN) === null);
G.ting = new Set([HUMAN]);
ok('已听牌时不显示', Game.tingWatch(HUMAN) === null);


// ============ 3副露后禁吃碰杠（防手把一） ============
section('3副露后禁吃碰杠');
G = newGame();
G.players[HUMAN].melds = [
  { type: 'peng', ts: [T('wan',1),T('wan',1),T('wan',1)] },
  { type: 'peng', ts: [T('tiao',5),T('tiao',5),T('tiao',5)] },
  { type: 'chi', ts: [T('tong',1),T('tong',2),T('tong',3)] }
];
G.players[HUMAN].hand = [T('tong',5),T('tong',5),T('wan',7),T('wan',8)];
G.lastD = T('tong',5); G.lastDB = 2;
G.phase = 'claim'; G.pending = [HUMAN]; G.over = false; G.curP = 2; G.ting = new Set();
ok('3副露时碰/吃/杠都不提供', Game.claimActions(HUMAN).length === 0);
// 已听牌时胡仍可响应
G.ting = new Set([HUMAN]);
G.players[HUMAN].hand = [T('tiao',7),T('tiao',7),T('tong',8),T('tong',9)];
G.lastD = T('tong',7); G.lastDB = 2;
ok('3副露听牌后胡仍可响应', Game.claimActions(HUMAN).some(a => a.a === 'hu'));
// 暗杠会成第4副露：3副露时禁止；补杠不增副露：允许
G = newGame();
G.players[HUMAN].melds = [
  { type: 'peng', ts: [T('wan',1),T('wan',1),T('wan',1)] },
  { type: 'peng', ts: [T('wan',2),T('wan',2),T('wan',2)] },
  { type: 'peng', ts: [T('tiao',5),T('tiao',5),T('tiao',5)] }
];
G.players[HUMAN].hand = [T('tong',3),T('tong',3),T('tong',3),T('tong',3),T('wan',1)];
G.phase = 'discard'; G.curP = HUMAN; G.over = false; G.ting = new Set();
let sa = Game.selfActions(HUMAN);
ok('3副露时不提供暗杠', !sa.some(a => a.a === 'selfKong'));
ok('3副露时补杠仍可（不增副露）', sa.some(a => a.a === 'buKong'));
G.players[HUMAN].melds.pop();
sa = Game.selfActions(HUMAN);
ok('2副露时暗杠正常提供', sa.some(a => a.a === 'selfKong'));

// ============ 非本人回合不可宣告听牌 ============
section('非本人回合不可宣告听牌');
G = newGame();
G.players[HUMAN].melds = [{ type: 'peng', ts: [T('tiao',5),T('tiao',5),T('tiao',5)] }];
G.players[HUMAN].hand = [T('wan',1),T('wan',2),T('wan',3),T('wan',4),T('wan',5),T('wan',6),T('tiao',7),T('tiao',7),T('tong',8),T('tong',9)];
G.phase = 'discard'; G.curP = HUMAN; G.over = false; G.lock = false; G.ting = new Set();
ok('本人回合可宣告', Game.canDeclareNow(HUMAN));
G.curP = 1;
ok('他人回合不可宣告', !Game.canDeclareNow(HUMAN));
G.curP = HUMAN; G.phase = 'claim'; G.lastD = T('wan',9); G.lastDB = HUMAN;
ok('本人弃张结算中可立即宣告', Game.canDeclareNow(HUMAN));
G.curP = 1; G.lastDB = 1;
ok('他人弃张结算中不可宣告', !Game.canDeclareNow(HUMAN));

// ============ 点听牌后只能打出听牌张 ============
section('点听牌后只能打出听牌张');
G = newGame();
G.players[HUMAN].melds = [{ type: 'peng', ts: [T('wan',1),T('wan',1),T('wan',1)] }];
G.players[HUMAN].hand = [T('wan',2),T('wan',3),T('wan',4),T('wan',5),T('wan',6),T('wan',7),T('tiao',5),T('tiao',5),T('tiao',5),T('tong',8),T('tong',9)];
G.phase = 'discard'; G.curP = HUMAN; G.lock = false; G.over = false; G.ting = new Set();
Game.handleAB(HUMAN, 'ting');
ok('点听牌进入待打状态', G.tingIntent === true && !G.ting.has(HUMAN));
let before = G.players[HUMAN].hand.length;
Game.handleDiscard(G.players[HUMAN].hand.findIndex(t => t.id === '2wan'));
ok('非听牌张打出无效', G.players[HUMAN].hand.length === before && G.tingIntent === true);
Game.handleDiscard(G.players[HUMAN].hand.findIndex(t => t.id === '8tong'));
ok('听牌张打出后进入听牌', G.ting.has(HUMAN));


// ============ 上听距离（本地规则提示） ============
section('上听距离（本地规则）');
G = newGame();
// 无刻子无对子：标准向听=1，本地应为还差 2 张
G.players[HUMAN].melds = [{ type: 'chi', ts: [T('tong',1),T('tong',2),T('tong',3)] }];
G.players[HUMAN].hand = [T('wan',2),T('wan',3),T('wan',4),T('wan',5),T('wan',6),T('wan',7),T('tiao',1),T('tiao',2),T('tong',8),T('wan',9)];
ok('无刻子无对子：还差 2 张上听', Game.localTingDistance(HUMAN) === 2);
// 断幺九差一张
G = newGame();
G.players[HUMAN].melds = [{ type: 'peng', ts: [T('tiao',5),T('tiao',5),T('tiao',5)] }];
G.players[HUMAN].hand = [T('wan',2),T('wan',3),T('wan',4),T('wan',5),T('wan',6),T('wan',7),T('wan',8),T('wan',8),T('tong',7),T('tong',8)];
ok('断幺九：还差 1 张上听', Game.localTingDistance(HUMAN) === 1);
// 已听
G = newGame();
G.players[HUMAN].melds = [{ type: 'peng', ts: [T('wan',1),T('wan',1),T('wan',1)] }];
G.players[HUMAN].hand = [T('wan',2),T('wan',3),T('wan',4),T('wan',5),T('wan',6),T('wan',7),T('tiao',7),T('tiao',7),T('tong',8),T('tong',9),T('wan',9)];
ok('已听牌：距离 0', Game.localTingDistance(HUMAN) === 0);
// 14 张可打一张即听
G = newGame();
G.players[HUMAN].melds = [{ type: 'peng', ts: [T('wan',1),T('wan',1),T('wan',1)] }];
G.players[HUMAN].hand = [T('wan',2),T('wan',3),T('wan',4),T('wan',5),T('wan',6),T('wan',7),T('tiao',5),T('tiao',5),T('tiao',5),T('tong',8),T('tong',9)];
ok('14 张可打一张听：距离 0', Game.localTingDistance(HUMAN) === 0);


// ============ 非标向听 effectiveShanten（计入须有刻子/顺子等约束） ============
section('非标向听 effectiveShanten');
G = newGame();
let mc1 = [{ type: 'chi', ts: [T('tong',1),T('tong',2),T('tong',3)] }];
let hNoTri = [T('wan',2),T('wan',3),T('wan',4),T('wan',5),T('wan',6),T('wan',7),T('tiao',1),T('tiao',2),T('tong',8),T('wan',9)];
ok('无刻无对：标准1 / 非标2',
  Tile.shanten(hNoTri, mc1) === 1 && Tile.effectiveShanten(hNoTri, mc1) === 2, Tile.effectiveShanten(hNoTri, mc1));
// 无刻子但有两对：一对作雀头、一对可升刻，非标已听
let hTwoPair = [T('wan',2),T('wan',3),T('wan',4),T('wan',5),T('wan',6),T('wan',7),T('tong',8),T('tong',8),T('tiao',5),T('tiao',5)];
ok('无刻子但有两对：非标0', Tile.effectiveShanten(hTwoPair, mc1) === 0, Tile.effectiveShanten(hTwoPair, mc1));
// 一对 + 顺子搭子且无刻：标准 0 但非标还差一手
let hOnePairRun = [T('wan',2),T('wan',3),T('wan',4),T('wan',5),T('wan',6),T('wan',7),T('tong',8),T('tong',8),T('tiao',5),T('tiao',6)];
ok('一对+搭子无刻：标准0 / 非标1',
  Tile.shanten(hOnePairRun, mc1) === 0 && Tile.effectiveShanten(hOnePairRun, mc1) === 1);
// 红中雀头免刻子：4 顺 + 红中雀头成胡
let hZhong = [T('wan',1),T('wan',2),T('wan',3),T('wan',4),T('wan',5),T('wan',6),T('tiao',1),T('tiao',2),T('tiao',3),T('tong',7),T('tong',8),T('tong',9),Z,Z];
ok('红中雀头免刻子：非标 -1', Tile.effectiveShanten(hZhong, []) === -1, Tile.effectiveShanten(hZhong, []));
// 断幺九：标准 0 / 非标 1
let mp5 = [{ type: 'peng', ts: [T('tiao',5),T('tiao',5),T('tiao',5)] }];
let hYao = [T('wan',2),T('wan',3),T('wan',4),T('wan',5),T('wan',6),T('wan',7),T('wan',8),T('wan',8),T('tong',7),T('tong',8)];
ok('断幺九：标准0 / 非标1', Tile.shanten(hYao, mp5) === 0 && Tile.effectiveShanten(hYao, mp5) === 1);
// 死搭：等 8 万的坎张 7-9，若 8 万已见光（如被碰）则不再算搭子
let handKan = [T('wan',2),T('wan',3),T('wan',4),T('tiao',2),T('tiao',3),T('tiao',4),T('wan',7),T('wan',9),T('tong',8),T('tong',8)];
let no8 = (t) => (t.type === 'wan' && t.num === 8) ? 0 : 4;
ok('死坎张（8万见光）不再算搭子：非标0→1',
  Tile.effectiveShanten(handKan, mp5, () => 4) === 0 && Tile.effectiveShanten(handKan, mp5, no8) === 1);
// 两面：缺的一侧见光仍有价值，两侧都见光才算死搭
let handRy = [T('wan',2),T('wan',3),T('wan',4),T('tiao',2),T('tiao',3),T('tiao',4),T('wan',7),T('wan',8),T('tong',8),T('tong',8)];
let no6 = (t) => (t.type === 'wan' && t.num === 6) ? 0 : 4;
let no69 = (t) => (t.type === 'wan' && (t.num === 6 || t.num === 9)) ? 0 : 4;
ok('两面单侧见光仍有价值，两侧见光才降为死搭',
  Tile.effectiveShanten(handRy, mp5, () => 4) === 1 &&
  Tile.effectiveShanten(handRy, mp5, no6) === 1 &&
  Tile.effectiveShanten(handRy, mp5, no69) === 2);


ok('节奏档位', (Game.setPace(0), Game.TICK) === 500 && Game.setPace(2) && Game.TICK === 1500
  && Game.setPace(9) === false && (Game.setPace(1), Game.TICK) === 1000);

section('吃听/点听牌时不提供暗杠补杠');
G = newGame();
G.players[HUMAN].hand = [T('wan',5),T('wan',5),T('wan',5),T('wan',5),T('tiao',3),T('tiao',4),T('tiao',5),T('tong',1),T('tong',2),T('tong',3),T('tong',7),T('tong',8),T('tong',9),T('zhong')];
G.players[HUMAN].melds = [{ type: 'peng', ts: [T('tiao',3),T('tiao',3),T('tiao',3)], claimedId: '3tiao' }];
G.curP = HUMAN; G.phase = 'discard'; G.over = false; G.ting = new Set(); G.forceTing = false; G.tingIntent = false; G.lock = false;
let saTing = Game.selfActions(HUMAN).map(a => a.a);
ok('正常出牌时提供暗杠与补杠', saTing.includes('selfKong') && saTing.includes('buKong'));
G.forceTing = true;
ok('吃听中不再提供杠', Game.selfActions(HUMAN).length === 0);
G.forceTing = false; G.tingIntent = true;
ok('点听牌选张中不再提供杠', Game.selfActions(HUMAN).length === 0);
G.tingIntent = false;

section('结算后回主页仍可继续下一局');
G = newGame();
G.playing = true; G.over = false; G.selfHu = true;
G.lastDraw = T('wan',9);
G.players[HUMAN].hand = [T('wan',1),T('wan',2),T('wan',3),T('wan',4),T('wan',5),T('wan',6),T('tiao',5),T('tiao',5),T('tiao',5),T('tong',7),T('tong',8),T('tong',9),T('tong',9),T('tong',9)];
Game.handleAB(HUMAN, 'hu');
ok('自摸后进入结算 over', G.over === true);
Game.toLobby();
ok('回主页保留本局玩家与积分', G.players.length === 4 && G.playing === false);
Game.resumeGame();
ok('继续游戏接力开下一局', G.over === false && G.playing === true && G.players.length === 4);

section('结算落盘：刷新后回到新一局而非已结束手牌');
{
  let store = new Map();
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: k => { store.delete(k); }
  };
}
G = newGame();
G.playing = true; G.over = false; G.selfHu = true;
G.lastDraw = T('wan',9);
G.players[HUMAN].hand = [T('wan',1),T('wan',2),T('wan',3),T('wan',4),T('wan',5),T('wan',6),T('tiao',5),T('tiao',5),T('tiao',5),T('tong',7),T('tong',8),T('tong',9),T('tong',9),T('tong',9)];
Game.handleAB(HUMAN, 'hu');
let snap = JSON.parse(localStorage.getItem('mahjong_save_v2'));
ok('结算后存档标记为本局结束', snap && snap.over === true && Array.isArray(snap.scores));
// 模拟刷新：清空内存态，从存档恢复
G.players = []; G.over = false; G.playing = true;
ok('刷新恢复为结束态（无手牌可打）', Game.restore() === true && G.over === true && G.playing === false && G.players.length === 4);
Game.resumeGame();
ok('恢复后继续即开新一局', G.over === false && G.playing === true && G.players.length === 4);

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
