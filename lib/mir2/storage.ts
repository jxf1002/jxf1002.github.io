// 存档：旧 app.js 的 save/load 原样搬到纯逻辑层，键名与字段保持一致
import { BOOST_TIERS, BOSS_COOLDOWN_MS, SAVE_KEY, SPEED_TIERS } from "./constants.ts"
import { S, loadChars } from "./game.ts"
import type { SaveData } from "./types.ts"

export function save(): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      gold: S.gold,
      bag: S.bag,
      speed: S.speed,
      speedMax: S.speedMax,
      boost: S.boost,
      bossCd: S.bossCd,
      chars: S.chars.map((c) => ({ key: c.key, level: c.level, exp: c.exp, killsNormal: c.killsNormal, killsElite: c.killsElite, killsBoss: c.killsBoss, equip: c.equip })),
    }))
    return true
  } catch {
    // ponytail: 无痕模式存档失败就跳过，游戏照常跑
    return false
  }
}

export function load(): boolean {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY) || "null") as SaveData | null
    if (!d || !Array.isArray(d.chars)) return false
    S.gold = d.gold || 0
    S.bag = d.bag || {}
    S.speedMax = SPEED_TIERS.includes(d.speedMax!) ? d.speedMax! : 1
    S.speed = Math.min(d.speed || 1, S.speedMax)
    S.boost = BOOST_TIERS.includes(d.boost!) ? d.boost! : 1
    S.bossCd = {}
    for (const [k, v] of Object.entries(d.bossCd || {})) {
      S.bossCd[k] = v > 1e12 ? Math.max(0, v + BOSS_COOLDOWN_MS - Date.now()) : v // 老存档存的是时间戳
    }
    loadChars(d.chars)
    return true
  } catch {
    return false
  }
}

export function saveText(): string {
  try {
    return localStorage.getItem(SAVE_KEY) || ""
  } catch {
    return ""
  }
}

export function importText(text: string): boolean {
  try {
    localStorage.setItem(SAVE_KEY, text)
    return true
  } catch {
    return false
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch {
    // 无痕模式下没有可清的存档
  }
}
