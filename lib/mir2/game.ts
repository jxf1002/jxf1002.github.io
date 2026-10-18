// 传奇挂机（mir2）：纯逻辑层（无 DOM），行为与旧 public/mir2/js/game.js 一致
import {
  BOOST_COST,
  BOOST_TIERS,
  BOSS_COOLDOWN_MS,
  CHALLENGE_MIN_LEVEL,
  COMP_COEF,
  COMP_LAG,
  COMP_LEAD,
  CRIT_MULT,
  CRIT_RATE,
  ELITE_RATE,
  JOBS,
  JUNK,
  MAGE_ATK,
  MULTI_BASE_LEVEL,
  MULTI_STEP,
  SLOT_OF,
  SLOTS,
  SPEED_COST,
  SPEED_TIERS,
  WAR_BONUS,
} from "./constants.ts"
import type {
  Challenge,
  Char,
  DBData,
  DBShape,
  DropResult,
  Equip,
  GameState,
  Item,
  LevelRow,
  Magic,
  Monster,
  SellPreview,
  SkillOption,
  StatKey,
  StatRange,
  Stats,
  Target,
  UIHooks,
} from "./types.ts"

export * from "./constants.ts"

export const rand = (a: number, b: number) => a + Math.random() * (b - a)
export const randi = (a: number, b: number) => Math.floor(rand(a, b + 1))
export const pick = <T>(arr: T[]): T => arr[(Math.random() * arr.length) | 0]

export const DB: DBShape = { levels: [], items: [], itemByName: {}, magics: [], monsters: [], elites: [], bosses: [] }
export const dropCache: Record<string, string[]> = {}

let ui: UIHooks | null = null
export function setUI(cb: UIHooks | null) {
  ui = cb
}

export function setDB({ levels, items, magics, monsters, elites, bosses }: DBData) {
  bestCache = null
  DB.levels = levels || []
  DB.items = items || []
  DB.itemByName = {}
  for (const it of DB.items) { if (!DB.itemByName[it.Name]) DB.itemByName[it.Name] = it }
  DB.magics = magics || []
  DB.elites = (elites || []).slice().sort((a, b) => a.HP - b.HP)
  DB.bosses = (bosses || []).slice() // 首领保持文件顺序：前 5 只紫装在前，后 12 只橙装按等级、血量升序
  const ban = new Set([...JUNK, ...DB.elites.map((m) => m.Name), ...DB.bosses.map((m) => m.Name)])
  const seen: Record<string, number> = {}
  DB.monsters = (monsters || []).filter((m) => {
    if (seen[m.Name] || ban.has(m.Name)) return false
    seen[m.Name] = 1
    return true
  }).sort((a, b) => a.HP - b.HP)
}

export const S: GameState = { gold: 0, bag: {}, speed: 1, speedMax: 1, boost: 1, running: true, chars: [], challenge: null, bossCd: {}, dropInfo: [] }

export function newWorld() {
  S.gold = 0
  S.bag = {}
  S.speed = 1
  S.speedMax = 1
  S.boost = 1
  S.running = true
  S.chars = JOBS.map(newChar)
  S.challenge = null
  S.bossCd = {}
  S.dropInfo = []
  return S
}

// 下一档速度与价格（已满返回 null）
export function nextSpeed(): { tier: number; cost: number } | null {
  const next = SPEED_TIERS[SPEED_TIERS.indexOf(S.speedMax) + 1]
  return next == null ? null : { tier: next, cost: SPEED_COST[next] }
}

// 花金币解锁下一档倍速，成功后当前速度直接拉到新上限
export function buySpeed(): { ok: true; tier: number; cost: number } | { ok: false; reason: string; tier?: number; cost?: number } {
  const n = nextSpeed()
  if (!n) return { ok: false, reason: "max" }
  if (S.gold < n.cost) return { ok: false, reason: "gold", ...n }
  S.gold -= n.cost
  S.speedMax = n.tier
  S.speed = n.tier
  return { ok: true, ...n }
}

// 所选档位金币不足则不降档，直接返回提示信息
export function boostCheck(maxB: number, gold: number): { ok: true; boost: number } | { ok: false; boost: number; cost: number } {
  const b = maxB || 1
  if (b > 1 && gold < BOOST_COST[b]) return { ok: false, boost: b, cost: BOOST_COST[b] }
  return { ok: true, boost: b }
}

