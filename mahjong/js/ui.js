import * as Game from './game.js';
import * as Tile from './tile.js';
import { HUMAN } from './constants.js';

const G = Game.G;
const EL = id => document.getElementById(id);

// 和牌数据暂存：showWinBanner 紧挨着 showModal 调用，结算卡合并渲染一次消费
let lastWin = null;
// 托管时结算自动继续的倒计时
let modalTimer = null;
function clearModalTimer() {
  if (modalTimer) { clearInterval(modalTimer); modalTimer = null; }
}

// 南北互换：左=北(3)、右=南(1)，出牌下→右→上→左即逆时针
const NAMES = ['nb', 'nr', 'nt', 'nl'];
const RESULTS = ['rb', 'rr', 'rt', 'rl'];
const HANDS = ['hb', 'hr', 'ht', 'hl'];
const MELDS = ['mb', 'mr', 'mt', 'ml'];
const ACTIONS = ['ab2', 'ar', 'at', 'al'];
const PANELS = ['pb', 'pr', 'pt', 'pl'];
const DISCS = ['dcb', 'dcr', 'dct', 'dcl'];

// 牌面对应 svg/ 下的图片：1m=一万 1p=一筒 1s=一条 1z~4z=东南西北 7z=红中
function svgName(t) {
  if (t.type === 'zhong') return '7z';
  let suit = t.type === 'wan' ? 'm' : t.type === 'tong' ? 'p' : 's';
  return t.num + suit;
}

function updateWallDisplay() {
  let el = EL('wd');
  let c = Math.min(G.wall, 24);
  if (el.dataset.wsig === String(c)) return;
  el.dataset.wsig = String(c);
  el.innerHTML = '';
  for (let i = 0; i < c; i++) {
    let t = document.createElement('div');
    t.className = 'wt';
    el.appendChild(t);
  }
}

function tileEl(t, opts = {}) {
  let e = document.createElement('div');
  e.className = 'tile'
    + (opts.clickable ? ' clickable' : '')
    + (opts.folded ? ' folded' : '')
    + (opts.tingTarget ? ' ting-target' : '')
    + (opts.isNew ? ' new' : '')
    + (opts.claimed ? ' claimed' : '');
  e.title = Tile.label(t);
  if (opts.folded) {
    e.innerHTML = '';
  } else {
    e.innerHTML = `<img class="face-img" src="svg/${svgName(t)}.svg" alt="${Tile.label(t)}" draggable="false">`;
  }
  if (opts.onClick) e.onclick = opts.onClick;
  return e;
}

function meldTiles(m) {
  if (!m.claimedId || (m.type !== 'chi' && m.type !== 'peng')) return m.ts;
  let claimed = m.ts.find(t => Tile.tid(t) === m.claimedId);
  if (!claimed) return m.ts;
  let others = m.ts.filter(t => t !== claimed);
  others.sort((a, b) => a.num - b.num);
  return [others[0], claimed, others[1]];
}

// 副露渲染：吃碰三张正放、被吃碰张居中染黄；杠底3+顶1叠中牌，暗杠底3扣着
function meldGroup(m) {
  let group = document.createElement('div');
  group.className = 'meld';
  if (m.type === 'kong' && m.ts.length === 4) {
    group.classList.add('kong-meld');
    let anGang = !m.claimedId;
    let row = document.createElement('div');
    row.className = 'kong-row';
    // 底3：暗杠扣着，明杠正面（不着色）；顶张：明杠才染黄
    m.ts.slice(0, 3).forEach(t => {
      row.appendChild(anGang ? tileEl(t, { folded: true }) : tileEl(t));
    });
    let top = document.createElement('div');
    top.className = 'kong-top';
    let topTile = tileEl(m.ts[3]);
    topTile.classList.add('top');
    if (!anGang) topTile.classList.add('claimed');
    top.appendChild(topTile);
    group.appendChild(row);
    group.appendChild(top);
    return group;
  }
  // 吃碰：只有中间那张染黄
  meldTiles(m).forEach((t, idx) => {
    group.appendChild(tileEl(t, { claimed: idx === 1 && !!m.claimedId }));
  });
  return group;
}

// 大厅空白桌：只留座位框（名+分），不渲染任何牌
function renderLobbyTable() {
  for (let i = 0; i < 4; i++) {
    let p = G.players[i];
    let nameEl = EL(NAMES[i]);
    let head = nameEl.parentNode;
    head.querySelectorAll('.dealer-die,.head-score').forEach(e => e.remove());
    nameEl.textContent = p ? p.name + (i === HUMAN ? '(我)' : '') : ['东', '南', '西', '北'][i];
    EL(RESULTS[i]).innerHTML = '';
    EL(MELDS[i]).innerHTML = '';
    EL(HANDS[i]).innerHTML = '';
    EL(DISCS[i]).innerHTML = '';
    EL(PANELS[i]).classList.remove('active', 'ting');
    EL(PANELS[i]).dataset.hsig = '';
    EL(DISCS[i]).dataset.dsig = '';
    if (p) {
      let sc = document.createElement('span');
      sc.className = 'head-score';
      sc.textContent = p.score;
      head.insertBefore(sc, EL(RESULTS[i]));
    }
  }
  EL('wd').innerHTML = '';
  EL('wd').dataset.wsig = '';
  let c = EL('wall-count');
  if (c) c.textContent = '';
  renderReminder();
}

