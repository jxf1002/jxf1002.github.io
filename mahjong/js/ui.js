import * as Game from './game.js';
import * as Tile from './tile.js';
import { HUMAN } from './constants.js';

const G = Game.G;
const EL = id => document.getElementById(id);

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
  el.innerHTML = '';
  let c = Math.min(G.wall, 24);
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

function renderHands() {
  if (!G.players.length) return;
  for (let i = 0; i < 4; i++) {
    let p = G.players[i];
    let nameEl = EL(NAMES[i]);
    let head = nameEl.parentNode;
    nameEl.textContent = p.name + (i === HUMAN ? '(我)' : '');
    EL(PANELS[i]).classList.toggle('active', !G.over && G.playing && i === G.curP);
    EL(PANELS[i]).classList.toggle('ting', !G.over && G.ting.has(i));

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
    if (i === HUMAN && !G.over) {
      let tiles = Game.tingTiles(HUMAN);
      if (tiles.length) res += '<span class="ting-tiles">听 ' + tiles.map(t => Tile.label(t)).join(' ') + '</span>';
    }
    EL(RESULTS[i]).innerHTML = res;

    let meldEl = EL(MELDS[i]);
    meldEl.innerHTML = '';
    p.melds.forEach(m => meldEl.appendChild(meldGroup(m)));

    let handEl = EL(HANDS[i]);
    handEl.innerHTML = '';
    let canDiscard = !G.over && G.playing && !G.lock && i === HUMAN && G.curP === HUMAN && G.phase === 'discard';
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

    if (i === HUMAN || G.over) {
      p.hand.forEach((t, idx) => {
        let isClickable = canDiscard;
        if (tingSet) {
          isClickable = canDiscard && tingSet.has(Tile.tid(t));
        }
        let isTingTile = !!(tingSet && tingSet.has(Tile.tid(t)));
        let node = tileEl(t, {
          clickable: isClickable,
          onClick: isClickable ? () => Game.handleDiscard(idx) : null,
          tingTarget: isTingTile,
          isNew: idx === newIdx
        });
        if (isTingTile && tingPlanMap) {
          node.onmouseenter = () => showTingPop(node, tingPlanMap[Tile.tid(t)] || []);
          node.onmouseleave = hideTingPop;
        }
        handEl.appendChild(node);
      });
    } else {
      p.hand.forEach(t => handEl.appendChild(tileEl(t, { folded: true })));
    }
  }
}

function renderDiscards() {
  for (let i = 0; i < 4; i++) {
    let el = EL(DISCS[i]);
    el.innerHTML = '';
    if (!G.players.length) continue;
    G.players[i].disc.forEach((t, idx) => {
      let e = tileEl(t);
      if (i === G.lastDB && idx === G.players[i].disc.length - 1 && !t.claimed) e.classList.add('latest');
      if (t.claimed) e.classList.add('claimed');
      el.appendChild(e);
    });
  }
}

function canSeeBaopi() {
  return !!(G.bpR && G.baopi && (G.ting.has(HUMAN) || G.over));
}

function renderDora() {
  let el = EL('dora-banner');
  if (!el) return;
  let show = canSeeBaopi();
  el.classList.toggle('show', show);
  if (!show) { el.innerHTML = ''; return; }
  el.innerHTML = `<span class="dora-label">宝牌</span><span class="dora-tile"><img class="face-img" src="svg/${svgName(G.baopi)}.svg" alt="${Tile.label(G.baopi)}" draggable="false"></span>`;
}

function updateStartButton() {
  let b = EL('btn-s');
  if (b) b.classList.toggle('hide', !G.playing);
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
}

function renderReminder() {
  let el = EL('reminder');
  if (!el) return;
  let show = !G.over && G.phase === 'claim' && G.pending.includes(HUMAN) && G.lastD;
  el.classList.toggle('show', !!show);
  if (!show) { el.innerHTML = ''; return; }
  el.innerHTML = '';
  let big = document.createElement('div');
  big.className = 'tile big';
  big.innerHTML = `<img class="face-img" src="svg/${svgName(G.lastD)}.svg" alt="${Tile.label(G.lastD)}" draggable="false">`;
  el.appendChild(big);
  let lab = document.createElement('div');
  lab.className = 'reminder-label';
  lab.textContent = '可响应 ' + Tile.label(G.lastD);
  el.appendChild(lab);
}