// 加成档按等级开放：×2 要 35 级，之后每级开一档，×50 要 40 级
export function boostUnlockLevel(b: number) {
  return 34 + BOOST_TIERS.indexOf(b)
}

export function newChar(j: { key: string; name: string; job: number }): Char {
  return { key: j.key, name: j.name, job: j.job, level: 1, exp: 0, killsNormal: 0, killsElite: 0, killsBoss: 0, equip: {}, target: null, logs: [], acc: 0, hinted: {}, comp: false }
}

// 存档读入（含老存档 kills 迁移）
export function loadChars(saved: Array<{ key?: string; level?: number; exp?: number; kills?: number; killsNormal?: number; killsElite?: number; killsBoss?: number; equip?: Equip }> | undefined) {
  S.chars = JOBS.map((j) => {
    const s = (saved || []).find((x) => x.key === j.key) || {}
    const c = newChar(j)
    c.level = s.level || 1; c.exp = s.exp || 0
    c.killsNormal = s.killsNormal || s.kills || 0; c.killsElite = s.killsElite || 0; c.killsBoss = s.killsBoss || 0
    c.equip = s.equip || {}
    return c
  })
  return S.chars
}

export function magicByName(name: string) {
  return DB.magics.find((m) => m.MagName === name)
}

export function skillLevel(m: Magic | null | undefined, charLevel: number) {
  if (!m || charLevel < m.NeedL1) return 0
  if (charLevel >= m.NeedL3) return 3
  if (charLevel >= m.NeedL2) return 2
  return 1
}

export function jobMagics(job: number) {
  return DB.magics.filter((m) => m.Job === job)
}

// 装备属性是区间：Xxx 为下限，XxxMax 为上限
const hi = (lo?: number | null, hiV?: number | null) => (hiV == null || hiV < (lo || 0) ? (lo || 0) : hiV)

export function stats(c: { key: string; level: number; equip: Equip }): Stats {
  const base: Stats = { dc: [2, 4], mc: [0, 0], sc: [0, 0], ac: [0, 0], mac: [0, 0] }
  if (c.key === "mage") { base.mc = [2, 4]; base.dc = [0, 1] }
  if (c.key === "taoist") { base.sc = [2, 4]; base.dc = [0, 1] }
  const g = c.level - 1
  const main = JOBS.find((j) => j.key === c.key)!.main
  base[main][1] += g
  base[main][0] += (g / 2) | 0
  base.ac[1] += ((c.level / 5) | 0)
  base.mac[1] += ((c.level / 5) | 0)
  const out: Stats = { dc: [...base.dc], mc: [...base.mc], sc: [...base.sc], ac: [...base.ac], mac: [...base.mac] }
  for (const k of Object.keys(c.equip)) {
    const it = DB.itemByName[c.equip[k]]
    if (!it) continue
    out.dc[0] += it.Dc || 0; out.dc[1] += hi(it.Dc, it.DcMax)
    out.mc[0] += it.Mc || 0; out.mc[1] += hi(it.Mc, it.McMax)
    out.sc[0] += it.Sc || 0; out.sc[1] += hi(it.Sc, it.ScMax)
    out.ac[0] += it.Ac || 0; out.ac[1] += hi(it.Ac, it.AcMax)
    out.mac[0] += it.Mac || 0; out.mac[1] += hi(it.Mac, it.MacMax)
  }
  return out
}

// 只看本职业主属性（战士攻击 / 法师魔法 / 道士道术），取区间上下限之和；防御不参与（模拟里角色不挨打），同分按使用等级
export function equipScore(c: { key: string }, it: Item) {
  const main = JOBS.find((j) => j.key === c.key)!.main
  const key = main === "dc" ? "Dc" : main === "mc" ? "Mc" : "Sc"
  const maxKey = key + "Max"
  return ((it[key] as number || 0) + hi(it[key] as number | null, it[maxKey] as number | null)) * 1000 + (it.NeedLevel || 0)
}

