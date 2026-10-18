// 由引擎状态派生的视图数据（旧 app.js 的 render 辅助函数），保持无 DOM
import { BOOST_COST, BOOST_TIERS, DB, S, SLOT_OF, bossCooldownLeft, bossUnlockLevel, boostUnlockLevel, dropCache, itemQuality, itemTip, jobMagics, minCharLevel, sellPreview, shortName, skillLevel, stats } from "./game.ts"
import { fmtGold, fmtPct } from "./format.ts"
import type { Char, Item, Monster } from "./types.ts"

export type BagRow = { name: string; n: number; q: number }
export type BossDrop = { name: string; q: number; level: number; p: number }
export type BossState = { state: "locked" | "cd" | "ready"; unlock: number; left: number }
export type SkillRow = { name: string; lv: number; need: [number, number, number] }
export type SellSummary = {
  rows: Array<{ name: string; n: number; gold: number }>
  total: number
  count: number
  byQ: Record<number, { kinds: number; n: number; gold: number }>
}

const QNAME = ["白", "绿", "蓝", "紫", "橙"]
export { QNAME }

// 怪物展示名：全名→{短名, 是否精英}，日志与血条上方共用（括号精确匹配，技能/物品名不受影响）
let dispMap: Map<string, { base: string; elite: boolean }> | null = null
let dispRef: Monster[] | null = null
function mobDisp() {
  if (dispMap && dispRef === DB.elites) return dispMap
  dispRef = DB.elites
  dispMap = new Map()
  for (const m of DB.monsters) if (/\d$/.test(m.Name)) dispMap.set(m.Name, { base: shortName(m.Name), elite: false })
  for (const m of DB.elites) dispMap.set(m.Name, { base: shortName(m.Name), elite: true })
  return dispMap
}

export function formatLog(line: string) {
  for (const [full, d] of mobDisp()) {
    if (!line.includes(full)) continue
    line = line.split("【" + full + "】").join("【" + (d.elite ? '<b class="elite-name">' + d.base + "</b>" : d.base) + "】")
  }
  return line.replace(/【([^【】]+)】/g, (full, name: string) => {
    const it = DB.itemByName[name]
    if (!it) return full
    const q = itemQuality(it)
    return q > 0 ? '【<b class="q' + q + '">' + name + "</b>】" : full
  })
}

// 悬停提示正文（不含物品名本身）
export function tipText(name: string) {
  return itemTip(name).slice(name.length).trim()
}

export function bagRows(filter: string, quality: number | null): BagRow[] {
  return Object.keys(S.bag)
    .filter((n) => (!filter || n.includes(filter)) && (quality === null || itemQuality(DB.itemByName[n]) === quality))
    .sort((a, b) => S.bag[b] - S.bag[a])
    .map((name) => ({ name, n: S.bag[name], q: itemQuality(DB.itemByName[name]) }))
}

export function skillRows(c: Char): SkillRow[] {
  return jobMagics(c.job).map((m) => ({ name: m.MagName, lv: skillLevel(m, c.level), need: [m.NeedL1, m.NeedL2, m.NeedL3] }))
}

export function charNeed(c: Char) {
  return (DB.levels.find((l) => l.level === c.level) || { expToNext: 1 }).expToNext || 1
}

export function charPct(c: Char) {
  return Math.min(100, (c.exp / charNeed(c)) * 100)
}

// BOSS 掉落里的装备（不含药水等），带「至少掉一件」的概率，按品质降序、同品质按使用等级降序
export function bossDrops(name: string): BossDrop[] {
  const acc = new Map<string, { it: Item; miss: number }>()
  for (const line of dropCache[name] || []) {
    const mt = line.match(/^(\d+)\/(\d+)\s*(.*)$/)
    if (!mt) continue
    let rest = mt[3].trim()
    const q = rest.match(/^(.*?)\s*(\d+)$/)
    if (q) rest = q[1].trim()
    const it = DB.itemByName[rest]
    if (!it || !SLOT_OF[it.StdMode]) continue
    const rec = acc.get(rest) || { it, miss: 1 }
    rec.miss *= 1 - (+mt[1]) / (+mt[2])
    acc.set(rest, rec)
  }
  return [...acc.values()]
    .map((r) => ({ name: r.it.Name, q: itemQuality(r.it), level: r.it.NeedLevel || 0, p: 1 - r.miss }))
    .filter((d) => d.q >= 3)
    .sort((a, b) => (b.q - a.q) || (b.level - a.level))
}

export function bossState(name: string): BossState {
  const idx = DB.bosses.findIndex((b) => b.Name === name)
  const unlock = bossUnlockLevel(idx)
  const left = bossCooldownLeft(name)
  if (minCharLevel() < unlock) return { state: "locked", unlock, left }
  return { state: left > 0 ? "cd" : "ready", unlock, left }
}

// 掉率加成拖动条上限：已开放最高档
export function boostMaxIdx() {
  let idx = 0
  BOOST_TIERS.forEach((b, i) => { if (minCharLevel() >= boostUnlockLevel(b)) idx = i })
  return idx
}

export function boostIndex() {
  return Math.min(Math.max(BOOST_TIERS.indexOf(S.boost), 0), boostMaxIdx())
}

export function boostLabel(b: number) {
  if (b <= 1) return "无加成"
  const s = "×" + b + " · " + fmtGold(BOOST_COST[b]) + "金币"
  return S.gold < BOOST_COST[b] ? s + "（金币不足）" : s
}

export function bossTip(name: string) {
  const drops = bossDrops(name)
  const topQ = drops.some((d) => d.q === 4) ? 4 : 3
  return {
    topQ,
    html: drops.map((d) => "<div class='q" + d.q + "'>" + d.name + "<span class='tip-rate'>" + fmtPct(d.p) + "</span></div>").join(""),
  }
}

export function mobClass(name: string) {
  if (DB.elites.some((m) => m.Name === name)) return "elite-name"
  if (DB.bosses.some((m) => m.Name === name)) return "boss-name"
  return ""
}

// 一键出售弹窗：按品质汇总
export function sellSummary(qualities: number[]): SellSummary {
  const r = sellPreview(qualities)
  const byQ: SellSummary["byQ"] = {}
  for (const row of r.rows) {
    const q = itemQuality(DB.itemByName[row.name])
    byQ[q] = byQ[q] || { kinds: 0, n: 0, gold: 0 }
    byQ[q].kinds += 1; byQ[q].n += row.n; byQ[q].gold += row.gold
  }
  return { ...r, byQ }
}

// 角色卡属性行
export function statRows(c: Char) {
  const st = stats(c)
  return [
    ["攻击", st.dc],
    ["魔法", st.mc],
    ["道术", st.sc],
    ["防御", st.ac],
    ["魔御", st.mac],
  ] as Array<[string, [number, number]]>
}
