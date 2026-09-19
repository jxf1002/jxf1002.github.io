import { PN, PLAYER_COUNT, HUMAN } from './constants.js';
import * as Tile from './tile.js';
import * as Score from './score.js';

const AI_DELAY = 700;
const CLAIM_DELAY = 500;

// ===== AI 难度配置 =====
export const AI_LEVELS = {
  easy: { randomness: 0.5, claimPengRate: 0.6, claimChiRate: 0.35, kongRate: 1, defenseWeight: 0, ukeireWeight: 0, scoreWeight: 0, useTingInfo: false, useOpponentModel: false },
  normal: { randomness: 0.1, claimPengRate: 0.7, claimChiRate: 0.4, kongRate: 1, defenseWeight: 0.3, ukeireWeight: 1, scoreWeight: 0.2, useTingInfo: true, useOpponentModel: false },
  hard: { randomness: 0, claimPengRate: 1, claimChiRate: 1, kongRate: 1, defenseWeight: 1, ukeireWeight: 3, scoreWeight: 1, useTingInfo: true, useOpponentModel: true }
};
const AI_LEVEL_KEY = 'mahjong_aiLevel';

// 无头模拟开关（仅测试用）：把异步调度收进队列，由 simulateRound 同步驱动
let SIM_MODE = false;
let simQueue = [];
let simFirstTing = null;
let simTingSeen = {};

export let G = {
  deck: [], players: [], curP: 0, dealer: 0,
  discard: [], wall: 0,
  baopi: null, bpR: false,
  ting: new Set(), over: false, winner: null,
  lastD: null, lastDB: -1, lastDraw: null, lastFrom: '',
  phase: 'discard', pending: [], passed: new Set(),
  lock: false, token: 0, tingIntent: false, selfHu: false, forceTing: false,
  playing: false,
  aiLevel: 'normal',
  aiLevels: null,
  auto: false,
  stats: null,
  demo: false
};

function freshStats() {
  return {
    hands: 0, rotations: 0, draw: 0,
    per: [0, 1, 2, 3].map(() => ({ zimo: 0, ron: 0, heipao: 0, baopi: 0, dianpao: 0, dianhei: 0 }))
  };
}

function normPer(p) {
  return { zimo: p.zimo || 0, ron: p.ron || 0, heipao: p.heipao || 0, baopi: p.baopi || 0, dianpao: p.dianpao || 0, dianhei: p.dianhei || 0 };
}

let uiCB = null;
export function setUI(cb) { uiCB = cb; }
function ui(fn, ...args) {
  if (uiCB && uiCB[fn]) uiCB[fn](...args);
  if (fn === 'update') saveState();
}

// ===== 存档：localStorage 实时记录，关页面后可继续 =====
const SAVE_KEY = 'mahjong_save_v2';

export function saveState() {
  try {
    if (G.demo || G.over || !G.players.length) return;
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      deck: G.deck, players: G.players, curP: G.curP, dealer: G.dealer,
      discard: G.discard, wall: G.wall, baopi: G.baopi, bpR: G.bpR,
      ting: [...G.ting], winner: G.winner, lastD: G.lastD, lastDB: G.lastDB,
      lastDraw: G.lastDraw, lastFrom: G.lastFrom, phase: G.phase,
      pending: G.pending, passed: [...G.passed], tingIntent: G.tingIntent, selfHu: G.selfHu,
      token: G.token, playing: true, stats: G.stats, forceTing: G.forceTing, aiLevel: G.aiLevel
    }));
  } catch (e) { /* 忽略存储异常 */ }
}

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}

// ===== AI 难度读写 =====
export function getAILevel(pI) {
  if (pI !== undefined && G.auto && pI === HUMAN) return 'hard'; // 托管：东家直接用最强 AI
  if (pI !== undefined && G.aiLevels && AI_LEVELS[G.aiLevels[pI]]) return G.aiLevels[pI];
  return G.aiLevel || 'normal';
}

export function setAILevel(level) {
  if (!AI_LEVELS[level]) return false;
  G.aiLevel = level;
  try { localStorage.setItem(AI_LEVEL_KEY, level); } catch (e) { /* ignore */ }
  return true;
}

export function loadAILevel() {
  try {
    let l = localStorage.getItem(AI_LEVEL_KEY);
    if (AI_LEVELS[l]) G.aiLevel = l;
  } catch (e) { /* ignore */ }
}

// ===== 托管：东家交给最强 AI 自动打 =====
export function getAuto() { return !!G.auto; }

export function setAuto(on) {
  G.auto = !!on;
  ui('update');
  if (G.auto) autoResume();
}

// 开启托管或续局时，立即接管东家当前等待的操作
function autoResume() {
  if (!G.auto || SIM_MODE || !G.playing || G.over) return;
  if (G.selfHu) { G.selfHu = false; win(HUMAN, null, true); return; }
  if (G.phase === 'claim' && G.pending.includes(HUMAN)) {
    let act = aiChooseClaim(HUMAN, claimActions(HUMAN));
    if (act) executeClaim(HUMAN, act);
    else { G.pending = []; G.passed.add(HUMAN); resolveClaims(); }
    return;
  }
  if (G.phase === 'discard' && G.curP === HUMAN && !G.lock) scheduleAIDiscard(HUMAN);
}

export function restore() {
  try {
    let raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    let d = JSON.parse(raw);
    if (!d.players || !d.players.length) return false;
    G.deck = d.deck; G.players = d.players; G.curP = d.curP; G.dealer = d.dealer;
    G.discard = d.discard; G.wall = d.wall; G.baopi = d.baopi; G.bpR = d.bpR;
    visSig = ''; visMap = null; // 恢复存档时重置已见牌缓存
    G.ting = new Set(d.ting); G.winner = d.winner; G.lastD = d.lastD; G.lastDB = d.lastDB;
    G.lastDraw = d.lastDraw; G.lastFrom = d.lastFrom; G.phase = d.phase;
    G.pending = d.pending || []; G.passed = new Set(d.passed || []);
    G.tingIntent = !!d.tingIntent; G.selfHu = !!d.selfHu; G.forceTing = !!d.forceTing; G.token = (d.token || 0) + 1;
    G.aiLevel = AI_LEVELS[d.aiLevel] ? d.aiLevel : 'normal';
    G.lock = false; G.over = false;
    G.playing = false;
    G.stats = d.stats ? { hands: d.stats.hands || 0, rotations: d.stats.rotations || 0, draw: d.stats.draw || 0, per: (d.stats.per || []).map(normPer) } : freshStats();
    while (G.stats.per.length < 4) G.stats.per.push(normPer({}));
    return true;
  } catch (e) { return false; }
}

// 回主页面：冻结牌局、保留存档、回大厅
export function toLobby() {
  if (!G.players.length) { G.playing = false; ui('update'); return; }
  G.playing = false;
  G.lock = true;
  G.token = (G.token || 0) + 1; // 作废所有待执行的定时器
  saveState();
  ui('update');
}

// 大厅继续游戏：恢复冻结前的牌局
export function resumeGame() {
  if (!G.players.length) return;
  G.playing = true;
  G.token = (G.token || 0) + 1;
  G.lock = false;
  ui('update');
  resume();
}

function resume() {
  if (G.over) return;
  if (G.selfHu) { if (G.auto) autoResume(); return; } // 等待玩家确认自摸
  if (G.phase === 'claim') {
    if (G.pending.includes(HUMAN)) { if (G.auto) autoResume(); return; }
    let token = G.token;
    scheduleTask(() => { if (G.token === token && !G.over) resolveClaims(); }, CLAIM_DELAY);
  } else if (G.phase === 'discard') {
    if (G.curP === HUMAN) {
      if (G.auto) {
        scheduleAIDiscard(HUMAN);
      } else if (G.forceTing) {
        // 上听吃状态恢复，让用户选择出牌
        ui('update');
      } else if (G.ting.has(HUMAN)) {
        G.lock = true;
        let token = G.token;
        scheduleTask(() => {
          if (G.token !== token || G.over) { G.lock = false; return; }
          humanAutoDiscard();
        }, AI_DELAY);
      }
    } else {
      scheduleAIDiscard(G.curP);
    }
  }
}

// ===== 新手指引演示局：固定牌面专供讲解，不写存档，退出时凭存档恢复真牌局 =====
export function startDemo() {
  G.token = (G.token || 0) + 1;
  let T = (type, num) => type === 'zhong'
    ? { type, num: 0, suit: '红中', id: '红中' }
    : { type, num, suit: Tile.SN[type], id: num + type };
  let lastD = T('wan', 3);
  G.players = [
    { index: 0, name: PN[0], isD: true, score: 120,
      hand: [T('wan', 6), T('wan', 7), T('wan', 8), T('tiao', 2), T('tiao', 5), T('tiao', 7), T('tong', 3), T('tong', 6), T('tong', 8), T('wan', 3), T('wan', 3), T('zhong'), T('zhong')],
      melds: [{ type: 'peng', ts: [T('tiao', 9), T('tiao', 9), T('tiao', 9)], claimedId: '9tiao' }],
      disc: [T('tiao', 1), T('wan', 9)] },
    { index: 1, name: PN[1], isD: false, score: -30,
      hand: [T('wan', 1), T('wan', 2), T('wan', 4), T('tiao', 3), T('tiao', 6), T('tiao', 8), T('tong', 2), T('tong', 5), T('tong', 7), T('tong', 9), T('wan', 5), T('tiao', 9), T('zhong')],
      melds: [{ type: 'chi', ts: [T('tiao', 4), T('tiao', 5), T('tiao', 6)], claimedId: '5tiao' }],
      disc: [T('tiao', 1), T('wan', 9)] },
    { index: 2, name: PN[2], isD: false, score: -40,
      hand: [T('wan', 2), T('wan', 5), T('wan', 7), T('tiao', 1), T('tiao', 4), T('tiao', 8), T('tong', 1), T('tong', 4), T('tong', 6), T('tong', 9), T('wan', 8), T('tiao', 2), T('tiao', 7)],
      melds: [],
      disc: [T('tong', 2)] },
    { index: 3, name: PN[3], isD: false, score: -50,
      hand: [T('wan', 1), T('wan', 4), T('wan', 6), T('tiao', 3), T('tiao', 6), T('tiao', 9), T('tong', 1), T('tong', 5), T('tong', 7), T('wan', 2), T('wan', 7), T('tiao', 8), T('tong', 4)],
      melds: [],
      disc: [T('tiao', 5), lastD] },
  ];
  G.deck = []; G.discard = G.players.flatMap(p => p.disc);
  G.curP = 3; G.dealer = 0; G.wall = 38;
  G.baopi = null; G.bpR = false; G.ting = new Set();
  G.over = false; G.winner = null;
  G.lastD = lastD; G.lastDB = 3; G.lastDraw = null; G.lastFrom = '';
  G.phase = 'claim'; G.pending = [HUMAN]; G.passed = new Set();
  G.lock = true; G.tingIntent = false; G.selfHu = false; G.forceTing = false;
  G.playing = true; G.auto = false; G.demo = true;
  G.stats = freshStats();
  addTing(1);
  ui('update');
}

