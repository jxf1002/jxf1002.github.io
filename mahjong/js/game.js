import { PN, PLAYER_COUNT, HUMAN } from './constants.js';
import * as Tile from './tile.js';
import * as Score from './score.js';

const AI_DELAY = 700;
const CLAIM_DELAY = 500;

export let G = {
  deck: [], players: [], curP: 0, dealer: 0,
  discard: [], wall: 0,
  baopi: null, bpR: false,
  ting: new Set(), over: false, winner: null,
  lastD: null, lastDB: -1, lastDraw: null, lastFrom: '',
  phase: 'discard', pending: [], passed: new Set(),
  lock: false, token: 0, tingIntent: false, selfHu: false, forceTing: false,
  playing: false,
  stats: null
};

function freshStats() {
  return {
    hands: 0, rotations: 0, draw: 0,
    per: [0, 1, 2, 3].map(() => ({ zimo: 0, ron: 0, heipao: 0, baopi: 0 }))
  };
}

let uiCB = null;
export function setUI(cb) { uiCB = cb; }
function ui(fn, ...args) {
  if (uiCB && uiCB[fn]) uiCB[fn](...args);
  if (fn === 'update') saveState();
}

// ===== 存档：页面被自动刷新（如 Live Server）后可恢复 =====
const SAVE_KEY = 'mahjong_save_v1';

function saveState() {
  try {
    if (G.over || !G.players.length) { sessionStorage.removeItem(SAVE_KEY); return; }
    sessionStorage.setItem(SAVE_KEY, JSON.stringify({
      deck: G.deck, players: G.players, curP: G.curP, dealer: G.dealer,
      discard: G.discard, wall: G.wall, baopi: G.baopi, bpR: G.bpR,
      ting: [...G.ting], winner: G.winner, lastD: G.lastD, lastDB: G.lastDB,
      lastDraw: G.lastDraw, lastFrom: G.lastFrom, phase: G.phase,
      pending: G.pending, passed: [...G.passed], tingIntent: G.tingIntent, selfHu: G.selfHu,
      token: G.token, playing: G.playing, stats: G.stats, forceTing: G.forceTing
    }));
  } catch (e) { /* 忽略存储异常 */ }
}

export function restore() {
  try {
    let raw = sessionStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    let d = JSON.parse(raw);
    if (!d.players || !d.players.length) return false;
    G.deck = d.deck; G.players = d.players; G.curP = d.curP; G.dealer = d.dealer;
    G.discard = d.discard; G.wall = d.wall; G.baopi = d.baopi; G.bpR = d.bpR;
    G.ting = new Set(d.ting); G.winner = d.winner; G.lastD = d.lastD; G.lastDB = d.lastDB;
    G.lastDraw = d.lastDraw; G.lastFrom = d.lastFrom; G.phase = d.phase;
    G.pending = d.pending || []; G.passed = new Set(d.passed || []);
    G.tingIntent = !!d.tingIntent; G.selfHu = !!d.selfHu; G.forceTing = !!d.forceTing; G.token = (d.token || 0) + 1;
    G.lock = false; G.over = false;
    G.playing = !!d.playing; G.stats = d.stats || freshStats();
    ui('update');
    resume();
    return true;
  } catch (e) { return false; }
}

function resume() {
  if (G.over) return;
  if (G.selfHu) return; // 等待玩家确认自摸
  if (G.phase === 'claim') {
    if (G.pending.includes(HUMAN)) return;
    let token = G.token;
    setTimeout(() => { if (G.token === token && !G.over) resolveClaims(); }, CLAIM_DELAY);
  } else if (G.phase === 'discard') {
    if (G.curP === HUMAN) {
      if (G.forceTing) {
        // 上听吃状态恢复，让用户选择出牌
        ui('update');
      } else if (G.ting.has(HUMAN)) {
        G.lock = true;
        let token = G.token;
        setTimeout(() => {
          if (G.token !== token || G.over) { G.lock = false; return; }
          humanAutoDiscard();
        }, AI_DELAY);
      }
    } else {
      scheduleAIDiscard(G.curP);
    }
  }
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
  G.dealer = 0;
  G.playing = true;
  G.stats = freshStats();
  startRound(true);
}

