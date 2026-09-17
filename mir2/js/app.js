// 传奇挂机小游戏：DOM 胶水层（渲染、存档、主循环）
import * as G from './game.js?v=22'

const $ = (s) => document.querySelector(s)

function fmtRange(r) {
  return G.fmtRange(r)
}

const JOB_ICON = { warrior: '🗡️', mage: '🔮', taoist: '📿' }

const HELP_HTML = '<ol class="help-list">'
  + '<li>你有战士、法师、道士三人小队，每人每秒自动砍怪一次，不用操作</li>'
  + '<li>杀怪得经验升级、掉金币和装备；打不过的怪会自动换弱的打，越高级怪越好</li>'
  + '<li>装备自动穿属性最好的（战士看攻击、法师看魔法、道士看道术），背包三人共用、只记数量不消耗</li>'
  + '<li>技能到等级自动学会，战斗中自动用伤害最高的那个打</li>'
  + '<li>挂机有 1% 概率遇到精英怪，掉落更好</li>'
  + '<li>三人 35 级后可组队挑战首领，每只首领每小时能打一次，胜利掉落多多</li>'
  + '<li>进度每 5 秒自动保存，可导出备份；速度条最高 100 倍</li></ol>'

function sr(k, v) {
  return '<div class="stat"><span>' + k + '</span><b>' + v + '</b></div>'
}

function tipAttrs(name) {
  const it = G.DB.itemByName[name]
  const q = G.itemQuality(it)
  const tip = (it ? G.itemTip(name).slice(name.length).trim() : '')
  return ' data-tip="' + tip.replace(/"/g, '') + '" data-q="' + q + '" data-name="' + name.replace(/"/g, '') + '"'
}

function render() {
  for (const el of document.querySelectorAll('.gold-num')) el.textContent = G.S.gold.toLocaleString('zh-CN')
  const names = Object.keys(G.S.bag)
    .filter((n) => (!bagFilter || n.includes(bagFilter)) && (bagQuality === null || G.itemQuality(G.DB.itemByName[n]) === bagQuality))
    .sort((a, b) => G.S.bag[b] - G.S.bag[a])
  const bagHtml = names.map((n) => '<div class="bag-row" data-item="' + n + '"><span class="q' + G.itemQuality(G.DB.itemByName[n]) + '"' + tipAttrs(n) + '>' + n + '</span><b>× ' + G.S.bag[n] + '</b></div>').join('')
  $('#bag').innerHTML = bagHtml || '<div class="bag-empty">空空如也，快去打怪</div>'
  for (const c of G.S.chars) {
    const st = G.stats(c)
    const need = (G.DB.levels.find((l) => l.level === c.level) || {}).expToNext || 1
    const pct = Math.min(100, (c.exp / need) * 100)
    const eqHtml = G.SLOTS.map(([k, label]) => {
      const nm = c.equip[k]
      const q = nm ? G.itemQuality(G.DB.itemByName[nm]) : 0
      return '<div class="eq"><span>' + label + '</span><b class="q' + q + '"' + (nm ? tipAttrs(nm) : '') + '>' + (nm || '空') + '</b></div>'
    }).join('')
    const t = c.target
    const tpct = t ? Math.max(0, (t.HP / t.MaxHP) * 100) : 0
    const el = document.getElementById('char-' + c.key)
    el.querySelector('.lv').textContent = 'Lv.' + c.level
    const lamp = el.querySelector('.comp-lamp')
    const coef = G.COMP_COEF[c.key] || 1
    lamp.textContent = c.comp ? '经验×' + coef : ''
    lamp.title = c.comp ? '落后补偿中：经验×' + coef + '，领先另外两人各 10% 后关闭' : ''
    el.querySelector('.expbar').style.width = pct + '%'
    el.querySelector('.exptext').textContent = c.exp + ' / ' + need
    el.querySelector('.mir2-equips').innerHTML = eqHtml
    el.querySelector('.mir2-stats').innerHTML = sr('攻击', fmtRange(st.dc)) + sr('魔法', fmtRange(st.mc)) + sr('道术', fmtRange(st.sc)) + sr('防御', fmtRange(st.ac)) + sr('魔御', fmtRange(st.mac))
    el.querySelector('.kills').innerHTML = '<span class="kill-chip">普通 <b>' + c.killsNormal + '</b></span><span class="kill-chip k-elite">精英 <b>' + c.killsElite + '</b></span><span class="kill-chip k-boss">首领 <b>' + c.killsBoss + '</b></span>'
    const mobName = t ? G.shortName(t.Name) : ''
    el.querySelector('.mob').innerHTML = !t ? '寻找怪物中…' : t.kind === 'boss' ? '讨伐【' + t.Name + '】中…' : (t.kind === 'elite' ? '<b class="elite-name">' + mobName + '</b>' : mobName) + ((t.count || 1) > 1 ? '×' + t.count : '') + '（' + Math.max(0, t.HP) + ' / ' + t.MaxHP + '）'
    el.querySelector('.mobbar').style.width = tpct + '%'
    el.querySelector('.mir2-log').innerHTML = c.logs.slice().reverse().map((l) => '<div>' + fmtLog(l) + '</div>').join('')
  }
  updateSpeedButton()
  refreshTip()
}