// 退出演示：凭存档恢复真牌局；无存档则回空大厅
export function endDemo() {
  G.demo = false;
  G.token = (G.token || 0) + 1;
  G.lock = false;
  G.pending = [];
  if (restore()) return true;
  G.players = []; G.discard = [];
  G.playing = false; G.over = false;
  G.ting = new Set();
  G.lastD = null; G.lastDB = -1;
  G.stats = freshStats();
  return false;
}

function mkPlayer(i) {
  return { index: i, hand: [], melds: [], disc: [], name: PN[i], isD: false, score: 0 };
}

function sortHand(p) {
  p.hand.sort((a, b) => {
    let ta = a.type === 'zhong' ? 99 : Tile.TT.indexOf(a.type);
    let tb = b.type === 'zhong' ? 99 : Tile.TT.indexOf(b.type);
    if (ta !== tb) return ta - tb;
    return a.num - b.num;
  });
}

function takeFromHand(p, tile, n) {
  let used = [];
  for (let i = p.hand.length - 1; i >= 0 && used.length < n; i--) {
    if (Tile.tid(p.hand[i]) === Tile.tid(tile)) used.push(p.hand.splice(i, 1)[0]);
  }
  return used;
}

export function init() {
  clearSave();
  G.dealer = 0;
  G.playing = true;
  G.stats = freshStats();
  startRound(true);
}

function buildSummary() {
  let s = G.stats || freshStats();
  let tot = { zimo: 0, ron: 0, heipao: 0, baopi: 0, dianpao: 0, dianhei: 0 };
  (s.per || []).forEach(p => {
    p = normPer(p);
    tot.zimo += p.zimo; tot.ron += p.ron; tot.heipao += p.heipao; tot.baopi += p.baopi;
    tot.dianpao += p.dianpao; tot.dianhei += p.dianhei;
  });
  return {
    hands: s.hands, rotations: s.rotations, draw: s.draw,
    zimo: tot.zimo, ron: tot.ron, heipao: tot.heipao, baopi: tot.baopi,
    dianpao: tot.dianpao, dianhei: tot.dianhei,
    hu: tot.zimo + tot.ron,
    scores: G.players.map((p, i) => ({
      name: p.name, me: i === HUMAN, isD: p.isD, score: p.score,
      stat: normPer((s.per && s.per[i]) || {})
    }))
  };
}

// 大厅查看战绩：只展示，不结束牌局
export function showStats() {
  if (!G.players.length) return;
  ui('showSummary', buildSummary());
}

// 结束整局，返回统计并弹出结算
export function endGame() {
  if (!G.playing) return;
  G.playing = false;
  G.over = true;      // 冻结牌局
  G.lock = true;
  G.token = (G.token || 0) + 1; // 作废所有待执行的定时器
  clearSave();
  ui('update');
  ui('showSummary', buildSummary());
}

function startRound(resetScores) {
  let scores = resetScores ? [0, 0, 0, 0] : G.players.map(p => p.score);

  if (G.stats) G.stats.hands++;

  G.deck = Tile.shuffle(Tile.mkDeck());
  G.players = [];
  for (let i = 0; i < PLAYER_COUNT; i++) {
    let p = mkPlayer(i);
    p.score = scores[i] || 0;
    p.isD = (i === G.dealer);
    G.players.push(p);
  }
  G.curP = G.dealer;
  G.discard = []; G.baopi = null; G.bpR = false; G.ting = new Set();
  visSig = ''; visMap = null; // 新一局重置已见牌缓存
  G.over = false; G.winner = null; G.lastD = null; G.lastDB = -1;
  G.lastDraw = null; G.lastFrom = ''; G.phase = 'discard'; G.pending = [];
  G.passed = new Set(); G.lock = false; G.tingIntent = false; G.selfHu = false; G.forceTing = false;
  G.token = (G.token || 0) + 1;

  for (let r = 0; r < 13; r++) {
    for (let p = 0; p < PLAYER_COUNT; p++) G.players[p].hand.push(G.deck.pop());
  }
  G.players[G.dealer].hand.push(G.deck.pop());
  G.wall = G.deck.length;
  G.players.forEach(sortHand);

  G.players.forEach((p, i) => {
    if (i === HUMAN) return;
    if (p.hand.length === 13 && Tile.isTing(p.hand, p.melds)) addTing(i);
  });

  ui('update');
  ui('addLog', '新一局开始，庄家：' + G.players[G.dealer].name);

  if (G.ting.has(G.dealer) && Tile.canWin(G.players[G.dealer].hand, G.players[G.dealer].melds)) {
    let token = G.token;
    scheduleTask(() => { if (G.token === token && !G.over) win(G.dealer, null, true); }, AI_DELAY);
  } else if (G.dealer !== HUMAN) {
    scheduleAIDiscard(G.dealer);
  } else if (G.auto) {
    scheduleAIDiscard(G.dealer);
  }
}

function addTing(i) {
  if (G.ting.has(i)) return;
  let m = G.players[i].melds.length;
  if (m < 1 || m >= 4) return; // 门前清不能听牌；手把一(4副露)不能听牌
  G.ting.add(i);
  if (SIM_MODE && simFirstTing === null) simFirstTing = G.discard.length;
  // 仅测试用：记下每家每把首次上听的巡数（SIM_MODE 生产环境恒为 false，走不到这里）
  if (SIM_MODE && !(i in simTingSeen)) simTingSeen[i] = G.discard.length;
  ui('addLog', G.players[i].name + ' 听牌');
  revealBP();
}

function visibleCount(t) {
  let exposed = [];
  G.players.forEach(p => p.melds.forEach(m => exposed.push(...m.ts)));
  // 已被吃/碰/杠走的弃牌同时算在副露里，避免重复计数
  return G.discard.filter(x => !x.claimed && Tile.tid(x) === Tile.tid(t)).length +
    exposed.filter(x => Tile.tid(x) === Tile.tid(t)).length;
}

function revealBP() {
  if (G.bpR) return;
  for (let i = G.deck.length - 1; i >= 0; i--) {
    if (visibleCount(G.deck[i]) < 3) {
      G.baopi = G.deck[i];
      G.bpR = true;
      ui('addLog', '宝牌翻开：' + Tile.label(G.baopi));
      ui('update');
      return;
    }
  }
}

// 宝牌若已见三张则换宝
function ensureBaopi() {
  if (!G.bpR || !G.baopi) return;
  if (visibleCount(G.baopi) < 3) return;
  for (let i = G.deck.length - 1; i >= 0; i--) {
    if (visibleCount(G.deck[i]) < 3) {
      G.baopi = G.deck[i];
      ui('addLog', '宝牌已见三张，换宝为 ' + Tile.label(G.baopi));
      ui('update');
      return;
    }
  }
}

function drawWall(pI) {
  if (!G.deck.length) return null;
  let t = G.deck.pop();
  G.wall--;
  G.players[pI].hand.push(t);
  G.lastDraw = t;
  G.lastFrom = 'wall';
  return t;
}

function advanceTurn() {
  if (G.over) return;
  G.curP = (G.curP + 1) % PLAYER_COUNT;
  let pI = G.curP;
  let drawn = drawWall(pI);
  if (!drawn) { endDraw(); return; }

  G.selfHu = false;
  // 听牌后自摸到宝牌：视为可胡；是否胡由玩家决定
  let canSelfHu = false;
  if (G.ting.has(pI)) {
    if (G.bpR && G.baopi && Tile.tid(drawn) === Tile.tid(G.baopi)) canSelfHu = true;
    else if (Tile.canWin(G.players[pI].hand, G.players[pI].melds)) canSelfHu = true;
  }

  if (canSelfHu) {
    if (pI === HUMAN) {
      if (SIM_MODE || G.auto) { win(pI, null, true); return; }
      // 等玩家确认是否胡牌
      G.selfHu = true;
      G.phase = 'discard';
      G.pending = [];
      ui('update');
      return;
    }
    win(pI, null, true);
    return;
  }

  G.phase = 'discard';
  G.pending = [];
  G.tingIntent = false;
  ui('update');

  if (pI === HUMAN) {
    if (SIM_MODE) { aiDiscard(HUMAN); return; }
    if (G.auto) { scheduleAIDiscard(HUMAN); return; }
    if (G.ting.has(pI)) {
      G.lock = true;
      let token = G.token;
      scheduleTask(() => {
        if (G.token !== token || G.over) { G.lock = false; return; }
        humanAutoDiscard();
      }, AI_DELAY);
    }
  } else {
    scheduleAIDiscard(pI);
  }
}