function renderHands() {
  if (!G.players.length) return;
  for (let i = 0; i < 4; i++) {
    let p = G.players[i];
    let panel = EL(PANELS[i]);
    let canDiscard = !G.over && G.playing && !G.lock && !G.auto && i === HUMAN && G.curP === HUMAN && G.phase === 'discard';
    let tingSet = null, tingPlanMap = null;
    if (i === HUMAN && (G.tingIntent || G.forceTing)) {
      // 点了听牌（或上听吃）后只能打出听牌张，其余牌不可点
      tingSet = new Set(Game.tingDiscards(HUMAN).map(t => Tile.tid(t)));
      tingPlanMap = {};
      Game.tingPlans(HUMAN).forEach(pl => { tingPlanMap[Tile.tid(pl.discard)] = pl.wins; });
    }
    // 新摸的牌：仅自己抓牌时标右下角，手牌最右同 id 的一张，红三角标
    let newIdx = -1;
    if (i === HUMAN && G.lastDraw && G.lastFrom === 'wall' && G.curP === HUMAN) {
      for (let k = p.hand.length - 1; k >= 0; k--) {
        if (Tile.tid(p.hand[k]) === Tile.tid(G.lastDraw)) { newIdx = k; break; }
      }
    }
    let active = !G.over && G.playing && i === G.curP;
    let ting = !G.over && G.ting.has(i);
    // 状态签名：只有变化时才重建该座位的 DOM（避免每次出牌整桌重刷）
    let meldSig = p.melds.map(m => m.type + ':' + (m.claimedId || '') + ':' + m.ts.map(t => t.id).join(',')).join(';');
    let handSig = (i === HUMAN || G.over) ? p.hand.map(t => t.id).join(',') : String(p.hand.length);
    let sig = [p.name, p.score, p.isD && !G.over ? 1 : 0, active ? 1 : 0, ting ? 1 : 0, meldSig, handSig,
      canDiscard ? 1 : 0, newIdx, tingSet ? [...tingSet].sort().join(',') : ''].join('#');
    if (panel.dataset.hsig === sig) continue;
    panel.dataset.hsig = sig;

    let nameEl = EL(NAMES[i]);
    let head = nameEl.parentNode;
    nameEl.textContent = p.name + (i === HUMAN ? '(我)' : '');
    panel.classList.toggle('active', active);
    panel.classList.toggle('ting', ting);

    // 姓名板：🎲(静态) 玩家名 当前积分
    head.querySelectorAll('.dealer-die,.head-score').forEach(e => e.remove());
    if (p.isD && !G.over) {
      let die = document.createElement('span');
      die.className = 'dealer-die';
      die.textContent = '🎲';
      die.title = '庄家';
      head.insertBefore(die, nameEl);
    }
    let sc = document.createElement('span');
    sc.className = 'head-score';
    sc.textContent = p.score;
    sc.style.color = p.score > 0 ? '#5fd39a' : p.score < 0 ? '#ff7b6b' : '#fff';
    head.insertBefore(sc, EL(RESULTS[i]));

    let res = '';
    if (G.ting.has(i)) res += '<span class="ti">听牌</span>';
    EL(RESULTS[i]).innerHTML = res;

    let meldEl = EL(MELDS[i]);
    meldEl.innerHTML = '';
    p.melds.forEach(m => meldEl.appendChild(meldGroup(m)));

    let handEl = EL(HANDS[i]);
    handEl.innerHTML = '';

    if (i === HUMAN || G.over) {
      // 东家（下方）按连续花色分组，折行时整组一起折
      let suitGroup = null, suitType = null;
      p.hand.forEach((t, idx) => {
        let isClickable = canDiscard;
        if (tingSet) {
          isClickable = canDiscard && tingSet.has(Tile.tid(t));
        }
        let isTingTile = !!(tingSet && tingSet.has(Tile.tid(t)));
        let node = tileEl(t, {
          clickable: isClickable,
          tingTarget: isTingTile,
          isNew: idx === newIdx
        });
        if (isClickable) {
          let wins = (isTingTile && tingPlanMap) ? (tingPlanMap[Tile.tid(t)] || []) : null;
          node.onclick = () => (wins && wins.length ? onTingTile(idx, node, wins) : Game.handleDiscard(idx));
        }
        if (isTingTile && tingPlanMap && !isCoarse()) {
          node.onmouseenter = () => showTingPop(node, tingPlanMap[Tile.tid(t)] || []);
          node.onmouseleave = hideTingPop;
        }
        if (i === HUMAN) {
          if (!suitGroup || suitType !== t.type) {
            suitGroup = document.createElement('div');
            suitGroup.className = 'hand-suit';
            handEl.appendChild(suitGroup);
            suitType = t.type;
          }
          suitGroup.appendChild(node);
        } else {
          handEl.appendChild(node);
        }
      });
      // 预留摸牌位：13 张（3n+1）时留一张空位，避免摸第 14 张时折行跳动
      if (i === HUMAN && !G.over && p.hand.length % 3 === 1) {
        let sp = document.createElement('div');
        sp.className = 'tile hand-spacer';
        sp.setAttribute('aria-hidden', 'true');
        handEl.appendChild(sp);
      }
    } else {
      p.hand.forEach(t => handEl.appendChild(tileEl(t, { folded: true })));
    }
  }
}