let bagFilter = ''
let bagQuality = null
let resetting = false // 重置中：跳过 beforeunload 自动存档，否则删了也白删

// 怪物展示名：全名→{短名, 是否精英}，日志与血条上方共用（括号精确匹配，技能/物品名不受影响）
let dispMap = null
function mobDisp() {
  if (dispMap) return dispMap
  dispMap = new Map()
  for (const m of G.DB.monsters) if (/\d$/.test(m.Name)) dispMap.set(m.Name, { base: G.shortName(m.Name), elite: false })
  for (const m of G.DB.elites) dispMap.set(m.Name, { base: G.shortName(m.Name), elite: true })
  return dispMap
}
function fmtLog(l) {
  for (const [full, d] of mobDisp()) {
    if (!l.includes(full)) continue
    l = l.split('【' + full + '】').join('【' + (d.elite ? '<b class="elite-name">' + d.base + '</b>' : d.base) + '】')
  }
  return l.replace(/【([^【】]+)】/g, (full, name) => {
    const it = G.DB.itemByName[name]
    if (!it) return full
    const q = G.itemQuality(it)
    return q > 0 ? '【<b class="q' + q + '">' + name + '</b>】' : full
  })
}

function buildDom() {
  $('#chars').innerHTML = G.S.chars.map((c) => '<div class="mir2-col job-' + c.key + '" id="char-' + c.key + '">'
    + '<div><div class="char-head"><b>' + (JOB_ICON[c.key] || '') + c.name + '</b><span class="lv"></span><span class="comp-lamp q4"></span><button class="btn" data-skill="' + c.key + '">技能</button></div>'
    + '<div class="exp-row"><div class="mir2-bar exp"><i class="expbar"></i></div><span class="exptext"></span></div>'
    + '<div class="sec-t">装备</div><div class="mir2-equips"></div>'
    + '<div class="sec-t">属性</div><div class="mir2-stats"></div>'
    + '<div class="kills"></div></div>'
    + '<div class="mir2-fight"><div class="mob"></div><div class="mir2-bar"><i class="mobbar"></i></div><div class="mir2-log"></div></div>'
    + '</div>').join('')
  document.querySelectorAll('[data-skill]').forEach((b) => {
    b.onclick = () => showSkills(b.getAttribute('data-skill'))
  })
}

function showSkills(key) {
  const c = G.S.chars.find((x) => x.key === key)
  const head = '<div class="skill-grid head"><span>技能</span><span>当前</span><span class="q1">Lv1</span><span class="q2">Lv2</span><span class="q3">Lv3</span></div>'
  const rows = G.jobMagics(c.job).map((m) => {
    const lv = G.skillLevel(m, c.level)
    const need = (n, i) => '<span class="' + (c.level >= n ? 'q' + (i + 1) : '') + '">' + n + '</span>'
    return '<div class="skill-grid"><span class="sk-name">' + m.MagName + '</span>'
      + '<span class="sk-cur ' + (lv ? 'q' + lv : '') + '">' + (lv ? 'Lv.' + lv : '-') + '</span>'
      + need(m.NeedL1, 0) + need(m.NeedL2, 1) + need(m.NeedL3, 2) + '</div>'
  }).join('')
  openModal(c.name + '的技能（数字为解锁等级）', head + (rows || '<div>暂无技能</div>'))
}