function humanAutoDiscard() {
  G.lock = false;
  if (G.over || G.phase !== 'discard' || G.curP !== HUMAN) return;
  let p = G.players[HUMAN];
  if (!p.hand.length) return;
  doDiscard(HUMAN, p.hand.length - 1);
}

export function handleDiscard(idx) {
  if (!G.playing || G.over || G.lock || G.selfHu || G.auto || G.phase !== 'discard' || G.curP !== HUMAN) return;
  // 点了听牌（或上听吃）后只能打出听牌张，防止错误操作
  if (G.forceTing || G.tingIntent) {
    let p = G.players[HUMAN];
    if (!isTingDiscard(p.hand, p.melds, p.hand[idx])) return;
  }
  doDiscard(HUMAN, idx);
}

function doDiscard(pI, idx) {
  if (G.over) return;
  let p = G.players[pI];
  let t = p.hand[idx];
  if (!t) return;
  // 本地规则：打出后不断幺九（手牌加副露须保留幺九）才能上听，人类与 AI 一致
  let tingOk = isTingDiscard(p.hand, p.melds, t);

  p.hand.splice(idx, 1);
  sortHand(p);
  p.disc.push(t);
  G.discard.push(t);
  G.lastD = t;
  G.lastDB = pI;
  G.lastDraw = null; // 打出后新摸标记清除
  ui('addLog', p.name + ' 打出 ' + Tile.label(t));
  ensureBaopi();

  let wasTing = G.ting.has(pI);
  if (pI === HUMAN && !SIM_MODE && !G.auto) {
    // 人类：点了「听牌」或上听吃强制听牌，且打出的确实是合法听牌张，才生效
    if ((G.tingIntent || G.forceTing) && tingOk) {
      addTing(pI);
      if (!wasTing && G.ting.has(pI)) t.tingDiscard = true;
    }
  } else if (tingOk) {
    addTing(pI);
    // 仅“首次听牌”打出的这张标注，之后维持听牌的弃牌用正常颜色
    if (!wasTing && G.ting.has(pI)) t.tingDiscard = true;
  }
  G.tingIntent = false; G.forceTing = false;

  G.passed = new Set();
  let hasClaim = false;
  for (let i = 0; i < PLAYER_COUNT; i++) {
    if (i === pI) continue;
    if (claimActions(i).length > 0) { hasClaim = true; break; }
  }

  if (hasClaim) {
    G.phase = 'claim';
    let token = G.token;
    scheduleTask(() => { if (G.token === token && !G.over) resolveClaims(); }, CLAIM_DELAY);
  } else {
    advanceTurn();
  }
}

function canPeng(pI) {
  return G.players[pI].hand.filter(t => Tile.tid(t) === Tile.tid(G.lastD)).length >= 2;
}
function canKong(pI) {
  return G.players[pI].hand.filter(t => Tile.tid(t) === Tile.tid(G.lastD)).length >= 3;
}
function chiOpts(pI, t) {
  if (t.type === 'zhong') return [];
  let h = G.players[pI].hand, o = [];
  let has = n => h.some(x => x.type === t.type && x.num === n);
  if (t.num >= 2 && t.num <= 8 && has(t.num - 1) && has(t.num + 1)) o.push([t.num - 1, t.num, t.num + 1]);
  if (t.num >= 3 && has(t.num - 2) && has(t.num - 1)) o.push([t.num - 2, t.num - 1, t.num]);
  if (t.num <= 7 && has(t.num + 1) && has(t.num + 2)) o.push([t.num, t.num + 1, t.num + 2]);
  return o;
}

export function claimActions(pI) {
  let t = G.lastD;
  if (!t || G.lastDB === pI) return [];
  let p = G.players[pI];
  let acts = [];
  if (G.ting.has(pI) && Tile.canWin([...p.hand, t], p.melds)) acts.push({ a: 'hu', l: '和' });
  // 听牌后不能再吃碰杠；已有 3 副露时再鸣牌即成手把一（无法听牌），禁止吃碰杠
  if (p.melds.length < 3 && !G.ting.has(pI)) {
    let isUpper = G.lastDB === (pI + PLAYER_COUNT - 1) % PLAYER_COUNT;
    chiOpts(pI, t).sort((a, b) => a[0] - b[0]).forEach(opt => {
      let leads = chiLeadsToTing(pI, t, opt);
      if (isUpper) {
        // 吃上家为正常吃牌，是否听牌由玩家决定；但吃完能听时按「上听」优先于碰杠
        acts.push({ a: 'chi', l: '吃 ' + opt.join('-') + t.suit + (leads ? '·听' : ''), d: opt, ting: leads });
      } else if (leads) {
        // 上听吃：非上家也能吃，吃完强制听牌
        acts.push({ a: 'chi', l: '吃 ' + opt.join('-') + t.suit + '·听', d: opt, ting: true });
      }
    });
    if (canPeng(pI)) {
      // 碰后也能通过打一张进入听牌时标注，便于玩家在吃/碰之间选择
      let leads = pengLeadsToTing(pI, t);
      acts.push({ a: 'peng', l: '碰' + (leads ? '·听' : ''), ting: leads });
    }
    if (canKong(pI)) acts.push({ a: 'kong', l: '杠' });
  }
  return acts;
}

// 吃完后能否通过打一张进入听牌
function chiLeadsToTing(pI, t, opt) {
  let p = G.players[pI];
  let used = [], ok = true;
  opt.forEach(n => {
    if (n !== t.num) {
      let found = p.hand.find(x => x.type === t.type && x.num === n && !used.includes(x));
      if (found) used.push(found); else ok = false;
    }
  });
  if (!ok || used.length !== 2) return false;
  let newHand = p.hand.filter(x => !used.includes(x));
  let newMelds = [...p.melds, { type: 'chi', ts: [...used, t], claimedId: Tile.tid(t) }];
  return handTingDiscards(newHand, newMelds).length > 0;
}

// 碰后能否通过打一张进入听牌
function pengLeadsToTing(pI, t) {
  let p = G.players[pI];
  let used = p.hand.filter(x => Tile.tid(x) === Tile.tid(t)).slice(0, 2);
  if (used.length !== 2) return false;
  let newHand = p.hand.filter(x => !used.includes(x));
  let newMelds = [...p.melds, { type: 'peng', ts: [...used, t], claimedId: Tile.tid(t) }];
  return handTingDiscards(newHand, newMelds).length > 0;
}

// 给定手牌与副露，返回能听牌的弃张（打出后不断幺九即可，幺九可在副露里）
function handTingDiscards(hand, melds) {
  let need = 4 - melds.length;
  if (need < 0 || hand.length !== need * 3 + 2) return [];
  if (melds.length < 1 || melds.length >= 4) return [];
  let res = [], seen = new Set();
  for (let i = 0; i < hand.length; i++) {
    let t = hand[i];
    if (seen.has(Tile.tid(t))) continue;
    seen.add(Tile.tid(t));
    let rest = hand.filter((_, j) => j !== i);
    if (Tile.isTing(rest, melds)) res.push(t);
  }
  return res;
}

// 这张牌打出后能否进入听牌（含本地限制：打出后须不断幺九、须有副露等）
export function isTingDiscard(hand, melds, tile) {
  if (!tile) return false;
  return handTingDiscards(hand, melds).some(t => Tile.tid(t) === Tile.tid(tile));
}

// 打哪张牌可以听牌（出牌前可选）
export function tingDiscards(pI) {
  let p = G.players[pI];
  return handTingDiscards(p.hand, p.melds);
}

// 抓牌上听方案：14 张时打出哪张可听牌、听哪些牌（回答“差的是哪张”）
export function tingPlans(pI) {
  let p = G.players[pI];
  let plans = [];
  for (let d of handTingDiscards(p.hand, p.melds)) {
    let i = p.hand.findIndex(x => Tile.tid(x) === Tile.tid(d));
    let rest = p.hand.filter((_, j) => j !== i);
    plans.push({ discard: d, wins: Tile.winTiles(rest, p.melds) });
  }
  return plans;
}

// 还差一张（抓牌）：13 张时摸到哪些牌可上听；见光无剩余的牌会排除
export function drawsForTing(pI) {
  return handDrawsForTing(G.players[pI].hand, G.players[pI].melds);
}

function handDrawsForTing(hand, melds) {
  melds = melds || [];
  let need = 4 - melds.length;
  if (need < 0 || hand.length !== need * 3 + 1) return [];
  if (melds.length < 1 || melds.length >= 4) return [];
  if (Tile.isTing(hand, melds)) return [];
  let counts = {};
  hand.forEach(t => { counts[Tile.tid(t)] = (counts[Tile.tid(t)] || 0) + 1; });
  let res = [];
  let tryTile = (cand) => {
    if ((counts[Tile.tid(cand)] || 0) + visibleCount(cand) >= 4) return;
    if (handTingDiscards([...hand, cand], melds).length > 0) res.push(cand);
  };
  Tile.TT.forEach(type => {
    for (let n = 1; n <= 9; n++) tryTile({ type, num: n, suit: Tile.SN[type], id: n + type });
  });
  tryTile({ type: 'zhong', num: 0, suit: '红中', id: '红中' });
  return res;
}