function renderHints() {
  let el = EL('hints');
  if (!el) return;
  if (G.over || !G.players.length) { el.innerHTML = ''; return; }
  let h = Game.handHints(HUMAN);
  let tags = [
    { label: h.yao ? '有幺九' : '断幺九', cls: h.yao ? 'ok' : 'no' },
    { label: h.tri ? '有刻子' : '无碰牌', cls: h.tri ? 'ok' : 'no' },
    { label: h.seq ? '有顺子' : '无顺子', cls: h.seq ? 'ok' : 'no' },
    { label: h.pair ? '有对子' : '缺对子', cls: h.pair ? 'ok' : 'no' },
    { label: h.color ? '花色齐' : '缺花色', cls: h.color ? 'ok' : 'no' },
    { label: h.closed ? '门前清' : '已开门', cls: h.closed ? 'no' : 'ok' }
  ];
  let html = '<div class="hint-line">';
  tags.forEach(t => { html += `<span class="hint ${t.cls}">${t.label}</span>`; });
  if (G.forceTing) html += `<span class="hint-tip">上听吃：把高亮的牌打出去</span>`;
  else if (G.tingIntent) html += `<span class="hint-tip">把高亮的牌打出去即听牌，悬停可看听哪些牌</span>`;
  html += '</div>';

  // 第二行：有用上牌（吃碰摸 / 摸，重复只归吃碰摸）
  let w = Game.tingWatch(HUMAN);
  if (w && (w.claim.length || w.draws.length)) {
    html += `<div class="hint-line"><span class="hint-useful"><span class="hu-label">有用上牌</span>`;
    if (w.claim.length) html += `<span class="hu-label">吃碰摸</span><span class="hu-tiles">${w.claim.map(Tile.label).join(' ')}</span>`;
    if (w.draws.length) html += `<span class="hu-label">摸</span><span class="hu-tiles">${w.draws.map(Tile.label).join(' ')}</span>`;
    html += '</span></div>';
  }
  el.innerHTML = html;
}