// 列出该角色已学会的全部攻击手段（含普通攻击），带期望伤害
function skillOptions(c: Char): SkillOption[] {
  const st = stats(c)
  const avg = (r: StatRange) => (r[0] + r[1]) / 2
  const opts: SkillOption[] = []
  if (c.job === 0) {
    opts.push({ name: "普通攻击", avg: avg(st.dc), max: st.dc[1], bonus: 0 })
    for (const [name, bonus] of Object.entries(WAR_BONUS)) {
      const lv = skillLevel(magicByName(name), c.level)
      if (!lv) continue
      opts.push({ name, avg: avg(st.dc) * (1 + bonus[lv - 1]), max: st.dc[1] * (1 + bonus[lv - 1]), bonus: bonus[lv - 1] })
    }
    return opts
  }
  if (c.job === 1) {
    opts.push({ name: "普通攻击", avg: avg(st.mc), max: st.mc[1], m: null, lv: 0 })
    for (const name of MAGE_ATK) {
      const m = magicByName(name)!
      const lv = skillLevel(m, c.level)
      if (!lv) continue
      const sa = ((m.Power + m.MaxPower) / 2) + ((lv - 1) * ((m.DefPower + m.DefMaxPower) / 2))
      opts.push({ name, avg: avg(st.mc) + sa, max: st.mc[1] + m.MaxPower + (lv - 1) * m.DefMaxPower, m, lv })
    }
    return opts
  }
  const fu = magicByName("灵魂火符")
  const fuLv = skillLevel(fu, c.level)
  const du = skillLevel(magicByName("施毒术"), c.level)
  const sk = skillLevel(magicByName("召唤骷髅"), c.level)
  const sv = skillLevel(magicByName("召唤神兽"), c.level)
  const extra = (du ? [0, 2, 4, 6][du] : 0) + (sk ? [0, 8, 12, 16][sk] : 0) + (sv ? [0, 15, 25, 35][sv] : 0)
  opts.push({ name: "普通攻击", avg: avg(st.sc) + extra, max: st.sc[1] + extra, m: null, lv: 0 })
  if (fuLv && fu) {
    const sa = ((fu.Power + fu.MaxPower) / 2) + ((fuLv - 1) * ((fu.DefPower + fu.DefMaxPower) / 2))
    opts.push({ name: "灵魂火符", avg: avg(st.sc) + sa + extra, max: st.sc[1] + fu.MaxPower + (fuLv - 1) * fu.DefMaxPower + extra, m: fu, lv: fuLv })
  }
  return opts
}

// 自动选择期望伤害最高的技能
export function bestSkill(c: Char) {
  return skillOptions(c).reduce((a, b) => (b.avg > a.avg ? b : a))
}

// 低倍速展示伤害时：按期望伤害加权随机，伤害越高越常出
function weightedSkill(c: Char) {
  const opts = skillOptions(c)
  const total = opts.reduce((s, o) => s + o.avg, 0)
  if (total <= 0) return opts[0]
  let r = Math.random() * total
  for (const o of opts) { r -= o.avg; if (r < 0) return o }
  return opts[opts.length - 1]
}

export function calcDamage(c: Char, varied?: boolean) {
  const st = stats(c)
  const sk = varied ? weightedSkill(c) : bestSkill(c)
  let dmg: number
  let magic = false
  if (c.job === 0) {
    dmg = randi(st.dc[0], st.dc[1]) * (1 + (sk.bonus || 0))
  } else if (c.job === 1 && sk.m) {
    magic = true
    dmg = randi(st.mc[0], st.mc[1]) + randi(sk.m.Power, sk.m.MaxPower) + (sk.lv! - 1) * randi(sk.m.DefPower, sk.m.DefMaxPower)
  } else if (c.job === 2 && sk.m) {
    magic = true
    const du = skillLevel(magicByName("施毒术"), c.level)
    const skL = skillLevel(magicByName("召唤骷髅"), c.level)
    const sv = skillLevel(magicByName("召唤神兽"), c.level)
    dmg = randi(st.sc[0], st.sc[1]) + randi(sk.m.Power, sk.m.MaxPower) + (sk.lv! - 1) * randi(sk.m.DefPower, sk.m.DefMaxPower)
      + (du ? [0, 2, 4, 6][du] : 0) + (skL ? [0, 8, 12, 16][skL] : 0) + (sv ? [0, 15, 25, 35][sv] : 0)
  } else {
    const main = JOBS.find((j) => j.key === c.key)!.main
    dmg = randi(st[main][0], st[main][1])
  }
  const t = c.target!
  const armor = magic ? (t.MAC || 0) : (t.AC || 0)
  dmg = Math.max(1, Math.round(dmg - randi(0, armor)))
  const crit = Math.random() < CRIT_RATE
  if (crit) dmg *= CRIT_MULT
  return { dmg, skill: sk.name, crit }
}