// 距上听还有几张（本地规则近似）：0=已可听/打一张即听，1=差一张，n=更远
// “差一张”由 drawsForTing/tingPlans 精确判定；此函数用于更远时给出张数
export function localTingDistance(pI) {
  let p = G.players[pI];
  if (!p || G.ting.has(pI)) return 0;
  let d = handTingDistance(p.hand, p.melds);
  // 吃/碰别家的牌后能打一张听牌，同样只差一张
  let need = 4 - p.melds.length;
  if (d > 1 && p.hand.length === need * 3 + 1 && claimTingTiles(pI).length) d = 1;
  return d;
}

function handTingDistance(hand, melds) {
  melds = melds || [];
  let need = 4 - melds.length;
  if (need < 0) return 8;
  if (hand.length === need * 3 + 2) {
    if (handTingDiscards(hand, melds).length) return 0;
    let best = 8, seen = new Set();
    for (let i = 0; i < hand.length; i++) {
      let t = hand[i];
      if (seen.has(Tile.tid(t))) continue;
      seen.add(Tile.tid(t));
      best = Math.min(best, handTingDistance(hand.filter((_, j) => j !== i), melds));
    }
    return best;
  }
  if (hand.length !== need * 3 + 1) return 8;
  if (Tile.isTing(hand, melds)) return 0;
  if (handDrawsForTing(hand, melds).length) return 1;
  // 更远：直接用非标向听（已含缺幺九/缺刻子/缺顺子/单花色约束与死搭扣除）
  return Math.max(Tile.effectiveShanten(hand, melds, liveRemainFn(hand)), 2);
}

// 吃/碰别家可上听的牌：碰（手中有 2 张）或吃（顺子缺一张）后能打一张听牌
// 见光无剩余的牌会排除；杠不在此列
export function claimTingTiles(pI) {
  let p = G.players[pI];
  if (!p || G.ting.has(pI) || p.melds.length >= 3) return [];
  let counts = {};
  p.hand.forEach(t => { counts[Tile.tid(t)] = (counts[Tile.tid(t)] || 0) + 1; });
  let res = [];
  let push = (cand, ok) => {
    if (!ok) return;
    if ((counts[Tile.tid(cand)] || 0) + visibleCount(cand) >= 4) return;
    if (!res.some(t => Tile.tid(t) === Tile.tid(cand))) res.push(cand);
  };
  let hasNum = (type, n) => p.hand.some(x => x.type === type && x.num === n);
  Tile.TT.forEach(type => {
    for (let n = 1; n <= 9; n++) {
      let cand = { type, num: n, suit: Tile.SN[type], id: n + type };
      if ((counts[cand.id] || 0) >= 2) push(cand, pengLeadsToTing(pI, cand));
      if (n >= 2 && n <= 8 && hasNum(type, n - 1) && hasNum(type, n + 1))
        push(cand, chiLeadsToTing(pI, cand, [n - 1, n, n + 1]));
      if (n >= 3 && hasNum(type, n - 2) && hasNum(type, n - 1))
        push(cand, chiLeadsToTing(pI, cand, [n - 2, n - 1, n]));
      if (n <= 7 && hasNum(type, n + 1) && hasNum(type, n + 2))
        push(cand, chiLeadsToTing(pI, cand, [n, n + 1, n + 2]));
    }
  });
  let zt = { type: 'zhong', num: 0, suit: '红中', id: '红中' };
  if ((counts[zt.id] || 0) >= 2) push(zt, pengLeadsToTing(pI, zt));
  res.sort((a, b) => {
    let ta = a.type === 'zhong' ? 99 : Tile.TT.indexOf(a.type);
    let tb = b.type === 'zhong' ? 99 : Tile.TT.indexOf(b.type);
    return ta - tb || a.num - b.num;
  });
  return res;
}

// 右侧长显：还差一张上听（吃/碰 与 手抓，重复只归吃/碰；都不满足则 null）
export function tingWatch(pI) {
  let p = G.players[pI];
  if (!p || G.ting.has(pI)) return null;
  let claim = claimTingTiles(pI);
  let inClaim = new Set(claim.map(Tile.tid));
  let draws = drawsForTing(pI).filter(t => !inClaim.has(Tile.tid(t)));
  if (!claim.length && !draws.length) return null;
  return { claim, draws };
}

// 出牌前是否可以宣告听牌
export function canStartTing(pI) {
  if (G.over || G.ting.has(pI) || G.tingIntent) return false;
  if (G.phase !== 'discard' || G.curP !== pI || G.lock) return false;
  return tingDiscards(pI).length > 0;
}

// 打完后（13 张）已经成听，可立即宣告；仅限本人出牌或本人弃张结算中，防止非本人回合非法听牌
export function canDeclareNow(pI) {
  if (G.over || G.ting.has(pI)) return false;
  if (G.curP !== pI || G.lock) return false;
  if (G.phase !== 'discard' && G.phase !== 'claim') return false;
  let p = G.players[pI];
  if (p.melds.length < 1 || p.melds.length >= 4) return false; // 门前清 / 手把一 不能听牌
  let need = 4 - p.melds.length;
  if (need < 0 || p.hand.length !== need * 3 + 1) return false;
  return Tile.isTing(p.hand, p.melds);
}

// 进入听牌：13 张已听立即生效；14 张则进入选择状态
export function startTing(pI) {
  if (canDeclareNow(pI)) { addTing(pI); ui('update'); return; }
  if (!canStartTing(pI)) return;
  G.tingIntent = true;
  ui('update');
}

// 已听牌时，当前手牌能胡的牌
export function tingTiles(pI) {
  let p = G.players[pI];
  let need = 4 - p.melds.length;
  if (need < 0 || p.hand.length !== need * 3 + 1) return [];
  return Tile.winTiles(p.hand, p.melds);
}

function countMax(hand) {
  let c = {};
  hand.forEach(t => { c[Tile.tid(t)] = (c[Tile.tid(t)] || 0) + 1; });
  return Math.max(0, ...Object.values(c));
}

function hasConsecutive(hand) {
  for (let i = 0; i < hand.length; i++) {
    for (let j = 0; j < hand.length; j++) {
      for (let k = 0; k < hand.length; k++) {
        if (i === j || j === k || i === k) continue;
        let a = hand[i], b = hand[j], c = hand[k];
        if (a.type === 'zhong' || a.type !== b.type || b.type !== c.type) continue;
        let n = [a.num, b.num, c.num].sort((x, y) => x - y);
        if (n[1] === n[0] + 1 && n[2] === n[1] + 1) return true;
      }
    }
  }
  return false;
}

// 和牌条件提示：全部按本地规则计算（标准向听数不计幺九/刻子/花色限制，会误报，不用）
export function handHints(pI) {
  let p = G.players[pI];
  let all = [...p.hand];
  p.melds.forEach(m => all.push(...m.ts));

  let suits = new Set();
  all.forEach(t => { if (t.type !== 'zhong') suits.add(t.type); });

  // 已听 / 14 张抓牌上听 / 13 张已听未宣告 / 13 张差一摸，互斥且按序取
  let plans = [], wins = [], draws = [];
  if (!G.ting.has(pI)) {
    plans = tingPlans(pI);
    if (!plans.length) {
      wins = tingTiles(pI);
      if (!wins.length) draws = drawsForTing(pI);
    }
  }

  return {
    yao: all.some(Tile.isYao),
    tri: p.melds.some(m => m.type === 'peng' || m.type === 'kong') || countMax(p.hand) >= 3,
    seq: p.melds.some(m => m.type === 'chi') || hasConsecutive(p.hand),
    pair: countMax(p.hand) >= 2,
    closed: p.melds.length === 0,
    color: suits.size >= 2,
    plans, wins, draws
  };
}

export function selfActions(pI) {
  if (G.phase !== 'discard' || G.curP !== pI || G.over || G.ting.has(pI)) return [];
  let p = G.players[pI];
  if (p.melds.length >= 4) return [];
  let acts = [];
  let counts = {};
  p.hand.forEach(t => { counts[Tile.tid(t)] = (counts[Tile.tid(t)] || 0) + 1; });
  // 暗杠会新增一副露：已有 3 副露时禁止（防手把一）；补杠不增副露，允许
  if (p.melds.length < 3 && Object.values(counts).some(c => c >= 4)) acts.push({ a: 'selfKong', l: '暗杠' });
  p.melds.forEach(m => {
    if (m.type === 'peng' && p.hand.some(t => Tile.tid(t) === Tile.tid(m.ts[0]))) {
      acts.push({ a: 'buKong', l: '补杠 ' + Tile.label(m.ts[0]), d: m.ts[0] });
    }
  });
  return acts;
}

// ===== 鸣牌裁决 =====
// 优先级：胡 > 上听（吃听/碰听）> 杠/碰 > 吃；同级按打牌者下家顺序
export function claimPriority(act) {
  if (act.a === 'hu') return 4;
  if (act.ting) return 3;
  if (act.a === 'peng' || act.a === 'kong') return 2;
  return 1;
}

// 从多个玩家的鸣牌中选出优先级最高者，同级取牌序靠前者
export function pickClaim(claims, lastDB) {
  if (!claims.length) return null;
  let maxP = Math.max(...claims.map(c => Math.max(...c.acts.map(claimPriority))));
  let top = claims.filter(c => Math.max(...c.acts.map(claimPriority)) === maxP);
  top.sort((a, b) =>
    ((a.i - lastDB + PLAYER_COUNT) % PLAYER_COUNT) - ((b.i - lastDB + PLAYER_COUNT) % PLAYER_COUNT));
  return top[0];
}