function openModal(title, html) {
  $('#modal-title').textContent = title
  $('#modal-body').innerHTML = html
  $('.mir2-modal-box').classList.remove('win-box', 'list-box')
  $('#modal').classList.add('open')
}

// 自定义 hover 提示：渲染后按鼠标位置即时显示（重渲染不丢），跟随鼠标，主题自适应
let mouseX = -1, mouseY = -1, mouseInPage = false
function hideTip() {
  const tip = $('#tooltip')
  tip.style.display = 'none'
  tip.dataset.for = ''
}
function refreshTip() {
  const tip = $('#tooltip')
  if (!mouseInPage || mouseX < 0 || !document.elementFromPoint) { if (tip.style.display === 'block') hideTip(); return }
  const el = document.elementFromPoint(mouseX, mouseY)
  const t = el && el.closest ? el.closest('[data-tip]') : null
  if (!t || !t.dataset.tip) { hideTip(); return }
  if (tip.dataset.for !== t.dataset.tip) {
    tip.innerHTML = '<b class="q' + (t.dataset.q || 0) + '">' + t.dataset.name + '</b><div class="tip-sep"></div>' + t.dataset.tip
    tip.dataset.for = t.dataset.tip
  }
  tip.style.display = 'block'
  const pad = 12
  const r = tip.getBoundingClientRect()
  let x = mouseX + 16, y = mouseY + 16
  if (x + r.width > innerWidth - pad) x = mouseX - r.width - 12
  if (y + r.height > innerHeight - pad) y = mouseY - r.height - 12
  tip.style.left = Math.max(pad, x) + 'px'
  tip.style.top = Math.max(pad, y) + 'px'
}
document.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; mouseInPage = true })
document.addEventListener('mouseout', (e) => { if (!e.relatedTarget) { mouseInPage = false; hideTip() } })
document.addEventListener('scroll', hideTip, true)

function save(silent) {
  try {
    localStorage.setItem(G.SAVE_KEY, JSON.stringify({ gold: G.S.gold, bag: G.S.bag, speed: G.S.speed, speedMax: G.S.speedMax, boost: G.S.boost, bossCd: G.S.bossCd, dropInfo: G.S.dropInfo, chars: G.S.chars.map((c) => ({ key: c.key, level: c.level, exp: c.exp, killsNormal: c.killsNormal, killsElite: c.killsElite, killsBoss: c.killsBoss, equip: c.equip })) }))
    if (!silent) $('#save-tip').textContent = '已保存 ' + new Date().toLocaleTimeString()
  } catch (e) { /* ponytail: 无痕模式存档失败就跳过，游戏照常跑 */ }
}

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(G.SAVE_KEY) || 'null')
    if (!d || !Array.isArray(d.chars)) return false
    G.S.gold = d.gold || 0
    G.S.bag = d.bag || {}
    G.S.speedMax = G.SPEED_TIERS.includes(d.speedMax) ? d.speedMax : 1
    G.S.speed = Math.min(d.speed || 1, G.S.speedMax)
    G.S.boost = G.BOOST_TIERS.includes(d.boost) ? d.boost : 1
    G.S.dropInfo = d.dropInfo || {}
    G.S.bossCd = {}
    for (const [k, v] of Object.entries(d.bossCd || {})) {
      G.S.bossCd[k] = v > 1e12 ? Math.max(0, v + G.BOSS_COOLDOWN_MS - Date.now()) : v // 老存档存的是时间戳
    }
    G.loadChars(d.chars)
    return true
  } catch (e) { return false }
}

function fmtGold(n) {
  if (n < 10000) return n.toLocaleString('zh-CN')
  const w = n / 10000
  return (Number.isInteger(w) ? w : w.toFixed(1)) + '万'
}