function renderDiscards() {
  for (let i = 0; i < 4; i++) {
    let el = EL(DISCS[i]);
    if (!G.players.length) {
      if (el.dataset.dsig !== '') { el.innerHTML = ''; el.dataset.dsig = ''; }
      continue;
    }
    let disc = G.players[i].disc;
    // 只有牌堆变化（新增/被吃碰）时才重建该家的牌河
    // 新摸牌后上一张弃牌不再可响应，取消「最新出牌」高亮
    let lastIdx = (i === G.lastDB && !G.lastDraw) ? disc.length - 1 : -1;
    let sig = disc.map((t, idx) => t.id + (t.claimed ? 'c' : '') + (t.tingDiscard ? 'T' : '') + (idx === lastIdx ? 'L' : '')).join(',');
    if (el.dataset.dsig === sig) continue;
    el.dataset.dsig = sig;
    el.innerHTML = '';
    disc.forEach((t, idx) => {
      let e = tileEl(t);
      if (idx === lastIdx && !t.claimed) e.classList.add('latest');
      if (t.claimed) e.classList.add('claimed');
      if (t.tingDiscard) e.classList.add('ting-discard');
      el.appendChild(e);
    });
  }
}

function canSeeBaopi() {
  return !!G.playing && !!(G.bpR && G.baopi && (G.ting.has(HUMAN) || G.over));
}

function renderDora() {
  let el = EL('dora-banner');
  if (!el) return;
  let show = canSeeBaopi();
  el.classList.toggle('show', show);
  let key = show ? 's' + Tile.tid(G.baopi) : 'h';
  if (el.dataset.doraSig === key) return;
  el.dataset.doraSig = key;
  if (!show) { el.innerHTML = ''; return; }
  el.innerHTML = `<span class="dora-label">宝牌</span><span class="dora-tile"><img class="face-img" src="svg/${svgName(G.baopi)}.svg" alt="${Tile.label(G.baopi)}" draggable="false"></span>`;
}

export function renderAILevel() {
  let cur = Game.getAILevel();
  document.querySelectorAll('.diff-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.level === cur);
  });
}

function updateStartButton() {
  renderAILevel();
  let b = EL('btn-s');
  if (b) b.classList.toggle('hide', !G.playing);
  let autoBtn = EL('auto-btn');
  if (autoBtn) {
    autoBtn.classList.toggle('hide', !G.playing);
    autoBtn.classList.toggle('active', !!G.auto);
    autoBtn.textContent = G.auto ? '托管中' : '托管';
  }
  let lobby = EL('lobby');
  if (!lobby) return;
  lobby.classList.toggle('hide', !!G.playing);
  if (!G.playing) {
    let has = G.players.length > 0 || Game.hasSave();
    EL('btn-continue').classList.toggle('hide', !has);
    EL('btn-stats').classList.toggle('hide', !G.players.length);
    let sub = EL('lobby-sub');
    if (sub) {
      sub.textContent = G.players.length
        ? G.players.map(p => `${p.name}${p.isD ? '(庄)' : ''} ${p.score}分`).join('　')
        : '空牌桌，来开一局吧';
    }
  }
  document.body.classList.toggle('playing', !!G.playing);
  applyOrient();
  // 退出游玩态即解横屏锁定 + 退全屏（桌面端/不支持的浏览器无操作）
  if (!G.playing && screen.orientation && screen.orientation.unlock) {
    try { screen.orientation.unlock() } catch (e) {}
  }
  if (!G.playing && document.fullscreenElement && document.exitFullscreen) {
    try { document.exitFullscreen().catch(() => {}) } catch (e) {}
  }
}

function renderReminder() {
  let el = EL('reminder');
  if (!el) return;
  // 中央大牌：可吃碰杠和时显示放炮张；自摸可和时显示刚摸到的和牌张
  let tile = null;
  if (G.playing && !G.over) {
    if (G.phase === 'claim' && G.pending.includes(HUMAN) && G.lastD) tile = G.lastD;
    else if (G.selfHu && G.lastDraw) tile = G.lastDraw;
  }
  el.classList.toggle('show', !!tile);
  let key = tile ? 's' + Tile.tid(tile) : 'h';
  if (el.dataset.rsig === key) return;
  el.dataset.rsig = key;
  if (!tile) { el.innerHTML = ''; return; }
  el.innerHTML = '';
  let big = document.createElement('div');
  big.className = 'tile big';
  big.innerHTML = `<img class="face-img" src="svg/${svgName(tile)}.svg" alt="${Tile.label(tile)}" draggable="false">`;
  el.appendChild(big);
}