function resolveClaims() {
  if (G.over) return;
  let claims = [];
  for (let i = 0; i < PLAYER_COUNT; i++) {
    if (i === G.lastDB || G.passed.has(i)) continue;
    let acts = claimActions(i);
    if (acts.length) claims.push({ i, acts });
  }
  if (!claims.length) { G.phase = 'discard'; advanceTurn(); return; }

  let chosen = pickClaim(claims, G.lastDB);

  if (chosen.i === HUMAN) {
    if (SIM_MODE || G.auto) {
      let act = aiChooseClaim(HUMAN, chosen.acts);
      if (act) executeClaim(HUMAN, act);
      else { G.passed.add(HUMAN); resolveClaims(); }
      return;
    }
    G.phase = 'claim';
    G.pending = [HUMAN];
    ui('update');
    return;
  }

  let act = aiChooseClaim(chosen.i, chosen.acts);
  if (act) {
    let token = G.token;
    scheduleTask(() => { if (G.token === token && !G.over) executeClaim(chosen.i, act); }, CLAIM_DELAY);
  } else {
    G.passed.add(chosen.i);
    resolveClaims();
  }
}

function executeClaim(pI, act) {
  let p = G.players[pI], t = G.lastD;
  G.phase = 'discard';
  G.pending = [];
  G.curP = pI;
  G.ting.delete(pI);

  if (act.a === 'hu') { win(pI, G.lastDB, false); return; }

  // 标记这张牌被吃/碰/杠走
  if (t) t.claimed = act.a;

  if (act.a === 'peng') {
    let used = takeFromHand(p, t, 2);
    p.melds.push({ type: 'peng', ts: [...used, t], claimedId: Tile.tid(t) });
    sortHand(p);
    ui('addLog', p.name + ' 碰 ' + Tile.label(t));
  } else if (act.a === 'kong') {
    let used = takeFromHand(p, t, 3);
    p.melds.push({ type: 'kong', ts: [...used, t], claimedId: Tile.tid(t) });
    sortHand(p);
    ui('addLog', p.name + ' 杠 ' + Tile.label(t));
    let drawn = drawWall(pI);
    if (!drawn) { endDraw(); return; }
    if (G.ting.has(pI) && Tile.canWin(p.hand, p.melds)) { win(pI, null, true); return; }
  } else if (act.a === 'chi') {
    // 吃上家为正常吃牌，是否听牌由玩家决定；吃另外两家为上听吃，必须听牌
    let isUpper = G.lastDB === (pI + PLAYER_COUNT - 1) % PLAYER_COUNT;
    let used = [];
    act.d.forEach(n => {
      if (n !== t.num) {
        let i = p.hand.findIndex(x => x.type === t.type && x.num === n);
        if (i >= 0) used.push(p.hand.splice(i, 1)[0]);
      }
    });
    p.melds.push({ type: 'chi', ts: [...used, t], claimedId: Tile.tid(t) });
    sortHand(p);
    ui('addLog', p.name + ' 吃 ' + Tile.label(t));
    // 上听吃（吃另外两家）：吃完若能听牌则强制听牌
    let opts = isUpper ? [] : handTingDiscards(p.hand, p.melds);
    if (opts.length) {
      if (pI === HUMAN && !SIM_MODE && !G.auto) {
        // 人类玩家：只设标记让用户自己选择打出哪张
        G.forceTing = true;
        G.curP = pI;
        ui('update');
        return;
      }
      // AI：自动打出最优听牌张
      let best = opts[0], bestCount = -1, seen = new Set();
      for (let tt of opts) {
        if (seen.has(Tile.tid(tt))) continue;
        seen.add(Tile.tid(tt));
        let rest = p.hand.filter(x => x !== tt);
        let cnt = Tile.winTiles(rest, p.melds).length;
        if (cnt > bestCount) { bestCount = cnt; best = tt; }
      }
      G.forceTing = true;
      G.curP = pI;
      doDiscard(pI, p.hand.indexOf(best));
      return;
    }
  }

  ensureBaopi();
  ui('update');
  if (pI !== HUMAN) scheduleAIDiscard(pI);
  else if (SIM_MODE || G.auto) scheduleAIDiscard(HUMAN);
}

function selfAct(pIdx, a, d) {
  let p = G.players[pIdx];
  if (a === 'selfKong') {
    let counts = {};
    p.hand.forEach(t => { counts[Tile.tid(t)] = (counts[Tile.tid(t)] || 0) + 1; });
    let id = Object.keys(counts).find(k => counts[k] >= 4);
    if (!id) return false;
    let tile = p.hand.find(t => Tile.tid(t) === id);
    let used = takeFromHand(p, tile, 4);
    p.melds.push({ type: 'kong', ts: used });
    ui('addLog', p.name + ' 暗杠');
  } else if (a === 'buKong') {
    let m = p.melds.find(m => m.type === 'peng' && Tile.tid(m.ts[0]) === Tile.tid(d));
    if (!m) return false;
    let used = takeFromHand(p, d, 1);
    m.type = 'kong';
    m.ts.push(used[0]);
    ui('addLog', p.name + ' 补杠 ' + Tile.label(d));
  } else {
    return false;
  }
  sortHand(p);
  G.ting.delete(pIdx);
  let drawn = drawWall(pIdx);
  if (!drawn) { endDraw(); return true; }
  if (G.ting.has(pIdx) && Tile.canWin(p.hand, p.melds)) { win(pIdx, null, true); return true; }
  ui('update');
  return true;
}

// ===== AI =====
function connectedness(hand) {
  let s = 0;
  for (let i = 0; i < hand.length; i++) {
    for (let j = 0; j < hand.length; j++) {
      if (i === j) continue;
      let a = hand[i], b = hand[j];
      if (a.type === 'zhong' || b.type === 'zhong') continue;
      if (a.type === b.type && Math.abs(a.num - b.num) <= 2) s++;
    }
  }
  return s;
}

// ===== AI 公开信息评估 =====
// 已见牌（弃牌 + 开门副露）缓存：AI 评估高频调用，按牌局签名复用
let visSig = '';
let visMap = null;
function boardVisible() {
  let meldTotal = 0;
  G.players.forEach(p => { meldTotal += p.melds.length; });
  let sig = G.discard.length + ':' + meldTotal;
  if (sig === visSig && visMap) return visMap;
  let v = {};
  G.players.forEach(p => p.melds.forEach(m => m.ts.forEach(t => { v[Tile.tid(t)] = (v[Tile.tid(t)] || 0) + 1; })));
  G.discard.forEach(t => { if (!t.claimed) v[Tile.tid(t)] = (v[Tile.tid(t)] || 0) + 1; });
  visSig = sig;
  visMap = v;
  return v;
}

// 剩余可用张数：4 - 弃牌/副露已见 - 自己手牌（对手手牌不可见）
function remainingCount(tile, hand) {
  let own = hand ? hand.filter(t => Tile.tid(t) === Tile.tid(tile)).length : 0;
  return Math.max(0, 4 - (boardVisible()[Tile.tid(tile)] || 0) - own);
}

// 给 effectiveShanten 用的剩余数闭包：预计算自己手牌计数，避免 DFS 里反复遍历
function liveRemainFn(hand) {
  let own = {};
  hand.forEach(t => { own[Tile.tid(t)] = (own[Tile.tid(t)] || 0) + 1; });
  let vis = boardVisible();
  return (t) => Math.max(0, 4 - (vis[Tile.tid(t)] || 0) - (own[Tile.tid(t)] || 0));
}

// 有效进张：摸到后非标距离下降的牌张数（含剩余枚数）
function localEval(hand, melds) {
  let need = 4 - melds.length;
  if (need < 0 || hand.length !== need * 3 + 1) return { dist: 8, uke: 0 };
  if (Tile.isTing(hand, melds)) return { dist: 0, uke: 0 };
  let base = Tile.effectiveShanten(hand, melds, liveRemainFn(hand));
  let uke = 0;
  let tryTile = (cand) => {
    let rem = remainingCount(cand, hand);
    if (rem <= 0) return;
    let after = [...hand, cand];
    if (Tile.effectiveShanten(after, melds, liveRemainFn(after)) < base) uke += rem;
  };
  Tile.TT.forEach(type => {
    for (let n = 1; n <= 9; n++) tryTile({ type, num: n, suit: Tile.SN[type], id: n + type });
  });
  tryTile({ type: 'zhong', num: 0, suit: '红中', id: '红中' });
  if (uke > 0) return { dist: Math.max(base, 1), uke };
  return { dist: Math.max(base, 2), uke: 0 };
}

// ===== 高级：评估缓存 / 危险模型 / 2-ply 搜索 =====
const HAND_CACHE = new Map();
const HAND_CACHE_MAX = 6000;

function handKey(hand, melds) {
  let h = hand.map(t => Tile.tid(t)).sort().join(',');
  let m = melds.map(x => x.type + ':' + x.ts.map(Tile.tid).sort().join(',')).sort().join('|');
  return h + '#' + m;
}

// 本地评估（带缓存）：dist=本地向听距离，uke=进张数（听牌时为听口剩余枚数），wins=听口种类
function evalHand(hand, melds) {
  let key = handKey(hand, melds);
  let c = HAND_CACHE.get(key);
  if (c) return c;
  let res = computeEvalHand(hand, melds);
  if (HAND_CACHE.size >= HAND_CACHE_MAX) HAND_CACHE.clear();
  HAND_CACHE.set(key, res);
  return res;
}

function computeEvalHand(hand, melds) {
  let need = 4 - melds.length;
  if (need < 0 || hand.length !== need * 3 + 1) return { dist: 8, uke: 0, wins: 0 };
  // 用近似的 localEval 快速评估（2-ply 内层搜索量很大，不在此做精确 drawsForTing）
  let le = localEval(hand, melds);
  if (le.dist === 0) {
    let wins = Tile.winTiles(hand, melds).length;
    return { dist: 0, uke: 0, wins };
  }
  return { dist: le.dist, uke: le.uke, wins: 0 };
}

// 单张手牌质量（越大越好）
function evalQuality(e) {
  return -e.dist * 1000 + e.uke * 8 + e.wins * 200;
}