function updateSpeedButton() {
  const n = G.nextSpeed()
  const btn = $('#btn-speed-up')
  if (!n) {
    btn.textContent = '速度已满'
    btn.disabled = true
    return
  }
  btn.innerHTML = '<span class="upbtn"><span>升 ×' + n.tier + '</span><span>·</span><i class="coin"></i><span>' + fmtGold(n.cost) + '</span></span>'
  btn.disabled = G.S.gold < n.cost
}

function updateSpeedUI() {
  const slider = $('#speed')
  slider.max = G.S.speedMax
  slider.value = G.S.speed
  $('#speed-val').textContent = G.S.speed
  updateSpeedButton()
}

let bossView = null // null | 'list' | 'battle' | 'victory'
let bossOpen = false // 挑战页面打开时暂停挂机
let bossListTop = 0 // 列表滚动位置：进战斗前记住，打完回来恢复

function setRunBtn() {
  $('#btn-run').textContent = G.S.running ? '⏸ 暂停' : '▶ 继续'
}

const BOSS_HINT = '<div class="boss-hint">⚠️ 打开本页暂停挂机，关闭恢复</div>'

function openBossModal(title, html) {
  bossOpen = true
  openModal(title, html)
}

function fmtPct(p) {
  return (p * 100).toFixed(2) + '%'
}

// BOSS 掉落里的装备（不含药水等），带「至少掉一件」的概率，按品质降序、同品质按使用等级降序
function bossDrops(name) {
  const acc = new Map()
  for (const line of G.dropCache[name] || []) {
    const mt = line.match(/^(\d+)\/(\d+)\s*(.*)$/)
    if (!mt) continue
    let rest = mt[3].trim()
    const q = rest.match(/^(.*?)\s*(\d+)$/)
    if (q) rest = q[1].trim()
    const it = G.DB.itemByName[rest]
    if (!it || !G.SLOT_OF[it.StdMode]) continue
    const rec = acc.get(rest) || { it, miss: 1 }
    rec.miss *= 1 - (+mt[1]) / (+mt[2])
    acc.set(rest, rec)
  }
  return [...acc.values()]
    .map((r) => ({ name: r.it.Name, q: G.itemQuality(r.it), level: r.it.NeedLevel || 0, p: 1 - r.miss }))
    .filter((d) => d.q >= 3)
    .sort((a, b) => (b.q - a.q) || (b.level - a.level))
}

function fmtCdShort(ms) {
  const s = Math.ceil(ms / 1000)
  const m = (s / 60) | 0
  return m + ':' + String(s % 60).padStart(2, '0')
}

function bossState(name) {
  const idx = G.DB.bosses.findIndex((b) => b.Name === name)
  const unlock = G.bossUnlockLevel(idx)
  const left = G.bossCooldownLeft(name)
  if (G.minCharLevel() < unlock) return { state: 'locked', unlock, left }
  return { state: left > 0 ? 'cd' : 'ready', unlock, left }
}

function bossActionHtml(name, st) {
  if (st.state === 'locked') return '<button class="btn" disabled>Lv.' + st.unlock + ' 解锁</button>'
  if (st.state === 'cd') return '<button class="btn boss-cd-btn" disabled>冷却 ' + fmtCdShort(st.left) + '</button>'
  return '<button class="btn" data-fight="' + name + '">挑战</button>'
}

function bossRow(b) {
  const st = bossState(b.Name)
  const drops = bossDrops(b.Name)
  const topQ = drops.some((d) => d.q === 4) ? 4 : 3
  const tip = drops.map((d) => "<div class='q" + d.q + "'>" + d.name + "<span class='tip-rate'>" + fmtPct(d.p) + '</span></div>').join('')
  const attrs = tip ? ' data-tip="' + tip + '" data-q="' + topQ + '" data-name="' + b.Name + '"' : ''
  return '<div class="boss-row"><div class="boss-info"><b class="q' + topQ + '"' + attrs + '>' + b.Name + '</b>'
    + '<span class="boss-lv">Lv.' + b.Lvl + '</span><span class="boss-hp">血 ' + b.HP + '</span></div>'
    + '<div class="boss-action" data-action="' + b.Name + '" data-state="' + st.state + '">' + bossActionHtml(b.Name, st) + '</div></div>'
}