// 结束整局，返回统计并弹出结算
export function endGame() {
  if (!G.playing) return;
  G.playing = false;
  G.over = true;      // 冻结牌局
  G.lock = true;
  G.token = (G.token || 0) + 1; // 作废所有待执行的定时器
  let s = G.stats || freshStats();
  let tot = { zimo: 0, ron: 0, heipao: 0, baopi: 0 };
  (s.per || []).forEach(p => { tot.zimo += p.zimo; tot.ron += p.ron; tot.heipao += p.heipao; tot.baopi += p.baopi; });
  let summary = {
    hands: s.hands, rotations: s.rotations, draw: s.draw,
    zimo: tot.zimo, ron: tot.ron, heipao: tot.heipao, baopi: tot.baopi,
    scores: G.players.map((p, i) => ({
      name: p.name, me: i === HUMAN, isD: p.isD, score: p.score,
      stat: (s.per && s.per[i]) || { zimo: 0, ron: 0, heipao: 0, baopi: 0 }
    }))
  };
  try { sessionStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
  ui('update');
  ui('showSummary', summary);
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
    setTimeout(() => { if (G.token === token && !G.over) win(G.dealer, null, true); }, AI_DELAY);
  } else if (G.dealer !== HUMAN) {
    scheduleAIDiscard(G.dealer);
  }
}

function addTing(i) {
  if (G.ting.has(i)) return;
  let m = G.players[i].melds.length;
  if (m < 1 || m >= 4) return; // 门前清不能听牌；手把一(4副露)不能听牌
  G.ting.add(i);
  ui('addLog', G.players[i].name + ' 听牌');
  revealBP();
}