// 14 张手的“最优弃张后”评估
function bestDiscardEval(hand, melds) {
  let need = 4 - melds.length;
  if (hand.length !== need * 3 + 2) return { dist: 8, uke: 0, wins: 0 };
  let best = null, bestScore = -Infinity, seen = new Set();
  for (let i = 0; i < hand.length; i++) {
    let id = Tile.tid(hand[i]);
    if (seen.has(id)) continue;
    seen.add(id);
    let rest = hand.filter((_, j) => j !== i);
    let e = evalHand(rest, melds);
    let sc = evalQuality(e);
    if (sc > bestScore) { bestScore = sc; best = e; }
  }
  return best || { dist: 8, uke: 0, wins: 0 };
}

// 对手听牌威胁 0~1（本变体须有副露才能听，副露数是强信号）
function threatOf(i) {
  let p = G.players[i];
  if (G.ting.has(i)) return 1;
  let t = p.melds.length * 0.45;
  if (p.isD) t += 0.1;
  return Math.min(0.9, t);
}

// 某张牌对三家对手的综合危险度 0~1
function dangerOf(pI, tile) {
  let id = Tile.tid(tile);
  let vis = visibleCount(tile);
  if (vis >= 4) return 0; // 四张全见，不可能再被和
  let d = 0;
  for (let i = 0; i < PLAYER_COUNT; i++) {
    if (i === pI) continue;
    let th = threatOf(i);
    if (th <= 0) continue;
    let p = G.players[i];
    // 本变体无振听：对手打过的牌仍可能被其和（概率略低），不能当绝对安全牌
    let discarded = p.disc.some(t => Tile.tid(t) === id);
    let nearMeld = p.melds.some(m => m.ts.some(t => t.type === tile.type && tile.type !== 'zhong' && Math.abs(t.num - tile.num) <= 1));
    let base = vis >= 3 ? 0.2 : 0.5; // 只剩最后一张时风险很低但非零
    let risk = (base + (nearMeld ? 0.35 : 0)) * (discarded ? 0.4 : 1);
    d += th * Math.min(1, risk);
  }
  return Math.min(1, d / 3);
}

// 攻防切换：默认进攻；仅当离听远、已过中盘且领先时才转守
function hardAttackMode(pI, dist) {
  if (dist <= 2) return true;
  if (G.discard.length < 24) return true;
  let p = G.players[pI];
  let maxOther = Math.max(...G.players.filter((_, i) => i !== pI).map(x => x.score));
  return p.score <= maxOther;
}

// 2-ply：下一摸的期望手牌质量（按进张枚数加权，带超时；melds 缺省用场上副露，杠后评估传杠后副露）
function nextDrawEV(pI, hand13, deadline, melds) {
  melds = melds || G.players[pI].melds;
  let need = 4 - melds.length;
  if (hand13.length !== need * 3 + 1) return evalQuality(evalHand(hand13, melds));
  let baseSh = Tile.effectiveShanten(hand13, melds, liveRemainFn(hand13));
  let cands = [];
  let push = (t) => {
    let rem = remainingCount(t, hand13);
    if (rem <= 0) return;
    let after = [...hand13, t];
    if (Tile.effectiveShanten(after, melds, liveRemainFn(after)) >= baseSh) return; // 只展开能降向听的进张
    cands.push({ t, rem });
  };
  Tile.TT.forEach(type => {
    for (let n = 1; n <= 9; n++) push({ type, num: n, suit: Tile.SN[type], id: n + type });
  });
  push({ type: 'zhong', num: 0, suit: '红中', id: '红中' });
  let sum = 0, wsum = 0;
  for (let c of cands) {
    if (performance.now() > deadline) break;
    let e = bestDiscardEval([...hand13, c.t], melds);
    sum += c.rem * evalQuality(e);
    wsum += c.rem;
  }
  return wsum ? sum / wsum : evalQuality(evalHand(hand13, melds));
}

// 高级：2-ply 出牌
function hardDiscardIndex(pI) {
  let p = G.players[pI];
  let deadline = performance.now() + 40;
  // 能听：听牌那一轮的弃张算「听牌点炮」，比黑炮少 1 番，可趁机把手里的危险牌丢出去
  let tingTiles = handTingDiscards(p.hand, p.melds);
  if (tingTiles.length) {
    let best = tingTiles[0], bestScore = -Infinity, seen = new Set();
    for (let t of tingTiles) {
      if (seen.has(Tile.tid(t))) continue;
      seen.add(Tile.tid(t));
      let i = p.hand.findIndex(x => Tile.tid(x) === Tile.tid(t));
      let rest = p.hand.filter((_, j) => j !== i);
      let wins = Tile.winTiles(rest, p.melds);
      let rem = wins.reduce((s, w) => s + remainingCount(w, rest), 0);
      let score = rem * 10 + wins.length + dangerOf(pI, t) * 30;
      if (score > bestScore) { bestScore = score; best = t; }
    }
    return p.hand.findIndex(x => Tile.tid(x) === Tile.tid(best));
  }
  // 候选 1-ply 粗排
  let cands = [], seen = new Set();
  for (let i = 0; i < p.hand.length; i++) {
    let id = Tile.tid(p.hand[i]);
    if (seen.has(id)) continue;
    seen.add(id);
    let rest = p.hand.filter((_, j) => j !== i);
    cands.push({ i, rest, e: evalHand(rest, p.melds) });
  }
  cands.sort((a, b) => (a.e.dist - b.e.dist) || (b.e.uke - a.e.uke));
  // 自己未听且已有人听牌：此时点炮是黑炮（独付、+2 番），宁可拆牌也不放
  // 三档：无人上听偏激进（safeW 0.1+候选放宽），有人上听偏保守（safeW 4），听牌的是庄家更保守（safeW 8，点庄赢家黑炮独付 8 分）
  let oppTing = false, dealerTing = false;
  G.ting.forEach(i => { if (i !== pI) { oppTing = true; if (G.players[i].isD) dealerTing = true; } });
  let attack = hardAttackMode(pI, cands[0].e.dist);
  let safeW = attack ? 0.1 : 1.3;
  if (oppTing) safeW = Math.max(safeW, 4);
  if (dealerTing) safeW = Math.max(safeW, 8);
  let top = cands.slice(0, oppTing ? cands.length : 8);
  let best = p.hand[top[0].i], bestScore = -Infinity;
  for (let c of top) {
    let t = p.hand[c.i];
    let score = evalQuality(c.e)
      - dangerOf(pI, t) * safeW * 500;
    if (c.e.dist <= 2 && performance.now() < deadline) {
      score += nextDrawEV(pI, c.rest, deadline) * 0.6;
    }
    if (score > bestScore) { bestScore = score; best = t; }
  }
  return p.hand.findIndex(x => Tile.tid(x) === Tile.tid(best));
}

// 高级：2-ply 鸣牌评估
function hardClaimOutcome(pI, act) {
  let res = simulateClaim(pI, act);
  if (!res) return null;
  let need = 4 - res.melds.length;
  if (res.hand.length !== need * 3 + 2) return null;
  return bestDiscardEval(res.hand, res.melds);
}

function evalClaim(pI, act, cur) {
  if (act.a === 'kong') {
    // 明杠也看前后距离：补摸期望质量 - 当前质量；孤张杠/抢摸为正，拆顺刻的坏杠为负
    let res = simulateClaim(pI, act);
    if (!res) return -Infinity;
    return nextDrawEV(pI, res.hand, performance.now() + 40, res.melds) - evalQuality(cur);
  }
  let out = hardClaimOutcome(pI, act);
  if (!out) return -Infinity;
  let q = evalQuality(out) - evalQuality(cur);
  if (act.ting) return 100000 + q; // 能听就要；多个可听按 q 排序取最优
  if (out.dist >= cur.dist) return -Infinity; // 距离没拉近就是白耗一手，不开门
  return q;
}

// 安全度 0~1：现物 + 已见张数。
// 本变体无筋/壁/振听/抢杠概念，故不实现对应标准理论
// ponytail: 安全模型为启发式，若实测点炮率偏高再引入对手听口推断
function tileSafety(pI, tile) {
  let id = Tile.tid(tile);
  let rivers = 0;
  G.players.forEach((p, i) => { if (i !== pI && p.disc.some(t => Tile.tid(t) === id)) rivers++; });
  let safe = rivers > 0 ? 0.6 + 0.15 * rivers : 0.2;
  if (visibleCount(tile) >= 3) safe = 1;
  return Math.max(0, Math.min(1, safe));
}

// 对手威胁：副露数 + 已听牌 + 庄家
function opponentThreat(pI) {
  let threat = 0;
  G.players.forEach((p, i) => {
    if (i === pI) return;
    threat += p.melds.length * 0.6;
    if (G.ting.has(i)) threat += 2;
    if (p.isD) threat += 0.4;
  });
  return threat;
}


// 中级：先保听牌，再比有效进张，保留搭子，轻度避炮
function normalDiscardIndex(pI) {
  let p = G.players[pI];
  let cfg = AI_LEVELS.normal;
  let tingTiles = handTingDiscards(p.hand, p.melds);
  if (tingTiles.length) {
    let best = tingTiles[0], bestWins = -1;
    tingTiles.forEach(t => {
      let i = p.hand.findIndex(x => Tile.tid(x) === Tile.tid(t));
      let wins = Tile.winTiles(p.hand.filter((_, j) => j !== i), p.melds).length;
      if (wins > bestWins) { bestWins = wins; best = t; }
    });
    return p.hand.findIndex(x => Tile.tid(x) === Tile.tid(best));
  }
  let threat = opponentThreat(pI);
  let safeW = cfg.defenseWeight * (threat >= 2 ? 2 : 1);
  let seen = new Set(), best = p.hand[0], bestScore = -Infinity;
  for (let i = 0; i < p.hand.length; i++) {
    let t = p.hand[i], id = Tile.tid(t);
    if (seen.has(id)) continue;
    seen.add(id);
    let rest = p.hand.filter((_, j) => j !== i);
    let le = localEval(rest, p.melds);
    let zhong = t.type === 'zhong' ? 1 : 0;
    let score = le.uke * 10 - le.dist * 1000
      + connectedness(rest)
      + tileSafety(pI, t) * safeW * 20
      - zhong * 3
      + (Math.random() - 0.5) * cfg.randomness * 20;
    if (score > bestScore) { bestScore = score; best = t; }
  }
  return p.hand.indexOf(best);
}