// 点听牌后：悬停高亮牌，弹窗显示打出这张会听哪些牌（牌图，无文字）
function showTingPop(anchorEl, wins) {
  if (!wins || !wins.length) return;
  let pop = document.getElementById('ting-pop');
  if (!pop) {
    pop = document.createElement('div');
    pop.id = 'ting-pop';
    pop.className = 'hide';
    document.body.appendChild(pop);
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

function hideTingPop() {
  let pop = document.getElementById('ting-pop');
  if (pop) { pop.classList.add('hide'); pop.innerHTML = ''; }
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
  el.innerHTML = '';

  let acts = [];
  if (G.playing && !G.over) {
    if (G.selfHu) {
      acts = [{ a: 'hu', l: '胡' }];
    } else if (G.phase === 'claim' && G.pending.includes(HUMAN)) {
      acts = Game.claimActions(HUMAN);
      // 有胡无过：能胡时不给过
      if (!acts.some(x => x.a === 'hu')) acts.push({ a: 'pass', l: '过' });
    } else if (G.phase === 'discard' && G.curP === HUMAN) {
      acts = Game.selfActions(HUMAN);
    }
    if (!G.selfHu && G.players.length && (Game.canStartTing(HUMAN) || Game.canDeclareNow(HUMAN))) acts.push({ a: 'ting', l: '听牌' });
  }
  el.classList.toggle('hide', !acts.length);

  acts.forEach(a => {
    let b = document.createElement('button');
    let cls = a.a === 'selfKong' || a.a === 'buKong' ? 'kong' : a.a;
    b.className = 'ab ' + cls;
    let main = document.createElement('span');
    main.className = 'ab-main';
    main.textContent = a.a === 'chi' ? '吃' : a.a === 'peng' ? '碰'
      : a.a === 'kong' || a.a === 'selfKong' || a.a === 'buKong' ? '杠'
      : a.a === 'hu' ? '胡' : a.l;
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

function updateBaopi() {
  let el = EL('bi');
  if (!el) return;
  if (canSeeBaopi()) {
    el.textContent = '宝牌 ' + Tile.label(G.baopi);
    el.style.visibility = 'visible';
  } else {
    el.textContent = '';
    el.style.visibility = 'hidden';
  }
}

function updateWallCount() {
  let w = EL('wc');
  if (w) w.textContent = G.wall;
  let c = EL('wall-count');
  if (c) c.textContent = '剩余 ' + G.wall;
}

export function update() {
  renderHands();
  renderDiscards();
  renderReminder();
  renderActions();
  renderHints();
  renderDora();
  updateWallDisplay();
  updateBaopi();
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
  let ov = EL('mo');
  EL('m-title').textContent = title;
  EL('m-result').textContent = result;
  EL('m-score').textContent = score;
  EL('m-detail').textContent = detail || '';

  let bd = EL('m-breakdown');
  if (bd) {
    if (breakdown && breakdown.length) {
      let rows = breakdown.map(b => {
        let d = b.delta;
        let color = d > 0 ? '#5fd39a' : d < 0 ? '#ff7b6b' : '#c9d3cd';
        let sign = d > 0 ? '+' + d : String(d);
        return `<div class="bd-row${b.me ? ' me' : ''}">` +
          `<span class="bd-name">${b.name}${b.isD ? ' 🎲' : ''}${b.me ? '(我)' : ''}</span>` +
          `<span class="bd-delta" style="color:${color}">${sign}</span>` +
          `<span class="bd-total">${b.total}</span>` +
          `</div>`;
      }).join('');
      bd.innerHTML = `<div class="bd-head"><span>玩家</span><span>本局</span><span>总分</span></div>${rows}`;
      bd.classList.add('show');
    } else {
      bd.innerHTML = '';
      bd.classList.remove('show');
    }
  }

  EL('m-btn').textContent = btnText || '继续';
  ov.classList.add('show');
  EL('m-btn').onclick = () => { ov.classList.remove('show'); EL('m-btn').blur(); hideWinBanner(); if (cb) cb(); };
}

// ===== 胡牌手牌横幅：显示胡牌方手牌与所胡的牌 =====
export function showWinBanner(data) {
  let el = EL('win-banner');
  if (!el || !data) return;
  el.innerHTML = '';

  let head = document.createElement('div');
  head.className = 'wb-head';
  head.textContent = data.name + ' ' + data.title + (data.isBaopi ? ' · 宝牌' : '');
  el.appendChild(head);

  let row = document.createElement('div');
  row.className = 'wb-tiles';

  (data.melds || []).forEach(m => {
    let g = meldGroup(m);
    g.classList.add('wb-meld');
    row.appendChild(g);
  });
  if ((data.melds || []).length) {
    let sep = document.createElement('div');
    sep.className = 'wb-sep';
    row.appendChild(sep);
  }

  // 自摸时胡牌张已在手牌中；点炮时把胡牌张补到末尾
  let tiles = [...(data.hand || [])];
  if (!data.isZimo && data.winTile) tiles.push(data.winTile);
  tiles.forEach(t => {
    let e = tileEl(t);
    if (t === data.winTile) e.classList.add('wb-win');
    row.appendChild(e);
  });

  el.appendChild(row);
  el.classList.add('show');

  // 让结算弹窗避开横幅：按横幅实际高度下移
  let ov = EL('mo');
  if (ov) {
    let top = parseFloat(getComputedStyle(el).top) || 0;
    ov.style.setProperty('--win-offset', Math.ceil(top + el.offsetHeight + 14) + 'px');
    ov.classList.add('win-open');
  }
}

export function hideWinBanner() {
  let el = EL('win-banner');
  if (el) { el.classList.remove('show'); el.innerHTML = ''; }
  let ov = EL('mo');
  if (ov) { ov.classList.remove('win-open'); ov.style.removeProperty('--win-offset'); }
}

// ===== 胡牌特效 =====
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
    label.textContent = '宝牌胡！';
    layer.appendChild(label);
  }
  setTimeout(() => { layer.classList.remove('show'); layer.innerHTML = ''; }, 1500);
}

// ===== 整局结算 =====
function statOf(s) {
  let st = s.stat || {};
  let zimo = st.zimo || 0, ron = st.ron || 0, heipao = st.heipao || 0, baopi = st.baopi || 0;
  let dianpao = st.dianpao || 0, dianhei = st.dianhei || 0;
  return { zong: zimo + ron, zimo, dianpao, heipaoHu: heipao, dianhei, baopi };
}

export function showSummary(summary) {
  let ov = EL('summary');
  if (!ov) return;
  let rows = summary.scores.map(s => {
    let color = s.score > 0 ? '#5fd39a' : s.score < 0 ? '#ff7b6b' : '#fff';
    let st = statOf(s);
    return `<div class="sum-row${s.me ? ' me' : ''}">` +
      `<span class="sum-name">${s.name}${s.isD ? ' 🎲' : ''}${s.me ? '(我)' : ''}</span>` +
      `<span>${st.zong}</span><span>${st.zimo}</span><span>${st.dianpao}</span><span>${st.heipaoHu}</span><span>${st.dianhei}</span><span>${st.baopi}</span>` +
      `<span class="sum-score" style="color:${color}">${s.score}</span>` +
      `</div>`;
  }).join('');
  ov.innerHTML = `
    <div class="sum-card">
      <h2>麻将战绩</h2>
      <div class="sum-meta">
        <div><b>${summary.rotations}</b><span>圈数</span></div>
        <div><b>${summary.hands}</b><span>把数</span></div>
        <div><b>${summary.hu}</b><span>胡牌</span></div>
        <div><b>${summary.draw}</b><span>流局</span></div>
      </div>
      <div class="sum-scores">
        <div class="sum-head"><span>玩家</span><span>总胡牌</span><span>自摸胡</span><span>点炮胡</span><span>黑炮胡</span><span>点黑炮</span><span>宝牌胡</span><span>积分</span></div>
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
    [summary.hu, '胡牌'],
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

  // 每人统计表：玩家 / 总胡牌 / 自摸胡 / 点炮胡 / 黑炮胡 / 点黑炮 / 宝牌胡 / 积分
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
  ['总胡', '自摸', '点炮胡', '黑炮胡', '点黑炮', '宝牌'].forEach((h, i) => ctx.fillText(h, center(i + 1), y + 25));
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
    [st.zong, st.zimo, st.dianpao, st.heipaoHu, st.dianhei, st.baopi].forEach((v, i) => ctx.fillText(String(v), center(i + 1), y + 34));
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