function bindFights() {
  document.querySelectorAll('[data-fight]').forEach((btn) => {
    btn.onclick = () => tryFight(btn.getAttribute('data-fight'))
  })
}

// 掉率加成拖动条（仿倍速滑杆）：上限取已开放最高档，下一档只做文字提示
function boostMaxIdx() {
  let idx = 0
  G.BOOST_TIERS.forEach((b, i) => { if (G.minCharLevel() >= G.boostUnlockLevel(b)) idx = i })
  return idx
}
function boostLabel(b) {
  if (b <= 1) return '无加成'
  const s = '×' + b + ' · ' + fmtGold(G.BOOST_COST[b]) + '金币'
  return G.S.gold < G.BOOST_COST[b] ? s + '（金币不足）' : s
}
function boostBarHtml() {
  const max = boostMaxIdx()
  const cur = Math.min(Math.max(G.BOOST_TIERS.indexOf(G.S.boost), 0), max)
  const next = G.BOOST_TIERS[max + 1]
  return '<div class="boost-bar"><span class="boost-label">掉率加成</span>'
    + '<input id="boost" type="range" min="0" max="' + max + '" step="1" value="' + cur + '" />'
    + '<b id="boost-val">' + boostLabel(G.BOOST_TIERS[cur]) + '</b></div>'
    + (next ? '<div class="boost-next">下一档 ×' + next + '（Lv.' + G.boostUnlockLevel(next) + '解锁）</div>' : '')
    + '<span class="boost-tip" id="boost-tip"></span>'
}

function updateBoostUI() {
  const el = $('#boost')
  if (!el) return
  el.value = Math.min(Math.max(G.BOOST_TIERS.indexOf(G.S.boost), 0), +el.max)
  $('#boost-val').textContent = boostLabel(G.S.boost)
}

let boostTipTimer = null
function tipBoost(msg) {
  const el = $('#boost-tip')
  if (!el) return
  el.textContent = msg
  clearTimeout(boostTipTimer)
  boostTipTimer = setTimeout(() => { el.textContent = '' }, 3000)
}

function bindBoosts() {
  const el = $('#boost')
  if (!el) return
  el.oninput = (e) => {
    G.S.boost = G.BOOST_TIERS[+e.target.value]
    $('#boost-tip').textContent = ''
    updateBoostUI()
  }
}

function tryFight(name) {
  const r = G.startChallenge(name)
  if (!r.ok) {
    if (r.reason === 'level') showGate()
    else if (r.reason === 'gold') tipBoost('金币不足，无法使用 ×' + r.boost + ' 加成（需 ' + fmtGold(r.cost) + '）')
    else if (r.reason === 'locked' && r.boost) tipBoost('×' + r.boost + ' 加成需三人 ' + r.level + ' 级')
    else showBossList()
    return
  }
  showBattle()
}

function showGate() {
  openBossModal('挑战首领', BOSS_HINT + '<div>三名角色都要达到 <b>35 级</b>才能组队挑战首领。</div>'
    + '<div class="gate-now">当前：' + G.S.chars.map((c) => c.name + ' <b>Lv.' + c.level + '</b>').join('　') + '</div>')
}

function showBossList() {
  bossView = 'list'
  // 列表还在（同页重渲染）用实时位置；已进战斗/结算页则用进战斗前记住的位置
  const old = document.querySelector('.boss-list')
  const top = old ? old.scrollTop : bossListTop
  const maxIdx = boostMaxIdx()
  if (G.BOOST_TIERS.indexOf(G.S.boost) > maxIdx) G.S.boost = G.BOOST_TIERS[maxIdx]
  openBossModal('挑战首领', BOSS_HINT + boostBarHtml()
    + '<div class="boss-list">' + (G.DB.bosses.map(bossRow).join('') || '<div class="bag-empty">暂无首领</div>') + '</div>')
  $('.mir2-modal-box').classList.add('list-box')
  const list = document.querySelector('.boss-list')
  if (list) { list.scrollTop = top; bossListTop = top }
  bindFights()
  bindBoosts()
  updateBoostUI()
}