// 初级：现行一步贪心（听口优先 + 连通度）加随机扰动
function easyDiscardIndex(pI) {
  let p = G.players[pI];
  let seen = new Set(), best = p.hand[0], bestScore = -Infinity;
  for (let i = 0; i < p.hand.length; i++) {
    let id = Tile.tid(p.hand[i]);
    if (seen.has(id)) continue;
    seen.add(id);
    let rest = p.hand.filter((_, j) => j !== i);
    let score = Tile.winTiles(rest, p.melds).length * 1000
      + connectedness(rest)
      + (Math.random() - 0.5) * 400;
    if (score > bestScore) { bestScore = score; best = p.hand[i]; }
  }
  return p.hand.indexOf(best);
}

function aiDiscard(pI) {
  if (G.over || G.phase !== 'discard' || G.curP !== pI) return;
  let p = G.players[pI];
  if (!p.hand.length) return;
  if (G.ting.has(pI)) { doDiscard(pI, p.hand.length - 1); return; } // 听牌后摸啥打啥，避免拆听
  let lvl = getAILevel(pI);
  let idx;
  if (lvl === 'easy') idx = easyDiscardIndex(pI);
  else if (lvl === 'hard') idx = hardDiscardIndex(pI);
  else idx = normalDiscardIndex(pI);
  doDiscard(pI, idx);
}

// ===== AI 鸣牌 =====
// 模拟鸣牌后的手牌/副露（仅用于评估，不直接改状态）
function simulateClaim(pI, act) {
  let p = G.players[pI], t = G.lastD;
  if (!t) return null;
  if (act.a === 'peng' || act.a === 'kong') {
    let want = act.a === 'kong' ? 3 : 2;
    let used = p.hand.filter(x => Tile.tid(x) === Tile.tid(t)).slice(0, want);
    if (used.length < want) return null;
    return { hand: p.hand.filter(x => !used.includes(x)), melds: [...p.melds, { type: act.a, ts: [...used, t], claimedId: Tile.tid(t) }] };
  }
  if (act.a === 'chi') {
    let used = [];
    act.d.forEach(n => {
      if (n === t.num) return;
      let found = p.hand.find(x => x.type === t.type && x.num === n && !used.includes(x));
      if (found) used.push(found);
    });
    if (used.length !== 2) return null;
    return { hand: p.hand.filter(x => !used.includes(x)), melds: [...p.melds, { type: 'chi', ts: [...used, t], claimedId: Tile.tid(t) }] };
  }
  return null;
}

// 鸣牌后按本地规则选最优弃张，返回弃张后的向听距离/听口/有效进张
function claimOutcome(pI, act) {
  let res = simulateClaim(pI, act);
  if (!res) return null;
  let need = 4 - res.melds.length;
  if (res.hand.length !== need * 3 + 2) return null;
  let seen = new Set(), best = null, bestScore = -Infinity;
  for (let i = 0; i < res.hand.length; i++) {
    let id = Tile.tid(res.hand[i]);
    if (seen.has(id)) continue;
    seen.add(id);
    let rest = res.hand.filter((_, j) => j !== i);
    let le = localEval(rest, res.melds);
    let wins = Tile.winTiles(rest, res.melds).length;
    let score = -le.dist * 1000 + wins * 100;
    if (score > bestScore) { bestScore = score; best = { dist: le.dist, wins, uke: le.uke }; }
  }
  return best;
}

function bestTingAct(pI, acts) {
  let best = acts[0], bestScore = -Infinity;
  acts.forEach(a => {
    let out = claimOutcome(pI, a);
    let s = out ? -out.dist * 1000 + out.wins * 100 : 0;
    if (s > bestScore) { bestScore = s; best = a; }
  });
  return best;
}

function aiChooseClaimEasy(pI, acts) {
  let hu = acts.find(a => a.a === 'hu');
  if (hu) return hu;
  if (G.ting.has(pI)) return null;
  let kong = acts.find(a => a.a === 'kong');
  if (kong) return kong; // 有杠必杠
  let peng = acts.find(a => a.a === 'peng');
  if (peng && Math.random() < AI_LEVELS.easy.claimPengRate) return peng;
  let chis = acts.filter(a => a.a === 'chi');
  if (chis.length && Math.random() < AI_LEVELS.easy.claimChiRate) return chis[Math.floor(Math.random() * chis.length)];
  return null;
}

function aiChooseClaimNormal(pI, acts) {
  let hu = acts.find(a => a.a === 'hu');
  if (hu) return hu;
  if (G.ting.has(pI)) return null;
  let ting = acts.filter(a => a.ting);
  if (ting.length) return bestTingAct(pI, ting);
  let kong = acts.find(a => a.a === 'kong');
  if (kong) return kong;
  let peng = acts.find(a => a.a === 'peng');
  if (peng && Math.random() < AI_LEVELS.normal.claimPengRate) return peng;
  let chis = acts.filter(a => a.a === 'chi');
  if (chis.length) {
    let base = handTingDistance(G.players[pI].hand, G.players[pI].melds);
    let gain = chis.find(a => { let o = claimOutcome(pI, a); return o && o.dist <= base; });
    if (gain && Math.random() < AI_LEVELS.normal.claimChiRate) return gain;
  }
  return null;
}

function aiChooseClaimHard(pI, acts) {
  let hu = acts.find(a => a.a === 'hu');
  if (hu) return hu;
  if (G.ting.has(pI)) return null;
  let p = G.players[pI];
  let cur = evalHand(p.hand, p.melds);
  let scored = acts.map(a => ({ a, s: evalClaim(pI, a, cur) }));
  scored.sort((x, y) => y.s - x.s);
  // 只在正收益（或能上听，evalClaim 已加 100000）时鸣牌：不急于开门、不空耗吃碰
  if (scored.length && scored[0].s > 0) return scored[0].a;
  return null;
}

function aiChooseClaim(pI, acts) {
  let lvl = getAILevel(pI);
  if (lvl === 'easy') return aiChooseClaimEasy(pI, acts);
  if (lvl === 'hard') return aiChooseClaimHard(pI, acts);
  return aiChooseClaimNormal(pI, acts);
}

// ===== AI 自身杠 =====
function simulateSelfKong(p, act) {
  if (act.a === 'selfKong') {
    let counts = {};
    p.hand.forEach(t => { counts[Tile.tid(t)] = (counts[Tile.tid(t)] || 0) + 1; });
    let id = Object.keys(counts).find(k => counts[k] >= 4);
    if (!id) return null;
    let used = [], hand = [];
    p.hand.forEach(t => { if (Tile.tid(t) === id && used.length < 4) used.push(t); else hand.push(t); });
    return { hand, melds: [...p.melds, { type: 'kong', ts: used }] };
  }
  if (act.a === 'buKong') {
    let m = p.melds.find(mm => mm.type === 'peng' && Tile.tid(mm.ts[0]) === Tile.tid(act.d));
    if (!m) return null;
    let hand = [], removed = false;
    p.hand.forEach(t => { if (!removed && Tile.tid(t) === Tile.tid(act.d)) removed = true; else hand.push(t); });
    if (!removed) return null;
    let melds = p.melds.map(mm => mm === m ? { ...mm, type: 'kong', ts: [...mm.ts, act.d] } : mm);
    return { hand, melds };
  }
  return null;
}

function evalSelfKong(pI, act) {
  let p = G.players[pI];
  let res = simulateSelfKong(p, act);
  if (!res) return -1;
  // 自杠同样看前后距离：补摸期望质量 - 当前最优打后质量
  let cur = evalQuality(bestDiscardEval(p.hand, p.melds));
  return nextDrawEV(pI, res.hand, performance.now() + 40, res.melds) - cur;
}

function aiTurn(pI) {
  if (G.over || G.phase !== 'discard' || G.curP !== pI) return;
  let selfActs = selfActions(pI);
  if (selfActs.length) {
    let lvl = getAILevel(pI);
    let act = selfActs[0], doIt = false;
    if (lvl === 'easy') doIt = Math.random() < 0.5;
    else if (lvl === 'hard') {
      let best = selfActs.reduce((a, b) => evalSelfKong(pI, b) > evalSelfKong(pI, a) ? b : a, selfActs[0]);
      if (evalSelfKong(pI, best) > 0) { act = best; doIt = true; }
    } else if (evalSelfKong(pI, act) >= 0) {
      doIt = true;
    }
    if (doIt && selfAct(pI, act.a, act.d)) {
      if (G.over || G.phase !== 'discard' || G.curP !== pI) return;
    }
  }
  aiDiscard(pI);
}

// ===== AI 调度 =====
function scheduleTask(fn, delay) {
  if (SIM_MODE) { simQueue.push(fn); return; }
  setTimeout(fn, delay);
}

function scheduleAIDiscard(pI, delay = AI_DELAY) {
  G.lock = true;
  let token = G.token;
  scheduleTask(() => {
    G.lock = false;
    if (G.token !== token || G.over) return;
    if (G.phase !== 'discard' || G.curP !== pI) return;
    aiTurn(pI);
  }, delay);
}