function visibleCount(t) {
  let exposed = [];
  G.players.forEach(p => p.melds.forEach(m => exposed.push(...m.ts)));
  return G.discard.filter(x => Tile.tid(x) === Tile.tid(t)).length +
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
    if (G.ting.has(pI)) {
      G.lock = true;
      let token = G.token;
      setTimeout(() => {
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
  if (!G.playing || G.over || G.lock || G.selfHu || G.phase !== 'discard' || G.curP !== HUMAN) return;
  if (G.forceTing) {
    let p = G.players[HUMAN];
    let tile = p.hand[idx];
    let valid = handTingDiscards(p.hand, p.melds);
    if (!valid.some(t => Tile.tid(t) === Tile.tid(tile))) return;
  }
  doDiscard(HUMAN, idx);
}

function doDiscard(pI, idx) {
  if (G.over) return;
  let p = G.players[pI];
  let t = p.hand[idx];
  if (!t) return;

  p.hand.splice(idx, 1);
  sortHand(p);
  p.disc.push(t);
  G.discard.push(t);
  G.lastD = t;
  G.lastDB = pI;
  ui('addLog', p.name + ' 打出 ' + Tile.label(t));
  ensureBaopi();

  if (pI === HUMAN) {
    // 人类：点了「听牌」或上听吃强制听牌，且打出后确实听牌，才生效
    if ((G.tingIntent || G.forceTing) && Tile.isTing(p.hand, p.melds)) addTing(pI);
  } else if (G.forceTing || Tile.isTing(p.hand, p.melds)) {
    addTing(pI);
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
    setTimeout(() => { if (G.token === token && !G.over) resolveClaims(); }, CLAIM_DELAY);
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
  if (G.ting.has(pI) && Tile.canWin([...p.hand, t], p.melds)) acts.push({ a: 'hu', l: '胡' });
  // 听牌后不能再吃碰杠
  if (p.melds.length < 4 && !G.ting.has(pI)) {
    let isUpper = G.lastDB === (pI + PLAYER_COUNT - 1) % PLAYER_COUNT;
    chiOpts(pI, t).forEach(opt => {
      if (isUpper) {
        acts.push({ a: 'chi', l: '吃 ' + opt.join('-') + t.suit, d: opt });
      } else if (chiLeadsToTing(pI, t, opt)) {
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

// 给定手牌与副露，返回能听牌的弃张
function handTingDiscards(hand, melds) {
  let need = 4 - melds.length;
  if (need < 0 || hand.length !== need * 3 + 2) return [];
  if (melds.length < 1 || melds.length >= 4) return [];
  let yaoCount = hand.filter(Tile.isYao).length;
  let res = [], seen = new Set();
  for (let i = 0; i < hand.length; i++) {
    let t = hand[i];
    if (seen.has(Tile.tid(t))) continue;
    seen.add(Tile.tid(t));
    if (Tile.isYao(t) && yaoCount === 1) continue; // 禁止打出唯一幺九听牌
    let rest = hand.filter((_, j) => j !== i);
    if (Tile.isTing(rest, melds)) res.push(t);
  }
  return res;
}

// 打哪张牌可以听牌（出牌前可选）
export function tingDiscards(pI) {
  let p = G.players[pI];
  return handTingDiscards(p.hand, p.melds);
}

// 出牌前是否可以宣告听牌
export function canStartTing(pI) {
  if (G.over || G.ting.has(pI) || G.tingIntent) return false;
  if (G.phase !== 'discard' || G.curP !== pI || G.lock) return false;
  return tingDiscards(pI).length > 0;
}

// 打完后（13 张）已经成听，可立即宣告
export function canDeclareNow(pI) {
  if (G.over || G.ting.has(pI)) return false;
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

// 和牌条件提示
export function handHints(pI) {
  let p = G.players[pI];
  let all = [...p.hand];
  p.melds.forEach(m => all.push(...m.ts));

  // 离听牌的距离：14 张时取「打出一张后」的最小向听
  let need = 4 - p.melds.length;
  let dist;
  if (p.hand.length === need * 3 + 2) {
    dist = 99;
    let seen = new Set();
    for (let i = 0; i < p.hand.length; i++) {
      let t = p.hand[i];
      if (seen.has(Tile.tid(t))) continue;
      seen.add(Tile.tid(t));
      let rest = p.hand.filter((_, j) => j !== i);
      dist = Math.min(dist, Tile.shanten(rest, p.melds));
    }
  } else {
    dist = Tile.shanten(p.hand, p.melds);
  }

  return {
    yao: all.some(Tile.isYao),
    tri: p.melds.some(m => m.type === 'peng' || m.type === 'kong') || countMax(p.hand) >= 3,
    seq: p.melds.some(m => m.type === 'chi') || hasConsecutive(p.hand),
    pair: countMax(p.hand) >= 2,
    closed: p.melds.length === 0,
    shanten: dist
  };
}

export function selfActions(pI) {
  if (G.phase !== 'discard' || G.curP !== pI || G.over || G.ting.has(pI)) return [];
  let p = G.players[pI];
  let acts = [];
  let counts = {};
  p.hand.forEach(t => { counts[Tile.tid(t)] = (counts[Tile.tid(t)] || 0) + 1; });
  if (Object.values(counts).some(c => c >= 4)) acts.push({ a: 'selfKong', l: '暗杠' });
  p.melds.forEach(m => {
    if (m.type === 'peng' && p.hand.some(t => Tile.tid(t) === Tile.tid(m.ts[0]))) {
      acts.push({ a: 'buKong', l: '补杠 ' + Tile.label(m.ts[0]), d: m.ts[0] });
    }
  });
  return acts;
}

// ===== 鸣牌裁决：胡 > 碰/杠 > 吃，按打牌者下家顺序 =====
const prio = a => a === 'hu' ? 3 : (a === 'peng' || a === 'kong') ? 2 : 1;

function resolveClaims() {
  if (G.over) return;
  let claims = [];
  for (let i = 0; i < PLAYER_COUNT; i++) {
    if (i === G.lastDB || G.passed.has(i)) continue;
    let acts = claimActions(i);
    if (acts.length) claims.push({ i, acts });
  }
  if (!claims.length) { G.phase = 'discard'; advanceTurn(); return; }

  let maxP = Math.max(...claims.map(c => Math.max(...c.acts.map(a => prio(a.a)))));
  let top = claims.filter(c => Math.max(...c.acts.map(a => prio(a.a))) === maxP);
  top.sort((a, b) => ((a.i - G.lastDB + 4) % 4) - ((b.i - G.lastDB + 4) % 4));
  let chosen = top[0];

  if (chosen.i === HUMAN) {
    G.phase = 'claim';
    G.pending = [HUMAN];
    ui('update');
    return;
  }

  let act = aiChooseClaim(chosen.i, chosen.acts);
  if (act) {
    let token = G.token;
    setTimeout(() => { if (G.token === token && !G.over) executeClaim(chosen.i, act); }, CLAIM_DELAY);
  } else {
    G.passed.add(chosen.i);
    resolveClaims();
  }
}

function aiChooseClaim(pI, acts) {
  if (acts.find(a => a.a === 'hu')) return acts.find(a => a.a === 'hu');
  if (G.ting.has(pI)) return null;
  let kong = acts.find(a => a.a === 'kong');
  if (kong) return kong;
  let peng = acts.find(a => a.a === 'peng');
  if (peng && Math.random() < 0.6) return peng;
  let chis = acts.filter(a => a.a === 'chi');
  if (chis.length && Math.random() < 0.35) return chis[Math.floor(Math.random() * chis.length)];
  return null;
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
      if (pI === HUMAN) {
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

function aiDiscard(pI) {
  if (G.over || G.phase !== 'discard' || G.curP !== pI) return;
  let p = G.players[pI];
  if (!p.hand.length) return;
  let best = p.hand[0], bestScore = -Infinity;
  let seen = new Set();
  for (let i = 0; i < p.hand.length; i++) {
    let t = p.hand[i];
    if (seen.has(Tile.tid(t))) continue;
    seen.add(Tile.tid(t));
    let rest = p.hand.filter((_, j) => j !== i);
    let score = Tile.winTiles(rest, p.melds).length * 1000 + connectedness(rest);
    if (score > bestScore) { bestScore = score; best = t; }
  }
  doDiscard(pI, p.hand.indexOf(best));
}

function aiTurn(pI) {
  if (G.over || G.phase !== 'discard' || G.curP !== pI) return;
  let selfActs = selfActions(pI);
  if (selfActs.length && Math.random() < 0.5) {
    if (selfAct(pI, selfActs[0].a, selfActs[0].d)) {
      if (G.over || G.phase !== 'discard' || G.curP !== pI) return;
    }
  }
  aiDiscard(pI);
}

function scheduleAIDiscard(pI, delay = AI_DELAY) {
  G.lock = true;
  let token = G.token;
  setTimeout(() => {
    G.lock = false;
    if (G.token !== token || G.over) return;
    if (G.phase !== 'discard' || G.curP !== pI) return;
    aiTurn(pI);
  }, delay);
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

  let title = isZimo ? (isDealer ? '庄家自摸' : '自摸') : (isDealer ? '庄家胡牌' : '胡牌');
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

  let breakdown = G.players.map((pl, i) => ({ name: pl.name, me: i === HUMAN, isD: pl.isD, delta: sc.deltas[i], total: pl.score }));

  if (G.stats && G.stats.per) {
    let s = G.stats.per[pI];
    if (isZimo) s.zimo++;
    else { s.ron++; if (heipao) s.heipao++; }
    if (isBaopi) s.baopi++;
  }

  ui('addLog', p.name + ' ' + title + '！' + detail + '，得分 +' + sc.gain);
  ui('update');
  ui('effect', isBaopi ? 'baopi' : 'win');
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
  ui('addLog', '流局，无人胡牌');
  ui('update');
  let breakdown = G.players.map((pl, i) => ({ name: pl.name, me: i === HUMAN, isD: pl.isD, delta: 0, total: pl.score }));
  ui('showModal', '流局', '牌墙摸完，无人胡牌', '本局不扣分', '', '继续', () => startRound(false), breakdown);
}
