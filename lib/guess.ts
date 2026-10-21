// 猜数字（Bulls & Cows）纯逻辑：4 位、0-9 不重复、10 次机会
export const LENGTH = 4
export const MAX_TRIES = 10
// 首猜固定 0123：公认的强开局，省掉 5040² 的实时搜索
export const OPENING = "0123"

export type Round = { guess: string; bulls: number; cows: number }
export type Feedback = Omit<Round, "guess">

let CODES: string[] | null = null

/** 全部 5040 组 0-9 不重复的四位数，按数字序（0123 在最前），提示的平局裁决靠它 */
export function allCodes(): string[] {
  if (CODES) return CODES
  const out: string[] = []
  for (let a = 0; a < 10; a += 1) {
    for (let b = 0; b < 10; b += 1) {
      if (b === a) continue
      for (let c = 0; c < 10; c += 1) {
        if (c === a || c === b) continue
        for (let d = 0; d < 10; d += 1) {
          if (d === a || d === b || d === c) continue
          out.push(`${a}${b}${c}${d}`)
        }
      }
    }
  }
  CODES = out
  return out
}

export function randomCode(): string {
  const codes = allCodes()
  return codes[Math.floor(Math.random() * codes.length)]
}

/** bulls = 数字和位置都对，cows = 数字对但位置错 */
export function score(answer: string, guess: string): Feedback {
  let bulls = 0
  let cows = 0
  for (let i = 0; i < LENGTH; i += 1) {
    const at = answer.indexOf(guess[i])
    if (at === i) bulls += 1
    else if (at >= 0) cows += 1
  }
  return { bulls, cows }
}

export function isPlayable(code: string): boolean {
  return /^\d{4}$/.test(code) && new Set(code).size === LENGTH
}

/** 与所有历史反馈一致的答案（含已猜过的组合，调用方自行排除） */
export function candidates(rounds: Round[]): string[] {
  return allCodes().filter((code) =>
    rounds.every((r) => {
      const s = score(code, r.guess)
      return s.bulls === r.bulls && s.cows === r.cows
    }),
  )
}

/** 提示：返回一组推荐猜测。只给建议，是否提交由玩家决定 */
export function hint(rounds: Round[]): string {
  if (rounds.length === 0) return OPENING
  const pool = candidates(rounds)
  // 存档损坏或反馈自相矛盾时兜底，保证 UI 永远拿到合法猜测
  if (pool.length === 0) return OPENING
  if (pool.length === 1) return pool[0]

  // shortcut: 只从候选里挑，不搜全部 5040 组；候选 ≤ 1440 时两两打分几十毫秒，够用
  let best = pool[0]
  let bestCost = Infinity
  const buckets = new Array<number>(25)
  for (const guess of pool) {
    buckets.fill(0)
    for (const code of pool) {
      const s = score(code, guess)
      buckets[s.bulls * 5 + s.cows] += 1
    }
    // 期望剩余候选（乘以总数才便于比较，等价于 sum(n²)）
    let cost = 0
    for (const n of buckets) cost += n * n
    if (cost < bestCost) {
      bestCost = cost
      best = guess
    }
  }
  return best
}
