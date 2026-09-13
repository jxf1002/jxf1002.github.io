import * as Game from './game.js';
import * as Tile from './tile.js';
import { HUMAN } from './constants.js';

const G = Game.G;
const EL = id => document.getElementById(id);

const NAMES = ['nb', 'nl', 'nt', 'nr'];
const RESULTS = ['rb', 'rl', 'rt', 'rr'];
const HANDS = ['hb', 'hl', 'ht', 'hr'];
const MELDS = ['mb', 'ml', 'mt', 'mr'];
const ACTIONS = ['ab2', 'al', 'at', 'ar'];
const PANELS = ['pb', 'pl', 'pt', 'pr'];
const DISCS = ['dcb', 'dcl', 'dct', 'dcr'];

// 牌面对应 svg/ 下的图片：1m=一万 1p=一筒 1s=一条 1z~4z=东南西北 7z=红中
function svgName(t) {
  if (t.type === 'zhong') return '7z';
  let suit = t.type === 'wan' ? 'm' : t.type === 'tong' ? 'p' : 's';
  return t.num + suit;
}

function updateScoreboard() {
  let sb = EL('sb');
  sb.innerHTML = '';
  G.players.forEach((p, i) => {
    let d = document.createElement('div');
    d.className = 'si' + (i === HUMAN ? ' me' : '');
    d.innerHTML = `<span class="name">${p.name}${i === HUMAN ? ' (我)' : ''}${p.isD ? ' 庄' : ''}</span>` +
      `<span class="score" style="color:${p.score > 0 ? '#5fd39a' : p.score < 0 ? '#ff7b6b' : '#fff'}">${p.score}</span>`;
    sb.appendChild(d);
  });
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
    + (opts.tingTarget ? ' ting-target' : '');
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

function renderHands() {
  for (let i = 0; i < 4; i++) {
    let p = G.players[i];
    EL(NAMES[i]).textContent = p.name + (i === HUMAN ? '(我)' : '') + (p.isD ? '(庄)' : '');
    EL(PANELS[i]).classList.toggle('active', !G.over && i === G.curP);
    EL(PANELS[i]).classList.toggle('ting', !G.over && G.ting.has(i));

    let res = '';
    if (G.ting.has(i)) res += '<span class="ti">听牌</span>';
    if (i === HUMAN && !G.over) {
      let tiles = Game.tingTiles(HUMAN);
      if (tiles.length) res += '<span class="ting-tiles">听 ' + tiles.map(t => Tile.label(t)).join(' ') + '</span>';
    }
    EL(RESULTS[i]).innerHTML = res;

    let meldEl = EL(MELDS[i]);
    meldEl.innerHTML = '';
    p.melds.forEach(m => {
      let group = document.createElement('div');
      group.className = 'meld';
      let tiles = meldTiles(m);
      let sidewaysIdx = (m.type === 'chi' || m.type === 'peng') && m.claimedId ? 1 : -1;
      tiles.forEach((t, idx) => {
        let el = tileEl(t);
        if (idx === sidewaysIdx) el.classList.add('sideways');
        group.appendChild(el);
      });
      meldEl.appendChild(group);
    });

    let handEl = EL(HANDS[i]);
    handEl.innerHTML = '';
    if (p.isD && !G.over) {
      let die = document.createElement('span');
      die.className = 'dealer-die';
      die.textContent = '🎲';
      die.title = '庄家';
      handEl.appendChild(die);
    }
    let canDiscard = !G.over && !G.lock && i === HUMAN && G.curP === HUMAN && G.phase === 'discard';
    let tingSet = null;
    if (i === HUMAN && (G.tingIntent || G.forceTing)) {
      tingSet = new Set(Game.tingDiscards(HUMAN).map(t => Tile.tid(t)));
    }

    if (i === HUMAN || G.over) {
      p.hand.forEach((t, idx) => {
        let isClickable = canDiscard;
        if (G.forceTing && tingSet) {
          isClickable = canDiscard && tingSet.has(Tile.tid(t));
        }
        handEl.appendChild(tileEl(t, {
          clickable: isClickable,
          onClick: isClickable ? () => Game.handleDiscard(idx) : null,
          tingTarget: !!(tingSet && tingSet.has(Tile.tid(t)))
        }));
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
  if (!b) return;
  b.textContent = G.playing ? '结束游戏' : '开始游戏';
  b.classList.toggle('stop', G.playing);
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
  let shText;
  if (G.ting.has(HUMAN)) shText = '已听牌';
  else if (Game.tingDiscards(HUMAN).length > 0) shText = '打一张即可听牌';
  else if (Game.tingTiles(HUMAN).length > 0) shText = '已听牌（未宣告）';
  else shText = `还差 ${Math.max(h.shanten, 1)} 张听牌`;
  let tags = [
    { label: h.yao ? '有幺九' : '断幺九', cls: h.yao ? 'ok' : 'no' },
    { label: h.tri ? '有刻子' : '无碰牌', cls: h.tri ? 'ok' : 'no' },
    { label: h.seq ? '有顺子' : '无顺子', cls: h.seq ? 'ok' : 'no' },
    { label: h.pair ? '有对子' : '缺对子', cls: h.pair ? 'ok' : 'no' },
    { label: h.closed ? '门前清' : '已开门', cls: h.closed ? 'no' : 'ok' }
  ];
  let html = `<span class="hint-title">${shText}</span>`;
  tags.forEach(t => { html += `<span class="hint ${t.cls}">${t.label}</span>`; });
  if (G.forceTing) html += `<span class="hint-tip">上听吃：点击高亮的牌打出即可听牌</span>`;
  else if (G.tingIntent) html += `<span class="hint-tip">点击高亮的牌打出即可听牌</span>`;
  el.innerHTML = html;
}

function renderActions() {
  for (let i = 0; i < 4; i++) {
    let el = EL(ACTIONS[i]);
    el.innerHTML = '';
    if (G.over || i !== HUMAN) { el.classList.add('hide'); continue; }

    let acts = [];
    if (G.selfHu && i === HUMAN) {
      acts = [{ a: 'hu', l: '胡' }, { a: 'pass', l: '过' }];
    } else if (G.phase === 'claim' && G.pending.includes(HUMAN)) {
      acts = Game.claimActions(HUMAN);
      acts.push({ a: 'pass', l: '过' });
    } else if (G.phase === 'discard' && i === G.curP) {
      acts = Game.selfActions(HUMAN);
    }
    if (!G.selfHu && (Game.canStartTing(HUMAN) || Game.canDeclareNow(HUMAN))) acts.push({ a: 'ting', l: '听牌' });

    el.classList.toggle('hide', !acts.length);

    acts.forEach(a => {
      let b = document.createElement('button');
      let cls = a.a === 'selfKong' || a.a === 'buKong' ? 'kong' : a.a;
      b.className = 'ab ' + cls;
      b.textContent = a.l;
      if (a.a === 'hu') {
        let ring = document.createElement('span');
        ring.className = 'ring2';
        b.appendChild(ring);
      }
      b.onclick = () => Game.handleAB(HUMAN, a.a, a.d);
      el.appendChild(b);
    });
  }
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
  EL('wc').textContent = G.wall;
  let c = EL('wall-count');
  if (c) c.textContent = '剩余 ' + G.wall;
}

function updateStatus() {
  let b = EL('sbt');
  if (G.over) { b.innerHTML = '本局结束'; return; }
  let who;
  if (G.selfHu) {
    who = '自摸成功，是否胡牌？';
  } else if (G.phase === 'claim') {
    who = G.pending.includes(HUMAN) ? '请选择是否响应' : '等待其他玩家响应…';
  } else {
    who = G.curP === HUMAN ? '轮到你出牌' : G.players[G.curP].name + ' 出牌中…';
  }
  b.innerHTML = `当前：<span class="cp">${who}</span>`;
}

export function update() {
  updateScoreboard();
  renderHands();
  renderDiscards();
  renderReminder();
  renderActions();
  renderHints();
  renderDora();
  updateWallDisplay();
  updateBaopi();
  updateWallCount();
  updateStatus();
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
  EL('m-btn').onclick = () => { ov.classList.remove('show'); EL('m-btn').blur(); if (cb) cb(); };
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
export function showSummary(summary) {
  let ov = EL('summary');
  if (!ov) return;
  let rows = summary.scores.map(s => {
    let color = s.score > 0 ? '#5fd39a' : s.score < 0 ? '#ff7b6b' : '#fff';
    let st = s.stat || { zimo: 0, ron: 0, heipao: 0, baopi: 0 };
    return `<div class="sum-row${s.me ? ' me' : ''}">` +
      `<span class="sum-name">${s.name}${s.isD ? ' 🎲' : ''}${s.me ? '(我)' : ''}</span>` +
      `<span>${st.zimo}</span><span>${st.ron}</span><span>${st.heipao}</span><span>${st.baopi}</span>` +
      `<span class="sum-score" style="color:${color}">${s.score}</span>` +
      `</div>`;
  }).join('');
  ov.innerHTML = `
    <div class="sum-card">
      <h2>麻将战绩</h2>
      <div class="sum-meta">
        <div><b>${summary.rotations}</b><span>圈数</span></div>
        <div><b>${summary.hands}</b><span>把数</span></div>
        <div><b>${summary.zimo + summary.ron}</b><span>胡牌</span></div>
        <div><b>${summary.draw}</b><span>流局</span></div>
      </div>
      <div class="sum-scores">
        <div class="sum-head"><span>玩家</span><span>自摸</span><span>点炮</span><span>黑炮</span><span>宝牌</span><span>积分</span></div>
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
  const W = 640, H = 720;
  let cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  let ctx = cv.getContext('2d');
  let g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#16241d'); g.addColorStop(1, '#0a1410');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#e8c15a'; ctx.lineWidth = 4; ctx.strokeRect(16, 16, W - 32, H - 32);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8c15a';
  ctx.font = 'bold 42px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.fillText('麻将战绩', W / 2, 96);

  // 概览
  let meta = [
    [summary.rotations, '圈数'],
    [summary.hands, '把数'],
    [summary.zimo + summary.ron, '胡牌'],
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

  // 每人统计表：玩家 / 自摸 / 点炮 / 黑炮 / 宝牌 / 积分
  const tableX = 44, tableW = W - 88;
  const colW = [0.30, 0.13, 0.13, 0.13, 0.13, 0.18].map(r => r * tableW);
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
  ctx.font = 'bold 15px "PingFang SC",sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('玩家', colX[0] + 12, y + 25);
  ctx.textAlign = 'center';
  ['自摸', '点炮', '黑炮', '宝牌'].forEach((h, i) => ctx.fillText(h, center(i + 1), y + 25));
  ctx.fillText('积分', center(5), y + 25);
  y += 42;

  summary.scores.forEach(s => {
    let st = s.stat || { zimo: 0, ron: 0, heipao: 0, baopi: 0 };
    ctx.fillStyle = s.me ? 'rgba(232,193,90,.15)' : 'rgba(255,255,255,.05)';
    ctx.fillRect(tableX, y, tableW, 52);
    ctx.textAlign = 'left';
    ctx.fillStyle = s.me ? '#e8c15a' : '#eef2ef';
    ctx.font = 'bold 20px "PingFang SC",sans-serif';
    ctx.fillText(s.name + (s.isD ? ' 🎲' : '') + (s.me ? ' (我)' : ''), colX[0] + 12, y + 34);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#eef2ef';
    ctx.font = 'bold 20px "PingFang SC",sans-serif';
    [st.zimo, st.ron, st.heipao, st.baopi].forEach((v, i) => ctx.fillText(String(v), center(i + 1), y + 34));
    ctx.fillStyle = s.score > 0 ? '#5fd39a' : s.score < 0 ? '#ff7b6b' : '#fff';
    ctx.fillText((s.score > 0 ? '+' : '') + s.score, center(5), y + 34);
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