export function log(c: Char, msg: string) {
  c.logs.push(msg)
  if (c.logs.length > 40) c.logs.splice(0, c.logs.length - 40)
}

// 展示用短名：隐去数字后缀怪的尾数（如 僵尸10→僵尸），普通名原样返回
export const shortName = (n?: string | null) => (n || "").replace(/\d+$/, "")

// 遭遇倍数期望（50级以下恒为1）；实际只数 = 取整 + 小数部分伯努利，保证期望精确
export function encounterMult(level: number) {
  return level >= MULTI_BASE_LEVEL ? 1 + (level - MULTI_BASE_LEVEL) * MULTI_STEP : 1
}
export function rollCount(level: number) {
  const m = encounterMult(level)
  const n = Math.floor(m)
  return n + (Math.random() < m - n ? 1 : 0)
}

export function pickMonster(c: Char) {
  const sk = bestSkill(c)
  const dmgMax = Math.max(5, sk.max)
  const pool = DB.monsters.filter((m) => m.Lvl <= Math.max(c.level + 5, c.level * 1.25))
  const base = pool.length ? pool : [DB.monsters[0]]
  const afford = base.filter((m) => m.HP <= dmgMax * 25)
  const list = (afford.length ? afford : base).slice().sort((a, b) => b.HP - a.HP)
  return { mon: pick(list.slice(0, 3)), kind: "normal" as const }
}

export function pickElite(c: Char) {
  // ponytail: 精英只看杀不杀得动，不看等级——1% 掷中就真出，弱精英低级也能撞大运
  const dmgMax = Math.max(5, bestSkill(c).max)
  const pool = DB.elites.filter((m) => m.HP <= dmgMax * 40)
  if (!pool.length) return null
  return pick(pool.slice().sort((a, b) => b.HP - a.HP).slice(0, 3))
}

// 装备品质 0白1绿2蓝3紫4橙：白<16、绿16–20、蓝21–25、紫≥26；每个职业、每个部位最强的装备为橙
let bestCache: Set<string> | null = null
function jobBests() {
  if (bestCache) return bestCache
  bestCache = new Set()
  const slots = [...new Set(Object.values(SLOT_OF))]
  for (const job of JOBS) {
    const c = { key: job.key }
    for (const slot of slots) {
      let best = 0
      let names: string[] = []
      for (const it of Object.values(DB.itemByName)) {
        if (SLOT_OF[it.StdMode] !== slot) continue
        const sc = equipScore(c, it)
        if (sc > best) { best = sc; names = [it.Name] }
        else if (sc === best && sc > 0) names.push(it.Name)
      }
      for (const n of names) bestCache.add(n)
    }
  }
  return bestCache
}
export function itemQuality(it: Item | null | undefined) {
  if (!it) return 0
  if (jobBests().has(it.Name)) return 4
  const need = it.NeedLevel || 0
  return need >= 26 ? 3 : need >= 21 ? 2 : need >= 16 ? 1 : 0
}

// 掉落表一次性载入（静态数据，加载一次即可），name -> 行数组
export function loadDrops(map: Record<string, string[]> | null | undefined) {
  for (const [name, lines] of Object.entries(map || {})) dropCache[name] = lines
}

export function setDrops(name: string, lines: string[]) {
  dropCache[name] = lines
}

export function addBag(name: string, n?: number) {
  S.bag[name] = (S.bag[name] || 0) + (n || 1)
}

// 橙装掉落记录（掉落查询用）：只记橙色，每次掉落一行，新记录插前面；仅内存，刷新即失
export function markDrop(name: string, by: string, from: string) {
  const it = DB.itemByName[name]
  if (!it || itemQuality(it) !== 4) return
  S.dropInfo.unshift({ name, by, from, at: Date.now() })
}