function renderHints() {
  let el = EL('hints');
  if (!el) return;
  let html = '';
  // 已听 / 听牌待选（按钮出现或已点选）时不显示，避免单吊红中等已听牌型误导
  if (!(G.over || !G.playing || !G.players.length || G.ting.has(HUMAN) || G.tingIntent || G.forceTing || Game.canStartTing(HUMAN) || Game.canDeclareNow(HUMAN))) {
    let h = Game.handHints(HUMAN);
    // 只保留不满足项；全满足时空行占位（防布局跳动）
    let tags = [
      !h.yao && '断幺九',
      !h.tri && '无碰牌',
      !h.seq && '无顺子',
      !h.pair && '缺对子',
      !h.color && '缺花色',
      h.closed && '门前清'
    ].filter(Boolean);
    html = '<div class="hint-line">' + tags.map(label => `<span class="hint no">${label}</span>`).join('') + '</div>';
  }
  if (el.dataset.hintsig === html) return;
  el.dataset.hintsig = html;
  el.innerHTML = html;
}

// 点听牌后：悬停高亮牌，弹窗显示打出这张会听哪些牌（牌图，无文字）
export function showTingPop(anchorEl, wins) {
  if (!wins || !wins.length) return;
  // 伪横屏下 fixed 定位坐标系被旋转，弹窗位置会错，直接不显示
  if (document.body.classList && document.body.classList.contains('land')) return;
  let pop = document.getElementById('ting-pop');
  if (!pop) {
    pop = document.createElement('div');
    pop.id = 'ting-pop';
    pop.className = 'hide';
    document.body.appendChild(pop);
    // 触屏/失焦兜底：下一次点按即关闭（本次点按先于 mouseenter，不影响弹出；重复注册会被浏览器去重）
    document.addEventListener('pointerdown', hideTingPop, true);
  }
  pop.innerHTML = '';
  wins.forEach(t => {
    let m = tileEl(t);
    m.classList.add('mini');
    pop.appendChild(m);
  });
  pop.classList.remove('hide');
  let r = anchorEl.getBoundingClientRect();
  let pw = pop.offsetWidth, ph = pop.offsetHeight;
  pop.style.left = Math.min(Math.max(8, r.left + r.width / 2 - pw / 2), Math.max(8, window.innerWidth - pw - 8)) + 'px';
  let top = r.top - ph - 8;
  if (top < 0) top = r.bottom + 8;
  pop.style.top = top + 'px';
}

export function hideTingPop() {
  let pop = document.getElementById('ting-pop');
  if (pop) { pop.classList.add('hide'); pop.innerHTML = ''; }
}

// ===== 触屏听牌：先点预览「打出后听哪些」，再点同张或「打出」确认（PC 仍是 hover 弹窗） =====
let tingSelIdx = -1;

function isCoarse() {
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}

// ===== 竖屏/横屏偏好：默认竖屏，触屏横屏偏好时伪横屏旋转（真机竖屏视口） =====
const ORIENT_KEY = 'mahjong_orient';

export function getOrient() {
  try { return localStorage.getItem(ORIENT_KEY) === 'landscape' ? 'landscape' : 'portrait'; } catch (e) { return 'portrait'; }
}

export function applyOrient() {
  let coarse = isCoarse();
  let portraitView = typeof matchMedia === 'function' && matchMedia('(orientation: portrait)').matches;
  let mode = getOrient();
  let on = !!(G.playing && coarse && portraitView);
  document.body.classList.toggle('land', on && mode === 'landscape');
  document.body.classList.toggle('port', on && mode === 'portrait');
  let b = EL('orient-btn');
  if (b) b.textContent = mode === 'landscape' ? '切换竖屏' : '切换横屏';
}

// 切换方向：只切 CSS 布局，不请求全屏；切竖屏时顺带解锁方向
export function cycleOrient() {
  let next = getOrient() === 'landscape' ? 'portrait' : 'landscape';
  try { localStorage.setItem(ORIENT_KEY, next); } catch (e) {}
  if (next === 'portrait' && screen.orientation && screen.orientation.unlock) {
    try { screen.orientation.unlock(); } catch (e) {}
  }
  applyOrient();
}

if (typeof window !== 'undefined') {
  window.addEventListener('resize', applyOrient);
  window.addEventListener('orientationchange', applyOrient);
}

function clearTingSel() {
  tingSelIdx = -1;
  hideTingPop();
  let p = EL('ting-preview');
  if (p) { p.classList.add('hide'); p.innerHTML = ''; }
  document.querySelectorAll('.seat-bottom .tile.ting-armed').forEach(e => e.classList.remove('ting-armed'));
}

function renderTingPreview(wins) {
  let p = EL('ting-preview');
  if (!p) return;
  p.innerHTML = '';
  let label = document.createElement('span');
  label.className = 'tp-label';
  label.textContent = '打出后听';
  p.appendChild(label);
  wins.forEach(t => {
    let m = tileEl(t);
    m.classList.add('mini');
    p.appendChild(m);
  });
  let btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tp-btn';
  btn.textContent = '打出';
  btn.onclick = () => { let i = tingSelIdx; clearTingSel(); Game.handleDiscard(i); };
  p.appendChild(btn);
  p.classList.remove('hide');
}