// ===== 无头模拟（仅测试用）=====
// 同步驱动整局（含 HUMAN 也交给 AI）。level 可为字符串（四家同档）
// 或长度为 4 的数组（按座位分别指定，用于“模块对战”）
export function simulateRound(level) {
  let prevLevel = G.aiLevel;
  let prevLevels = G.aiLevels;
  SIM_MODE = true;
  simQueue = [];
  simFirstTing = null;
  if (Array.isArray(level)) {
    G.aiLevels = level.slice(0, PLAYER_COUNT);
  } else {
    G.aiLevels = null;
    G.aiLevel = AI_LEVELS[level] ? level : 'normal';
  }
  try {
    G.dealer = Math.floor(Math.random() * PLAYER_COUNT); // 随机庄家，消除座位先手优势
    G.playing = true;
    G.stats = freshStats();
    startRound(true);
    let guard = 0;
    while (!G.over && guard++ < 50000) {
      if (!simQueue.length) {
        // 无排队任务时，若轮到自己出牌则直接驱动（主要覆盖 HUMAN 庄家/回合）
        if (!G.lock && G.phase === 'discard' && G.players.length) aiTurn(G.curP);
        else break;
      }
      if (simQueue.length) {
        let task = simQueue.shift();
        try { task(); } catch (e) { /* 单步异常不阻塞模拟 */ }
      }
    }
    return { over: G.over, winner: G.winner, firstTing: simFirstTing, discards: G.discard.length };
  } finally {
    SIM_MODE = false;
    simQueue = [];
    G.aiLevel = prevLevel;
    G.aiLevels = prevLevels;
  }
}

// ===== 整桌模拟（仅测试用）：首把随机庄家清零开打，带分连打到 rotations>=circles =====
// levels 为长度 4 的数组（按座位指定难度）；转庄/连庄/流局规则与 continueGame/endDraw 一致，改了那边要同步改这里
// 返回单桌 {rank, wins, hands, score, hard, dealIn, tingSum, tingN}（rank=1+严格更高分人数，并列取最好名次）
export function simulateTable(levels, circles) {
  circles = Math.max(1, circles || 4);
  let hard = levels.indexOf('hard');
  if (hard < 0) hard = 0;
  let prevLevel = G.aiLevel;
  let prevLevels = G.aiLevels;
  SIM_MODE = true;
  simQueue = [];
  try {
    G.aiLevels = levels.slice(0, PLAYER_COUNT);
    G.dealer = Math.floor(Math.random() * PLAYER_COUNT);
    G.playing = true;
    G.stats = freshStats();
    let wins = 0;
    let tingSum = [0, 0, 0, 0], tingN = [0, 0, 0, 0];
    let handGuard = 0;
    let maxHands = circles * 24 + 50; // 连庄拖局安全帽
    startRound(true);
    while (G.stats.rotations < circles && handGuard++ < maxHands) {
      simFirstTing = null;
      simTingSeen = {};
      driveHand();
      if (G.winner === hard) wins++;
      for (let i = 0; i < PLAYER_COUNT; i++) {
        if (simTingSeen[i] !== undefined) { tingSum[i] += simTingSeen[i]; tingN[i]++; }
      }
      if (G.stats.rotations >= circles) break;
      // 把间转庄（同 continueGame）：非庄和牌才转庄，回到 0 位记一圈；庄和/流局不转
      if (G.winner !== null && G.winner !== undefined && G.winner !== G.dealer) {
        G.dealer = (G.dealer + 1) % PLAYER_COUNT;
        if (G.dealer === 0) G.stats.rotations++;
      }
      startRound(false);
    }
    let scores = G.players.map(p => p.score);
    let rank = 1 + scores.filter(s => s > scores[hard]).length;
    let dealIn = G.stats.per.map(p => (p.dianhei || 0)); // 点炮率只计点黑炮，听牌点炮（dianpao）不计
    return { rank, wins, hands: G.stats.hands, score: scores[hard], hard, dealIn, tingSum, tingN };
  } finally {
    SIM_MODE = false;
    simQueue = [];
    G.aiLevel = prevLevel;
    G.aiLevels = prevLevels;
  }
}

function driveHand() {
  let guard = 0;
  while (!G.over && guard++ < 50000) {
    if (!simQueue.length) {
      if (!G.lock && G.phase === 'discard' && G.players.length) aiTurn(G.curP);
      else break;
    }
    if (simQueue.length) {
      let task = simQueue.shift();
      try { task(); } catch (e) { /* 单步异常不阻塞模拟 */ }
    }
  }
}

// ===== 玩家操作 =====
export function handleAB(pIdx, a, d) {
  if (!G.playing || G.over) return;
  // 自摸确认：胡 或 过（过则打出刚摸的牌）
  if (G.selfHu && pIdx === HUMAN) {
    if (a === 'hu') { G.selfHu = false; win(HUMAN, null, true); return; }
    if (a === 'pass') { G.selfHu = false; humanAutoDiscard(); return; }
    return;
  }
  if (a === 'ting') { startTing(pIdx); return; }
  if (G.phase === 'claim' && G.pending.includes(pIdx)) humanClaim(pIdx, a, d);
  else if (G.phase === 'discard' && pIdx === G.curP && pIdx === HUMAN) selfAct(pIdx, a, d);
}

function humanClaim(pIdx, a, d) {
  if (a === 'pass') {
    G.pending = [];
    G.passed.add(pIdx);
    resolveClaims();
    return;
  }
  executeClaim(pIdx, { a, d });
}

// ===== 结算 =====
function win(pI, discarder, isZimo) {
  if (G.over) return;
  G.over = true;
  G.winner = pI;

  let p = G.players[pI];
  let isDealer = p.isD;
  let winTile = isZimo ? G.lastDraw : G.lastD;
  let isBaopi = !!(isZimo && G.bpR && G.baopi && winTile && Tile.tid(winTile) === Tile.tid(G.baopi));
  // 点炮方是否已听牌：听牌点炮三家共付，未听牌点炮为「黑炮」由放炮者独付
  let discarderIsTing = !isZimo && discarder >= 0 && G.ting.has(discarder);
  let heipao = !isZimo && !discarderIsTing;

  let fan = Score.calcFan({ isDealer, isZimo, isBaopi, heipao });
  let sc = Score.calcScore({ fan, isZimo, discarderIsTing, discarder, winner: pI, dealer: G.dealer });
  sc.deltas.forEach((d, i) => { G.players[i].score += d; });

  let title = isZimo ? (isDealer ? '庄家自摸' : '自摸') : (isDealer ? '庄家和牌' : '和牌');
  let base = Math.pow(2, fan);
  // 庄家作为付款方时翻倍
  let dealerPays = isZimo ? (pI !== G.dealer)
    : (!discarderIsTing ? (discarder === G.dealer) : (pI !== G.dealer));
  let detail = '番数 ' + fan + ' · 基础 ' + base + ' 分' + (dealerPays ? ' · 庄家 ' + base * 2 + ' 分' : '');
  if (isDealer) detail += ' · 庄家';
  if (isZimo) detail += ' · 自摸';
  if (isBaopi) detail += ' · 宝牌';
  if (heipao) detail += ' · 黑炮';
  else if (!isZimo) detail += ' · 听牌点炮';

  // 每人计番文本：和牌者为本人番型；付款的庄家多一番；未参与付款的不计
  let baseParts = [];
  if (isDealer) baseParts.push('庄家 1番');
  if (isZimo) baseParts.push('自摸 1番');
  if (isBaopi) baseParts.push('宝牌 1番');
  if (heipao) baseParts.push('黑炮 2番');
  let breakdown = G.players.map((pl, i) => {
    let parts = [...baseParts];
    if (i !== pI && sc.deltas[i] < 0 && i === G.dealer) parts.push('庄家 1番');
    let fan = i !== pI && sc.deltas[i] < 0 && parts.length ? parts.join('·') : '—';
    return { name: pl.name, me: i === HUMAN, isD: pl.isD, delta: sc.deltas[i], total: pl.score, fan };
  });

  if (G.stats && G.stats.per) {
    let s = normPer(G.stats.per[pI]);
    G.stats.per[pI] = s;
    if (isZimo) s.zimo++;
    else {
      s.ron++;
      if (heipao) { s.heipao++; if (discarder >= 0) { let ds = normPer(G.stats.per[discarder]); G.stats.per[discarder] = ds; ds.dianhei++; } }
      else s.dianpao++;
    }
    if (isBaopi) s.baopi++;
  }

  ui('addLog', p.name + ' ' + title + '！' + detail + '，得分 +' + sc.gain);
  ui('update');
  ui('effect', isBaopi ? 'baopi' : 'win');
  ui('showWinBanner', { name: p.name, title, isZimo, isBaopi, hand: p.hand, melds: p.melds, winTile });
  ui('showModal', title, p.name + title + '了', '本局得分 +' + sc.gain, detail, '继续', () => continueGame(pI), breakdown);
}

function continueGame(winnerIdx) {
  if (winnerIdx !== G.dealer) {
    G.dealer = (G.dealer + 1) % PLAYER_COUNT;
    if (G.dealer === 0 && G.stats) G.stats.rotations++;
  }
  startRound(false);
}

function endDraw() {
  G.over = true;
  if (G.stats) G.stats.draw++;
  ui('addLog', '流局，无人和牌');
  ui('update');
  let breakdown = G.players.map((pl, i) => ({ name: pl.name, me: i === HUMAN, isD: pl.isD, delta: 0, total: pl.score, fan: '—' }));
  ui('showModal', '流局', '牌墙摸完，无人和牌', '本局不扣分', '', '继续', () => startRound(false), breakdown);
}