// 一键出售预览：只卖闲置（背包数 - 全队穿戴占用），quality 为 null 全品质，可传数组多选
export function sellPreview(quality?: number | number[] | null): SellPreview {
  const qs = quality == null ? null : new Set(Array.isArray(quality) ? quality : [quality])
  const rows: SellPreview["rows"] = []
  let total = 0
  let count = 0
  for (const [name, n] of Object.entries(S.bag)) {
    if (n <= 0) continue
    const it = DB.itemByName[name]
    if (!it || !(it.Price! > 0)) continue
    if (qs && !qs.has(itemQuality(it))) continue
    const sellN = n - equippedCount(name)
    if (sellN <= 0) continue
    rows.push({ name, n: sellN, gold: sellN * it.Price! })
    total += sellN * it.Price!
    count += sellN
  }
  return { rows, total, count }
}

export function sellBag(quality?: number | number[] | null) {
  const r = sellPreview(quality)
  for (const row of r.rows) {
    S.bag[row.name] -= row.n
    if (S.bag[row.name] <= 0) delete S.bag[row.name]
  }
  S.gold += r.total
  return r
}

// 全队已穿在身上的某件装备总数（背包只计数，穿戴要占用数量）
export function equippedCount(name: string, extra?: Char) {
  const seen = new Set<Char>()
  let n = 0
  for (const ch of extra ? [extra, ...S.chars] : S.chars) {
    if (seen.has(ch)) continue
    seen.add(ch)
    for (const v of Object.values(ch.equip)) if (v === name) n += 1
  }
  return n
}

export function tryEquip(c: Char, itemName: string, silent?: boolean) {
  const it = DB.itemByName[itemName]
  if (!it) return false
  const slotBase = SLOT_OF[it.StdMode]
  if (!slotBase) return false
  const score = equipScore(c, it)
  const keys = slotBase === "brace" ? ["brace1", "brace2"] : slotBase === "ring" ? ["ring1", "ring2"] : [slotBase]
  let key = keys[0]
  if (keys.length === 2) {
    const s0 = c.equip[keys[0]] ? equipScore(c, DB.itemByName[c.equip[keys[0]]]) : -1
    const s1 = c.equip[keys[1]] ? equipScore(c, DB.itemByName[c.equip[keys[1]]]) : -1
    key = s0 <= s1 ? keys[0] : keys[1]
  }
  const cur = c.equip[key] ? equipScore(c, DB.itemByName[c.equip[key]]) : -1
  if (score <= 0 || score <= cur) return false
  if (c.level < (it.NeedLevel || 0)) {
    c.hinted = c.hinted || {}
    if (!silent && !c.hinted[itemName]) {
      c.hinted[itemName] = 1
      log(c, "【" + c.name + "】还穿不上【" + itemName + "】（需 Lv." + it.NeedLevel + "）")
    }
    return false
  }
  const have = S.bag[itemName] || 0
  if (equippedCount(itemName, c) >= have) {
    const dup = silent || c.hinted[itemName + "#qty"] || Object.values(c.equip).includes(itemName)
    if (!dup) log(c, "【" + c.name + "】的【" + itemName + "】数量不够（背包只有 " + have + " 件）")
    c.hinted = c.hinted || {}
    c.hinted[itemName + "#qty"] = 1
    return false
  }
  c.equip[key] = itemName
  if (!silent) log(c, "【" + c.name + "】装备了【" + itemName + "】")
  return true
}

// 两槽位（手镯/戒指）在有足够数量时一次把两个槽都填上
export function equipItem(c: Char, itemName: string, loud?: boolean) {
  for (let i = 0; i < 2 && tryEquip(c, itemName, !loud); i++) { /* 最多两个槽 */ }
}

export function recheckEquips(c: Char, loud?: boolean) {
  for (const name of Object.keys(S.bag)) equipItem(c, name, loud)
}

// 把某件掉落的装备优先分给收益最高的角色（数量按背包计数）
function equipBestForItem(name: string, loud?: boolean) {
  const it = DB.itemByName[name]
  if (!it || !SLOT_OF[it.StdMode]) return
  const order = S.chars.slice().sort((a, b) => equipScore(b, it) - equipScore(a, it))
  for (const c of order) equipItem(c, name, loud)
}

export const EQUIP_SLOTS = ["weapon", "clothes", "helm", "neck", "brace1", "brace2", "ring1", "ring2"]