function onTingTile(idx, node, wins) {
  if (!isCoarse()) { Game.handleDiscard(idx); return; }
  if (tingSelIdx === idx) { clearTingSel(); Game.handleDiscard(idx); return; }
  tingSelIdx = idx;
  document.querySelectorAll('.seat-bottom .tile.ting-armed').forEach(e => e.classList.remove('ting-armed'));
  node.classList.add('ting-armed');
  renderTingPreview(wins);
}

// 点按候选牌以外区域取消预览
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', e => {
    if (tingSelIdx < 0) return;
    if (e.target.closest && e.target.closest('.tile, .ting-preview')) return;
    clearTingSel();
  }, true);
}

function findFourKind() {
  let c = {};
  G.players[HUMAN].hand.forEach(t => { c[Tile.tid(t)] = (c[Tile.tid(t)] || 0) + 1; });
  let id = Object.keys(c).find(k => c[k] >= 4);
  return id ? G.players[HUMAN].hand.find(t => Tile.tid(t) === id) : null;
}

// 吃碰杠按钮下方的小预览：吃到后副露的样子（被吃碰的居中染黄）
function meldPreview(act) {
  let t = G.lastD;
  if ((act.a === 'chi' || act.a === 'peng' || act.a === 'kong') && t) {
    if (act.a === 'chi' && act.d) {
      return act.d.map(n => {
        let x = (n === t.num) ? t : { type: t.type, num: n, suit: Tile.SN[t.type], id: n + t.type };
        return { t: x, claimed: x === t };
      });
    }
    if (act.a === 'peng') {
      let pair = G.players[HUMAN].hand.filter(x => Tile.tid(x) === Tile.tid(t)).slice(0, 2);
      return [{ t: pair[0] || t, claimed: false }, { t, claimed: true }, { t: pair[1] || t, claimed: false }];
    }
    if (act.a === 'kong') {
      let three = G.players[HUMAN].hand.filter(x => Tile.tid(x) === Tile.tid(t)).slice(0, 3);
      while (three.length < 3) three.push(t);
      return [...three.map(x => ({ t: x, claimed: false })), { t, claimed: true }];
    }
  }
  if (act.a === 'buKong' && act.d) {
    return [0, 1, 2, 3].map(() => ({ t: act.d, claimed: false }));
  }
  if (act.a === 'selfKong') {
    let tile = findFourKind();
    if (tile) return [0, 1, 2, 3].map(() => ({ t: tile, claimed: false }));
  }
  return null;
}

function renderActions() {
  for (let i = 1; i < 4; i++) {
    let el = EL(ACTIONS[i]);
    if (el) { el.innerHTML = ''; el.classList.add('hide'); }
  }
  let el = EL(ACTIONS[0]);
  if (!el) return;

  let acts = [];
  if (G.playing && !G.over && !G.auto) {
    if (G.selfHu) {
      acts = [{ a: 'hu', l: '和' }];
    } else if (G.phase === 'claim' && G.pending.includes(HUMAN)) {
      acts = Game.claimActions(HUMAN);
      // 有和无过：能和时不给过
      if (!acts.some(x => x.a === 'hu')) acts.push({ a: 'pass', l: '过' });
    } else if (G.phase === 'discard' && G.curP === HUMAN) {
      acts = Game.selfActions(HUMAN);
    }
    if (!G.selfHu && G.players.length && (Game.canStartTing(HUMAN) || Game.canDeclareNow(HUMAN))) acts.push({ a: 'ting', l: '听牌' });
  }
  // 按钮集合不变时不重建，避免每次刷新重放入场动画
  let sig = acts.map(a => [a.a, a.l, a.d ? (Array.isArray(a.d) ? a.d.join('-') : Tile.tid(a.d)) : '', a.ting ? 1 : 0].join(':')).join(';') + '|' + (G.selfHu ? 1 : 0);
  if (el.dataset.asig === sig) return;
  el.dataset.asig = sig;
  el.innerHTML = '';
  el.classList.toggle('hide', !acts.length);

  acts.forEach(a => {
    let b = document.createElement('button');
    let cls = a.a === 'selfKong' || a.a === 'buKong' ? 'kong' : a.a;
    b.className = 'ab ' + cls;
    let main = document.createElement('span');
    main.className = 'ab-main';
    main.textContent = a.a === 'chi' ? '吃' : a.a === 'peng' ? '碰'
      : a.a === 'kong' || a.a === 'selfKong' || a.a === 'buKong' ? '杠'
      : a.a === 'hu' ? '和' : a.l;
    b.appendChild(main);
    let prev = meldPreview(a);
    if (prev) {
      let sub = document.createElement('span');
      sub.className = 'ab-sub';
      prev.forEach(p => sub.appendChild(tileEl(p.t, { claimed: p.claimed })));
      b.appendChild(sub);
    }
    if (a.ting && a.a !== 'hu') {
      let badge = document.createElement('span');
      badge.className = 'ab-ting';
      badge.textContent = '听';
      b.appendChild(badge);
    }
    b.onclick = () => Game.handleAB(HUMAN, a.a, a.d);
    el.appendChild(b);
  });
}