function showBattle() {
  bossView = 'battle'
  const old = document.querySelector('.boss-list')
  if (old) bossListTop = old.scrollTop
  const ch = G.S.challenge
  openBossModal('讨伐 ' + ch.name + (ch.boost > 1 ? '（掉率 ×' + ch.boost + '）' : ''), '<div id="boss-hp-text"></div><div class="mir2-bar"><i id="boss-hpbar"></i></div><div class="mir2-log" id="boss-log"></div>')
}

function showVictory() {
  bossView = 'victory'
  const r = G.S.challenge.result
  // 从好到差：品质降序，同品质按使用等级降序
  const names = r.items.slice().sort((a, b) => {
    const ia = G.DB.itemByName[a]
    const ib = G.DB.itemByName[b]
    return (G.itemQuality(ib) - G.itemQuality(ia)) || ((ib && ib.NeedLevel || 0) - (ia && ia.NeedLevel || 0))
  })
  const drops = names.map((n) => {
    const q = G.itemQuality(G.DB.itemByName[n])
    const cnt = (r.counts && r.counts[n]) || 1
    return '<div class="drop-row q' + q + '"><span>' + n + '</span><b>× ' + cnt + '</b></div>'
  }).join('')
  openBossModal('击败首领 ' + r.name + '！',
    '<div class="win-summary">'
    + '<div class="win-stat"><span>每人经验</span><b>+' + r.exp + '</b></div>'
    + '<div class="win-stat win-gold"><span>金币</span><b>+' + r.gold + '</b></div>'
    + '</div>'
    + '<div class="win-section-title">掉落物品</div>'
    + '<div class="win-drops">' + (drops || '<div class="drop-empty">（本次没有物品掉落）</div>') + '</div>'
    + '<div class="modal-btns"><button class="btn" id="btn-next-boss">继续挑战下一个</button></div>')
  $('.mir2-modal-box').classList.add('win-box')
  $('#btn-next-boss').onclick = showBossList
}

function renderBossView() {
  if (bossView === 'list') {
    document.querySelectorAll('[data-action]').forEach((el) => {
      const name = el.getAttribute('data-action')
      const st = bossState(name)
      if (st.state !== el.dataset.state) {
        el.dataset.state = st.state
        el.innerHTML = bossActionHtml(name, st)
        bindFights()
      } else if (st.state === 'cd') {
        const btn = el.querySelector('button')
        if (btn) btn.textContent = '冷却 ' + fmtCdShort(st.left)
      }
    })
    updateBoostUI()
  } else if (bossView === 'battle' && G.S.challenge) {
    const ch = G.S.challenge
    const bar = $('#boss-hpbar')
    if (!bar) return
    $('#boss-hp-text').textContent = ch.name + '（' + Math.max(0, ch.hp) + ' / ' + ch.maxHp + '）'
    bar.style.width = Math.max(0, (ch.hp / ch.maxHp) * 100) + '%'
    $('#boss-log').innerHTML = ch.logs.slice().reverse().map((l) => '<div>' + fmtLog(l) + '</div>').join('')
  }
}

function tick() {
  if (!G.S.running) return
  G.advanceCooldowns(G.S.speed * 500)
  if (G.S.challenge) {
    if (!G.S.challenge.done) {
      for (const c of G.S.chars) {
        c.acc += G.S.speed / 2
        let n = Math.floor(c.acc)
        c.acc -= n
        while (n-- > 0) G.challengeTick()
      }
    } else if (bossView === 'battle') {
      showVictory()
    }
  } else if (!bossOpen) {
    for (const c of G.S.chars) {
      c.acc += G.S.speed / 2
      let n = Math.floor(c.acc)
      c.acc -= n
      while (n-- > 0) G.attack(c)
    }
  }
  render()
  renderBossView()
}