// 按背包数量重新给全队分配最优装备：每件装备被穿的总数不超过背包数量，
// 每个职业每部位取分数最高、且等级达标的，两槽位要从背包拿两份
export function rebalanceEquips(loud?: boolean) {
  const before = S.chars.map((c) => JSON.stringify(c.equip))
  for (const c of S.chars) c.equip = {}
  const remain = { ...S.bag }
  const edges: Array<[number, Char, string, string]> = []
  for (const c of S.chars) {
    for (const slot of EQUIP_SLOTS) {
      const base = slot.replace(/[12]$/, "")
      for (const it of Object.values(DB.itemByName)) {
        if (SLOT_OF[it.StdMode] !== base || c.level < (it.NeedLevel || 0)) continue
        const sc = equipScore(c, it)
        if (sc > 0) edges.push([sc, c, slot, it.Name])
      }
    }
  }
  edges.sort((a, b) => b[0] - a[0])
  for (const [, c, slot, name] of edges) {
    if (c.equip[slot] || (remain[name] || 0) <= 0) continue
    c.equip[slot] = name
    remain[name] -= 1
  }
  if (loud) {
    S.chars.forEach((c, i) => {
      const old = JSON.parse(before[i]) as Equip
      for (const [slot, name] of Object.entries(c.equip)) if (old[slot] !== name) log(c, "【" + c.name + "】装备了【" + name + "】")
    })
  }
}

export function totalExpOf(c: Char) {
  return ((DB.levels.find((l) => l.level === c.level) || {} as LevelRow).totalExp || 0) + c.exp
}

// 每人独立补偿状态（读档后默认关，下次击杀自愈，不进存档）
export function updateComp() {
  const ts = Object.fromEntries(S.chars.map((c) => [c.key, totalExpOf(c)]))
  const mx = Math.max(...Object.values(ts))
  for (const c of S.chars) {
    if (!c.comp && (mx - ts[c.key]) / mx >= COMP_LAG) c.comp = true
    else if (c.comp && S.chars.every((o) => o.key === c.key || ts[c.key] >= COMP_LEAD * ts[o.key])) c.comp = false
  }
}

export function gainExp(c: Char, n: number) {
  const granted = Math.round(n * (c.comp ? (COMP_COEF[c.key] || 1) : 1))
  c.exp += granted
  for (;;) {
    const need = (DB.levels.find((l) => l.level === c.level) || {} as LevelRow).expToNext
    if (!need || c.exp < need) break
    c.exp -= need
    c.level += 1
    recheckEquips(c, true)
    log(c, "【" + c.name + "】升级了！当前等级 Lv." + c.level)
  }
  return granted
}

// 掉落表每行独立判定：分子/分母为概率（可乘 boost 倍率，封顶 100%），命中后行末数字为数量（默认 1），重复行会累加
export function rollDropLines(name: string, boost?: number): DropResult {
  const b = boost || 1
  const out: DropResult = { gold: 0, items: [], counts: {} }
  for (const line of dropCache[name] || []) {
    const mt = line.match(/^(\d+)\/(\d+)\s*(.*)$/)
    if (!mt) continue
    if (Math.random() >= Math.min(1, ((+mt[1]) / (+mt[2])) * b)) continue
    let rest = mt[3].trim()
    if (!rest) continue
    let n = 1
    const q = rest.match(/^(.*?)\s*(\d+)$/)
    if (q) { rest = q[1].trim(); n = +q[2] }
    if (!rest) continue
    if (rest === "金币") { out.gold += n; continue }
    // ponytail: 掉落表里有几个查无此物的名字（罗刹、嗜血等），进了包也永远穿不上，直接丢弃
    if (!DB.itemByName[rest]) continue
    if (!out.counts[rest]) out.items.push(rest)
    out.counts[rest] = (out.counts[rest] || 0) + n
  }
  return out
}

export function rollDrops(c: Char, m: { Name: string }) {
  const r = rollDropLines(m.Name)
  if (r.gold) {
    S.gold += r.gold
    log(c, "【" + c.name + "】获得了【" + r.gold + "金币】")
  }
  for (const name of r.items) {
    const n = r.counts[name] || 1
    addBag(name, n)
    markDrop(name, c.name, m.Name)
    log(c, "【" + c.name + "】获得了【" + name + "】" + (n > 1 ? " ×" + n : ""))
    equipBestForItem(name, true)
  }
  return r
}