function updateWallCount() {
  let w = EL('wc');
  if (w) w.textContent = G.wall;
  let txt = '剩余 ' + G.wall;
  let c = EL('wall-count');
  if (c) c.textContent = txt;
  let t = EL('wall-count-top');
  if (t) t.textContent = txt;
}

export function update() {
  clearTingSel(); // 重渲染会移除原牌节点，先清掉过期的预览/选中态
  if (!G.playing) {
    renderLobbyTable();
    renderActions();
    renderHints();
    renderDora();
    updateStartButton();
    return;
  }
  renderHands();
  renderDiscards();
  renderReminder();
  renderActions();
  renderHints();
  renderDora();
  updateWallDisplay();
  updateWallCount();
  updateStartButton();
}

export function addLog(msg) {
  let log = EL('lp');
  let e = document.createElement('div');
  e.className = 'le';
  e.innerHTML = `<span class="hl">[${new Date().toLocaleTimeString()}]</span> ${msg}`;
  log.insertBefore(e, log.firstChild);
  if (log.children.length > 50) log.removeChild(log.lastChild);
}

export function showModal(title, result, score, detail, btnText, cb, breakdown) {
  // 旧的独立宝牌/手牌横幅不再单独显示，统一合并进结算卡
  let win = lastWin;
  lastWin = null;
  let wb0 = EL('win-banner');
  if (wb0) { wb0.classList.remove('show'); wb0.innerHTML = ''; }
  let db0 = EL('dora-banner');
  if (db0) db0.classList.remove('show');
  let ov0 = EL('mo');
  if (ov0) { ov0.classList.remove('win-open'); ov0.style.removeProperty('--win-offset'); }

  let ov = EL('mo');
  renderModalTitle(win, title);
  renderModalHand(win);
  EL('m-result').textContent = '';
  // 和牌时按人计番，统一得分行删除；流局保留说明行
  let scEl = EL('m-score');
  if (win) { scEl.textContent = ''; scEl.classList.add('hide'); }
  else { scEl.textContent = result + (score ? '，' + score : ''); scEl.classList.remove('hide'); }
  EL('m-detail').textContent = '';

  let bd = EL('m-breakdown');
  if (bd) {
    if (breakdown && breakdown.length) {
      let rows = breakdown.map(b => {
        let d = b.delta;
        let color = d > 0 ? '#5fd39a' : d < 0 ? '#ff7b6b' : '#c9d3cd';
        let sign = d > 0 ? '+' + d : String(d);
        return `<div class="bd-row${b.me ? ' me' : ''}">` +
          `<span class="bd-name">${b.name}${b.isD ? ' 🎲' : ''}${b.me ? '(我)' : ''}</span>` +
          `<span class="bd-fan">${b.fan || '—'}</span>` +
          `<span class="bd-delta" style="color:${color}">${sign}</span>` +
          `<span class="bd-total">${b.total}</span>` +
          `</div>`;
      }).join('');
      bd.innerHTML = `<div class="bd-head"><span>玩家</span><span>计番</span><span>本局</span><span>总分</span></div>${rows}`;
      bd.classList.add('show');
    } else {
      bd.innerHTML = '';
      bd.classList.remove('show');
    }
  }

  EL('m-btn').textContent = btnText || '继续';
  ov.classList.add('show');
  let btn = EL('m-btn');
  let label = btnText || '继续';
  let fire = () => { clearModalTimer(); ov.classList.remove('show'); btn.blur(); hideWinBanner(); if (cb) cb(); };
  clearModalTimer();
  btn.onclick = fire;
  // 托管：显示倒计时并自动继续
  if (G.auto && cb) {
    let left = 3;
    btn.textContent = `自动继续 (${left})`;
    modalTimer = setInterval(() => {
      if (!G.auto) { clearModalTimer(); btn.textContent = label; return; }
      left--;
      if (left <= 0) { fire(); return; }
      btn.textContent = `自动继续 (${left})`;
    }, 1000);
  }
}

// ===== 和牌手牌横幅：不再单独展示，仅暂存数据供结算卡合并渲染 =====
export function showWinBanner(data) {
  lastWin = data || null;
}

export function hideWinBanner() {
  lastWin = null;
  let el = EL('win-banner');
  if (el) { el.classList.remove('show'); el.innerHTML = ''; }
  let ov = EL('mo');
  if (ov) { ov.classList.remove('win-open'); ov.style.removeProperty('--win-offset'); }
}

// ===== 结算卡第一行：[🎲 ]玩家名 和牌 | 宝牌🀄（标题不再写“庄家”，🎲 已表示） =====
function renderModalTitle(win, title) {
  let h = EL('m-title');
  h.innerHTML = '';
  let main = document.createElement('span');
  if (win) {
    let isD = !!((G.players.find(p => p.name === win.name) || {}).isD);
    main.textContent = (isD ? '🎲 ' : '') + win.name + ' ' + title.replace(/^庄家/, '');
  } else {
    main.textContent = title;
  }
  h.appendChild(main);
  if (win && G.baopi) {
    let sep = document.createElement('span');
    sep.className = 'm-title-sep';
    h.appendChild(sep);
    let lab = document.createElement('span');
    lab.className = 'm-dora-label';
    lab.textContent = '宝牌';
    h.appendChild(lab);
    h.appendChild(tileEl(G.baopi));
  }
}