async function init() {
  const V = 18
  const [levels, items, magics, monsters, elites, bosses, drops] = await Promise.all([
    fetch('data/levels.json?v=' + V).then((r) => r.json()),
    fetch('data/items.json?v=' + V).then((r) => r.json()),
    fetch('data/magics.json?v=' + V).then((r) => r.json()),
    fetch('data/monsters.json?v=' + V).then((r) => r.json()),
    fetch('data/elites.json?v=' + V).then((r) => r.json()),
    fetch('data/bosses.json?v=' + V).then((r) => r.json()),
    fetch('data/drops.json?v=' + V).then((r) => r.json()),
  ])
  G.setDB({ levels, items, magics, monsters, elites, bosses })
  G.loadDrops(drops) // 掉落表静态，一次性载入
  if (!load()) G.newWorld()
  for (const n of Object.keys(G.S.bag)) if (!G.DB.itemByName[n]) delete G.S.bag[n]
  G.rebalanceEquips(true)
  updateSpeedUI()
  buildDom()
  render()
  setInterval(tick, 500)
  setInterval(() => {
    G.rebalanceEquips(false)
    save(true)
  }, 5000)
  addEventListener('beforeunload', () => { if (!resetting) save(true) })
}

$('#btn-help').onclick = () => openModal('玩法说明', HELP_HTML)
$('#btn-run').onclick = () => {
  G.S.running = !G.S.running
  setRunBtn()
}
$('#speed').oninput = (e) => {
  G.S.speed = Math.min(+e.target.value, G.S.speedMax)
  $('#speed-val').textContent = G.S.speed
}
$('#btn-speed-up').onclick = () => {
  if (G.buySpeed().ok) {
    updateSpeedUI()
    render()
  }
}
const QNAME = ['白', '绿', '蓝', '紫', '橙']
let sellQs = new Set([4, 3, 2, 1, 0]) // 出售弹窗的品质多选，会话内记住上次选择
function sellModalHtml() {
  const r = G.sellPreview([...sellQs])
  const boxes = [4, 3, 2, 1, 0].map((q) =>
    '<label class="sell-q q' + q + '"><input type="checkbox" data-sq="' + q + '"' + (sellQs.has(q) ? ' checked' : '') + '>' + QNAME[q] + '</label>').join('')
  const byQ = {}
  for (const row of r.rows) {
    const q = G.itemQuality(G.DB.itemByName[row.name])
    byQ[q] = byQ[q] || { kinds: 0, n: 0, gold: 0 }
    byQ[q].kinds += 1; byQ[q].n += row.n; byQ[q].gold += row.gold
  }
  const body = !r.total
    ? '<div class="bag-empty">没有可出售的所选品质闲置物品。</div>'
    : '<table class="sell-table"><tr><th>品质</th><th>种数</th><th>件数</th><th>金币</th></tr>' + [4, 3, 2, 1, 0].filter((q) => byQ[q]).map((q) =>
      '<tr><td class="q' + q + '">' + QNAME[q] + '色</td><td>' + byQ[q].kinds + '</td><td>' + byQ[q].n + '</td><td>+' + byQ[q].gold.toLocaleString('zh-CN') + '</td></tr>').join('') + '</table>'
    + '<div class="sell-total"><div><span>共计件数</span><b>' + r.rows.length + '种 ' + r.count + '件</b></div><div><span>共计金币</span><b>+' + r.total.toLocaleString('zh-CN') + '</b></div></div>'
  return '<div>勾选要出售的品质：</div><div class="sell-qs">' + boxes + '</div>' + body
    + '<div class="modal-btns"><button class="btn" id="sell-no">取消</button><button class="btn" id="sell-yes"' + (r.total ? '' : ' disabled') + '>确认出售</button></div>'
}
function openSellModal() {
  openModal('一键出售', sellModalHtml())
  document.querySelectorAll('[data-sq]').forEach((box) => {
    box.onchange = () => {
      const q = +box.getAttribute('data-sq')
      if (box.checked) sellQs.add(q)
      else sellQs.delete(q)
      openSellModal()
    }
  })
  $('#sell-no').onclick = () => $('#modal').classList.remove('open')
  const yes = $('#sell-yes')
  if (yes && !yes.disabled) yes.onclick = () => { G.sellBag([...sellQs]); $('#modal').classList.remove('open'); render() }
}
$('#btn-sell').onclick = openSellModal
const fmtDropTime = (at) => {
  const d = new Date(at)
  const p = (n) => String(n).padStart(2, '0')
  return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes())
}
// 橙色掉落列表：每装备一行，按掉落时间新到旧
function openDropModal() {
  const elites = new Set(G.DB.elites.map((m) => m.Name))
  const bosses = new Set(G.DB.bosses.map((m) => m.Name))
  const mobShown = (name) => {
    const cls = elites.has(name) ? 'elite-name' : bosses.has(name) ? 'boss-name' : ''
    return cls ? '<b class="' + cls + '">' + name + '</b>' : name
  }
  const rows = Object.entries(G.S.dropInfo).sort((a, b) => b[1].at - a[1].at).map(([name, d]) =>
    '<tr><td class="q4"' + tipAttrs(name) + '>' + name + '</td><td>' + d.by + '</td><td>' + mobShown(d.from) + '</td><td>' + fmtDropTime(d.at) + '</td></tr>').join('')
  openModal('橙色掉落', rows
    ? '<div class="drop-list"><table class="sell-table"><tr><th>装备</th><th>击杀</th><th>掉落怪物</th><th>时间</th></tr>' + rows + '</table></div>'
    : '<div class="bag-empty">还没有橙色掉落记录。</div>')
}
$('#btn-drops').onclick = openDropModal
$('#bag-search').addEventListener('input', (e) => {
  bagFilter = e.target.value.trim()
  render()
})
$('#bag-filter').addEventListener('click', (e) => {
  const b = e.target.closest ? e.target.closest('[data-q]') : null
  if (!b) return
  const v = b.getAttribute('data-q')
  bagQuality = v === 'all' ? null : +v
  for (const x of document.querySelectorAll('#bag-filter button')) x.classList.toggle('active', x === b)
  render()
})
$('#bag').addEventListener('click', (e) => {
  const row = e.target.closest ? e.target.closest('[data-item]') : null
  if (!row) return
  const name = row.getAttribute('data-item')
  for (const c of G.S.chars) G.equipItem(c, name, true)
  render()
})
$('#btn-export').onclick = () => {
  save(true)
  openModal('导出存档', '<textarea id="io-text" readonly>' + (localStorage.getItem(G.SAVE_KEY) || '') + '</textarea>'
    + '<div class="modal-btns"><button class="btn" id="btn-copy">一键复制</button><span id="copy-tip"></span></div>')
  $('#btn-copy').onclick = () => {
    const el = $('#io-text')
    const done = () => { $('#copy-tip').textContent = '已复制，去粘贴备份吧' }
    const manual = () => {
      el.select()
      try { document.execCommand('copy'); done() } catch (e) { $('#copy-tip').textContent = '复制失败，请手动长按复制' }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(el.value).then(done, manual)
    else manual()
  }
}
$('#btn-import').onclick = () => {
  openModal('导入存档', '<textarea id="io-text" placeholder="粘贴存档文本"></textarea><div class="modal-btns"><button class="btn" id="io-do">确认导入</button></div>')
  $('#io-do').onclick = () => {
    try {
      localStorage.setItem(G.SAVE_KEY, $('#io-text').value)
      location.reload()
    } catch (e) { alert('导入失败：文本无效') }
  }
}
$('#btn-reset').onclick = () => {
  openModal('重置进度', '<div>确定要清空全部进度吗？等级、装备、背包、金币和首领冷却都会丢失，建议先导出存档备份。</div>'
    + '<div class="modal-btns"><button class="btn" id="reset-no">取消</button><button class="btn" id="reset-yes">确认重置</button></div>')
  $('#reset-yes').onclick = () => { resetting = true; localStorage.removeItem(G.SAVE_KEY); location.reload() }
  $('#reset-no').onclick = () => $('#modal').classList.remove('open')
}
$('#btn-boss').onclick = () => {
  if (!G.canChallenge()) { showGate(); return }
  showBossList()
}
$('#modal-close').onclick = () => {
  if (bossView) { G.closeChallenge(); bossView = null }
  bossOpen = false
  $('#modal').classList.remove('open')
}

init()