export function attack(c: Char) {
  if (!c.target) {
    const lucky = Math.random() < ELITE_RATE ? pickElite(c) : null
    const { mon, kind } = lucky ? { mon: lucky, kind: "elite" as const } : pickMonster(c)
    const count = rollCount(c.level)
    c.target = { Name: mon.Name, HP: mon.HP, MaxHP: mon.HP, AC: mon.AC, MAC: mon.MAC, Exp: mon.Exp, kind, count }
    log(c, "【" + c.name + "】遭遇到了" + (kind === "elite" ? "精英" : "") + "【" + mon.Name + "】" + (count > 1 ? "×" + count : ""))
    return
  }
  const t = c.target
  const { dmg, skill, crit } = calcDamage(c, S.speed <= 10)
  t.HP -= dmg
  if (S.speed <= 10) log(c, "【" + c.name + "】使用【" + skill + "】对【" + t.Name + "】造成 " + dmg + " 点" + (crit ? "暴击" : "") + "伤害")
  if (t.HP <= 0) {
    if (t.kind === "elite") c.killsElite += 1
    else c.killsNormal += 1
    const n = t.count || 1
    const g = gainExp(c, t.Exp! * n)
    log(c, "【" + c.name + "】击杀了" + (t.kind === "elite" ? "精英" : "") + "【" + t.Name + "】" + (n > 1 ? "×" + n : "") + "，获得经验 " + g)
    for (let i = 0; i < n; i++) rollDrops(c, t)
    updateComp()
    c.target = null
  }
}

// ---------- BOSS 挑战：三人集火，挂机暂停 ----------

export function canChallenge() {
  return S.chars.length > 0 && S.chars.every((c) => c.level >= CHALLENGE_MIN_LEVEL)
}

export function minCharLevel() {
  return S.chars.length ? Math.min(...S.chars.map((c) => c.level)) : 0
}

// 前 5 只（只掉紫）35 级一起开放；后 12 只（掉橙）36 级起每级 2 只
export function bossUnlockLevel(idx: number) {
  if (idx < 5) return CHALLENGE_MIN_LEVEL
  return CHALLENGE_MIN_LEVEL + 1 + Math.floor((idx - 5) / 2)
}

// 冷却用游戏内毫秒计时（受倍速影响），存的是剩余时间
export function bossCooldownLeft(name: string) {
  return Math.max(0, (S.bossCd || {})[name] || 0)
}

export function advanceCooldowns(ms: number) {
  for (const name of Object.keys(S.bossCd || {})) {
    if (S.bossCd[name] > 0) S.bossCd[name] = Math.max(0, S.bossCd[name] - ms)
  }
}

function clog(msg: string) {
  S.challenge!.logs.push(msg)
  if (S.challenge!.logs.length > 100) S.challenge!.logs.splice(0, S.challenge!.logs.length - 100)
}

export type StartResult =
  | { ok: true; boost: number }
  | { ok: false; reason: "busy" | "level" | "missing" | "cooldown" }
  | { ok: false; reason: "locked"; level: number; boost?: number }
  | { ok: false; reason: "gold"; boost: number; cost: number }

export function startChallenge(name: string): StartResult {
  if (S.challenge && !S.challenge.done) return { ok: false, reason: "busy" }
  if (!canChallenge()) return { ok: false, reason: "level" }
  const idx = DB.bosses.findIndex((m) => m.Name === name)
  if (idx < 0) return { ok: false, reason: "missing" }
  const unlock = bossUnlockLevel(idx)
  if (minCharLevel() < unlock) return { ok: false, reason: "locked", level: unlock }
  if (bossCooldownLeft(name) > 0) return { ok: false, reason: "cooldown" }
  const bc = boostCheck(S.boost, S.gold) // 所选加成金币不够就提示，不降档
  if (!bc.ok) return { ok: false, reason: "gold", boost: bc.boost, cost: bc.cost }
  const bUnlock = boostUnlockLevel(S.boost) // 加成档也要看等级
  if (minCharLevel() < bUnlock) return { ok: false, reason: "locked", boost: S.boost, level: bUnlock }
  const b = DB.bosses[idx]
  const boost = bc.boost
  if (boost > 1) S.gold -= BOOST_COST[boost]
  S.challenge = { name, hp: b.HP, maxHp: b.HP, ac: b.AC, mac: b.MAC, exp: b.Exp, lvl: b.Lvl, boost, logs: [], done: false, result: null }
  for (const c of S.chars) {
    c.target = { Name: name, HP: 1, MaxHP: 1, AC: b.AC, MAC: b.MAC, Exp: b.Exp, kind: "boss" }
    log(c, "【" + c.name + "】加入讨伐【" + name + "】！")
  }
  clog("遭遇首领【" + name + "】（" + b.HP + " 血）" + (boost > 1 ? "，掉率 ×" + boost : "") + "，三人集火！")
  return { ok: true, boost }
}