// ===== 结算卡第二行：和牌手牌 =====
function renderModalHand(win) {
  let box = EL('m-hand');
  if (!box) return;
  box.innerHTML = '';
  if (!win) { box.classList.add('hide'); return; }
  box.classList.remove('hide');
  let row = document.createElement('div');
  row.className = 'm-tiles';
  (win.melds || []).forEach(m => row.appendChild(meldGroup(m)));
  if ((win.melds || []).length) {
    let sep = document.createElement('div');
    sep.className = 'm-sep';
    row.appendChild(sep);
  }
  // 自摸时和牌张已在手牌中；点炮时把和牌张补到末尾并高亮
  let tiles = [...(win.hand || [])];
  if (!win.isZimo && win.winTile) tiles.push(win.winTile);
  // 按连续花色分组，竖屏折行时整组一起折（与牌桌手牌一致）
  let suitGroup = null, suitType = null;
  tiles.forEach(t => {
    let e = tileEl(t);
    if (t === win.winTile) e.classList.add('wb-win');
    if (!suitGroup || suitType !== t.type) {
      suitGroup = document.createElement('div');
      suitGroup.className = 'hand-suit';
      row.appendChild(suitGroup);
      suitType = t.type;
    }
    suitGroup.appendChild(e);
  });
  box.appendChild(row);
}

// ===== 和牌特效 =====
export function effect(type) {
  let layer = EL('fx');
  if (!layer) return;
  layer.innerHTML = '';
  layer.classList.remove('show');
  void layer.offsetWidth;
  layer.classList.add('show', type === 'baopi' ? 'gold' : 'normal');

  let n = type === 'baopi' ? 44 : 18;
  for (let i = 0; i < n; i++) {
    let p = document.createElement('i');
    p.className = 'fx-particle' + (type === 'baopi' ? ' gold' : '');
    let angle = (Math.PI * 2 * i) / n + Math.random() * 0.4;
    let dist = (type === 'baopi' ? 190 : 100) + Math.random() * 90;
    p.style.setProperty('--dx', (Math.cos(angle) * dist).toFixed(1) + 'px');
    p.style.setProperty('--dy', (Math.sin(angle) * dist).toFixed(1) + 'px');
    p.style.animationDelay = (Math.random() * 0.12).toFixed(2) + 's';
    layer.appendChild(p);
  }
  if (type === 'baopi') {
    let ring = document.createElement('div');
    ring.className = 'fx-ring';
    layer.appendChild(ring);
    let label = document.createElement('div');
    label.className = 'fx-label';
    label.textContent = '宝牌和！';
    layer.appendChild(label);
  }
  setTimeout(() => { layer.classList.remove('show'); layer.innerHTML = ''; }, 1500);
}

// ===== 电脑动作提示：对应座位中央浮出汉字（吃/碰/杠/听） =====
const ACT_CLS = { 吃: 'chi', 碰: 'peng', 杠: 'kong', 听: 'ting' };
export function actFx(pI, text) {
  let table = document.querySelector('.table');
  let seat = EL(PANELS[pI]);
  if (!table || !seat) return;
  let el = document.createElement('div');
  el.className = 'act-fx ' + (ACT_CLS[text] || '');
  let span = document.createElement('span');
  span.textContent = text;
  el.appendChild(span);
  el.style.left = (seat.offsetLeft + seat.offsetWidth / 2) + 'px';
  el.style.top = (seat.offsetTop + seat.offsetHeight / 2) + 'px';
  table.appendChild(el);
  span.addEventListener('animationend', () => el.remove());
  setTimeout(() => { if (el.parentNode) el.remove(); }, 1400);
}

// ===== 整局结算 =====
// 展示口径（互斥）：自摸宝牌仅计宝牌和；存储里 zimo 含宝牌自摸，这里扣除，老存档自动兼容
export function statOf(s) {
  let st = s.stat || {};
  let baopi = st.baopi || 0;
  let zimo = Math.max(0, (st.zimo || 0) - baopi);
  let dianpao = st.dianpao || 0, heipaoHu = st.heipao || 0, dianhei = st.dianhei || 0;
  return { zong: dianpao + heipaoHu + zimo + baopi, zimo, dianpao, heipaoHu, dianhei, baopi };
}