export function challengeTick() {
  const ch = S.challenge
  if (!ch || ch.done) return
  for (const c of S.chars) {
    const { dmg, skill, crit } = calcDamage(c, S.speed <= 10)
    ch.hp -= dmg
    if (S.speed <= 10) clog("【" + c.name + "】使用【" + skill + "】对【" + ch.name + "】造成 " + dmg + " 点" + (crit ? "暴击" : "") + "伤害")
    if (ch.hp <= 0) { finishChallenge(); break }
  }
}

function finishChallenge() {
  const ch = S.challenge!
  ch.done = true
  const r = rollDropLines(ch.name, ch.boost)
  S.gold += r.gold
  for (const name of r.items) { addBag(name, r.counts[name] || 1); markDrop(name, "集火", ch.name) }
  const before = S.chars.map((c) => JSON.stringify(c.equip))
  rebalanceEquips(true)
  S.chars.forEach((c, i) => {
    for (const [k, v] of Object.entries(c.equip)) {
      if ((JSON.parse(before[i]) as Equip)[k] !== v) clog("【" + c.name + "】装备了【" + v + "】")
    }
  })
  for (const c of S.chars) {
    c.killsBoss += 1
    const g = gainExp(c, ch.exp)
    c.target = null
    log(c, "【" + c.name + "】参与击杀了首领【" + ch.name + "】，获得经验 " + g)
  }
  updateComp()
  if (r.gold) clog("获得了【" + r.gold + "金币】")
  for (const name of r.items) clog("获得了【" + name + "】" + (r.counts[name] > 1 ? " ×" + r.counts[name] : ""))
  S.bossCd[ch.name] = BOSS_COOLDOWN_MS
  ch.result = { name: ch.name, exp: ch.exp, gold: r.gold, items: r.items, counts: r.counts }
  ui?.bossDone?.()
}

export function closeChallenge() {
  for (const c of S.chars) c.target = null
  S.challenge = null
}

export function fmtRange(r: StatRange | number[]) {
  return r[0] + "-" + r[1]
}

export function itemTip(name: string) {
  const it = DB.itemByName[name]
  if (!it) return name
  const r = (a?: number | null, b?: number | null) => (a || 0) + "-" + hi(a, b)
  return [name,
    "攻击 " + r(it.Dc, it.DcMax),
    "魔法 " + r(it.Mc, it.McMax),
    "道术 " + r(it.Sc, it.ScMax),
    "防御 " + r(it.Ac, it.AcMax),
    "魔御 " + r(it.Mac, it.MacMax),
    "需要等级 " + it.NeedLevel].join("\n")
}

// 主循环一步（500ms）：旧 app.js tick() 的纯逻辑部分，UI 只负责定时调用
export function tick(paused: boolean) {
  if (!S.running) return
  advanceCooldowns(S.speed * 500)
  if (S.challenge) {
    if (!S.challenge.done) {
      for (const c of S.chars) {
        c.acc += S.speed / 2
        let n = Math.floor(c.acc)
        c.acc -= n
        while (n-- > 0) challengeTick()
      }
    }
  } else if (!paused) {
    for (const c of S.chars) {
      c.acc += S.speed / 2
      let n = Math.floor(c.acc)
      c.acc -= n
      while (n-- > 0) attack(c)
    }
  }
  ui?.update()
}

// 供测试/UI 复用的派生态：当前等级升下一级所需经验（无表时按 1）
export function expToNext(level: number) {
  return (DB.levels.find((l) => l.level === level) || ({} as LevelRow)).expToNext || 1
}

export type { Target, Monster, Item, Magic, LevelRow, Stats, StatKey }