export function showSummary(summary) {
  let ov = EL('summary');
  if (!ov) return;
  let rows = summary.scores.map(s => {
    let color = s.score > 0 ? '#5fd39a' : s.score < 0 ? '#ff7b6b' : '#fff';
    let st = statOf(s);
    return `<div class="sum-row${s.me ? ' me' : ''}">` +
      `<span class="sum-name">${s.name}${s.isD ? ' 🎲' : ''}${s.me ? '(我)' : ''}</span>` +
      `<span>${st.dianhei}</span><span>${st.dianpao}</span><span>${st.heipaoHu}</span><span>${st.zimo}</span><span>${st.baopi}</span><span>${st.zong}</span>` +
      `<span class="sum-score" style="color:${color}">${s.score}</span>` +
      `</div>`;
  }).join('');
  ov.innerHTML = `
    <div class="sum-card">
      <h2>麻将战绩</h2>
      <div class="sum-meta">
        <div><b>${summary.rotations}</b><span>圈数</span></div>
        <div><b>${summary.hands}</b><span>把数</span></div>
        <div><b>${summary.hu}</b><span>和牌</span></div>
        <div><b>${summary.draw}</b><span>流局</span></div>
      </div>
      <div class="sum-scores">
        <div class="sum-head"><span>玩家</span><span>点黑炮</span><span>点炮和</span><span>黑炮和</span><span>自摸和</span><span>宝牌和</span><span>总和牌</span><span>积分</span></div>
        ${rows}
      </div>
      <div class="sum-actions">
        <button type="button" id="sum-download">下载图片</button>
        <button type="button" id="sum-close">关闭</button>
      </div>
    </div>`;
  ov.classList.add('show');
  EL('sum-close').onclick = () => { EL('sum-close').blur(); ov.classList.remove('show'); };
  EL('sum-download').onclick = () => { EL('sum-download').blur(); downloadSummary(summary); };
}

function downloadSummary(summary) {
  const W = 720, H = 760;
  let cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  let ctx = cv.getContext('2d');
  ctx.fillStyle = '#101a15'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#e8c15a'; ctx.lineWidth = 4; ctx.strokeRect(16, 16, W - 32, H - 32);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8c15a';
  ctx.font = 'bold 42px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.fillText('麻将战绩', W / 2, 96);

  // 概览
  let meta = [
    [summary.rotations, '圈数'],
    [summary.hands, '把数'],
    [summary.hu, '和牌'],
    [summary.draw, '流局']
  ];
  let bw = 120, gap = 16, startX = (W - (bw * 4 + gap * 3)) / 2;
  meta.forEach((m, i) => {
    let x = startX + i * (bw + gap), y = 140;
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    ctx.fillRect(x, y, bw, 84);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px "PingFang SC",sans-serif';
    ctx.fillText(String(m[0]), x + bw / 2, y + 44);
    ctx.fillStyle = '#9db3a8';
    ctx.font = '15px "PingFang SC",sans-serif';
    ctx.fillText(m[1], x + bw / 2, y + 70);
  });

  // 每人统计表：玩家 / 点黑炮 / 点炮和 / 黑炮和 / 自摸和 / 宝牌和 / 总和牌 / 积分
  const tableX = 30, tableW = W - 60;
  const colW = [0.22, 0.11, 0.11, 0.11, 0.11, 0.11, 0.11, 0.12].map(r => r * tableW);
  const colX = [];
  colX[0] = tableX;
  for (let i = 1; i < colW.length; i++) colX[i] = colX[i - 1] + colW[i - 1];
  const center = i => colX[i] + colW[i] / 2;

  ctx.textAlign = 'left';
  ctx.fillStyle = '#e8c15a';
  ctx.font = 'bold 22px "PingFang SC",sans-serif';
  ctx.fillText('每人战绩', tableX, 280);

  let y = 296;
  // 表头
  ctx.fillStyle = 'rgba(255,255,255,.06)';
  ctx.fillRect(tableX, y, tableW, 38);
  ctx.fillStyle = '#9db3a8';
  ctx.font = 'bold 14px "PingFang SC",sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('玩家', colX[0] + 8, y + 25);
  ctx.textAlign = 'center';
  ['点黑炮', '点炮和', '黑炮和', '自摸', '宝牌', '总和牌'].forEach((h, i) => ctx.fillText(h, center(i + 1), y + 25));
  ctx.fillText('积分', center(7), y + 25);
  y += 42;

  summary.scores.forEach(s => {
    let st = statOf(s);
    ctx.fillStyle = s.me ? 'rgba(232,193,90,.15)' : 'rgba(255,255,255,.05)';
    ctx.fillRect(tableX, y, tableW, 52);
    ctx.textAlign = 'left';
    ctx.fillStyle = s.me ? '#e8c15a' : '#eef2ef';
    ctx.font = 'bold 18px "PingFang SC",sans-serif';
    ctx.fillText(s.name + (s.isD ? ' 🎲' : '') + (s.me ? ' (我)' : ''), colX[0] + 8, y + 34);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#eef2ef';
    ctx.font = 'bold 18px "PingFang SC",sans-serif';
    [st.dianhei, st.dianpao, st.heipaoHu, st.zimo, st.baopi, st.zong].forEach((v, i) => ctx.fillText(String(v), center(i + 1), y + 34));
    ctx.fillStyle = s.score > 0 ? '#5fd39a' : s.score < 0 ? '#ff7b6b' : '#fff';
    ctx.fillText((s.score > 0 ? '+' : '') + s.score, center(7), y + 34);
    y += 62;
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = '#6b7d74';
  ctx.font = '14px "PingFang SC",sans-serif';
  ctx.fillText('麻将小游戏', W / 2, H - 34);

  let a = document.createElement('a');
  a.download = '麻将战绩.png';
  a.href = cv.toDataURL('image/png');
  a.click();
}
