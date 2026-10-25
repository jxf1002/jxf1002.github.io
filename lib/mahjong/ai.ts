// 麻将 AI：评估、出牌与鸣牌决策。只读 game 的全局状态，不碰调度与 UI。
import { HUMAN, PLAYER_COUNT } from "./constants.ts"
import { G } from "./state.ts"
import * as Tile from "./tile.ts"
import type {
  AIConfig,
  ClaimAct,
  EvalResult,
  Meld,
  Player,
  Tile as TileType,
} from "./types.ts"

// ===== AI 难度配置 =====
// 中级出牌名次倾向 discardRankProb：按 [第1名, 第2名, 第3名] 的概率取值（名次不足时顺延到末位）
// 历史：100% 第一=[1,0,0]、100% 第二=[0,1,0]；现回到 50% 第二 / 50% 第三
export const AI_LEVELS: Record<string, AIConfig> = {
  easy: {
    randomness: 0.5,
    claimPengRate: 0.6,
    claimChiRate: 0.35,
    kongRate: 1,
    defenseWeight: 0,
    ukeireWeight: 0,
    scoreWeight: 0,
    useTingInfo: false,
    useOpponentModel: false,
  },
  normal: {
    randomness: 0.1,
    claimPengRate: 0.7,
    claimChiRate: 0.4,
    kongRate: 1,
    defenseWeight: 0,
    ukeireWeight: 1,
    scoreWeight: 0.2,
    useTingInfo: true,
    useOpponentModel: false,
    discardRankProb: [0, 0.5, 0.5],
  },
  hard: {
    randomness: 0,
    claimPengRate: 1,
    claimChiRate: 1,
    kongRate: 1,
    defenseWeight: 1,
    ukeireWeight: 3,
    scoreWeight: 1,
    useTingInfo: true,
    useOpponentModel: true,
  },
}

// 当前座位难度：托管时东家直接最强 AI
export function aiLevelOf(pI: number): string {
  if (G.auto && pI === HUMAN) return "hard"
  if (G.aiLevels && AI_LEVELS[G.aiLevels[pI]]) return G.aiLevels[pI]
  return G.aiLevel || "normal"
}

export function visibleCount(t: TileType) {
  let exposed: TileType[] = []
  G.players.forEach((p) => p.melds.forEach((m) => exposed.push(...m.ts)))
  // 已被吃/碰/杠走的弃牌同时算在副露里，避免重复计数
  return (
    G.discard.filter((x) => !x.claimed && Tile.tid(x) === Tile.tid(t)).length +
    exposed.filter((x) => Tile.tid(x) === Tile.tid(t)).length
  )
}

export function handDrawsForTing(hand: TileType[], melds: Meld[]): TileType[] {
  melds = melds || []
  let need = 4 - melds.length
  if (need < 0 || hand.length !== need * 3 + 1) return []
  if (melds.length < 1 || melds.length >= 4) return []
  if (Tile.isTing(hand, melds)) return []
  let counts: Record<string, number> = {}
  hand.forEach((t) => {
    counts[Tile.tid(t)] = (counts[Tile.tid(t)] || 0) + 1
  })
  let res: TileType[] = []
  let tryTile = (cand: TileType) => {
    if ((counts[Tile.tid(cand)] || 0) + visibleCount(cand) >= 4) return
    if (Tile.handTingDiscards([...hand, cand], melds).length > 0) res.push(cand)
  }
  Tile.TT.forEach((type) => {
    for (let n = 1; n <= 9; n++)
      tryTile({ type, num: n, suit: Tile.SN[type], id: n + type })
  })
  tryTile({ type: "zhong", num: 0, suit: "红中", id: "红中" })
  return res
}

export function handTingDistance(hand: TileType[], melds: Meld[]): number {
  melds = melds || []
  let need = 4 - melds.length
  if (need < 0) return 8
  if (hand.length === need * 3 + 2) {
    if (Tile.handTingDiscards(hand, melds).length) return 0
    let best = 8,
      seen = new Set<string>()
    for (let i = 0; i < hand.length; i++) {
      let t = hand[i]
      if (seen.has(Tile.tid(t))) continue
      seen.add(Tile.tid(t))
      best = Math.min(
        best,
        handTingDistance(
          hand.filter((_, j) => j !== i),
          melds,
        ),
      )
    }
    return best
  }
  if (hand.length !== need * 3 + 1) return 8
  if (Tile.isTing(hand, melds)) return 0
  if (handDrawsForTing(hand, melds).length) return 1
  // 更远：直接用非标向听（已含缺幺九/缺刻子/缺顺子/单花色约束与死搭扣除）
  return Math.max(Tile.effectiveShanten(hand, melds, liveRemainFn(hand)), 2)
}

// ===== AI =====
function connectedness(hand: TileType[]): number {
  let s = 0
  for (let i = 0; i < hand.length; i++) {
    for (let j = 0; j < hand.length; j++) {
      if (i === j) continue
      let a = hand[i],
        b = hand[j]
      if (a.type === "zhong" || b.type === "zhong") continue
      if (a.type === b.type && Math.abs(a.num - b.num) <= 2) s++
    }
  }
  return s
}

// ===== AI 公开信息评估 =====
// 已见牌（弃牌 + 开门副露）缓存：AI 评估高频调用，按牌局签名复用
let visSig = ""
let visMap: Record<string, number> | null = null
export function resetVisibleCache() {
  visSig = ""
  visMap = null
}
function boardVisible(): Record<string, number> {
  let meldTotal = 0
  G.players.forEach((p) => {
    meldTotal += p.melds.length
  })
  let sig = G.discard.length + ":" + meldTotal
  if (sig === visSig && visMap) return visMap
  let v: Record<string, number> = {}
  G.players.forEach((p) =>
    p.melds.forEach((m) =>
      m.ts.forEach((t) => {
        v[Tile.tid(t)] = (v[Tile.tid(t)] || 0) + 1
      }),
    ),
  )
  G.discard.forEach((t) => {
    if (!t.claimed) v[Tile.tid(t)] = (v[Tile.tid(t)] || 0) + 1
  })
  visSig = sig
  visMap = v
  return v
}

// 剩余可用张数：4 - 弃牌/副露已见 - 自己手牌（对手手牌不可见）
function remainingCount(tile: TileType, hand?: TileType[]): number {
  let own = hand ? hand.filter((t) => Tile.tid(t) === Tile.tid(tile)).length : 0
  return Math.max(0, 4 - (boardVisible()[Tile.tid(tile)] || 0) - own)
}

// 给 effectiveShanten 用的剩余数闭包：预计算自己手牌计数，避免 DFS 里反复遍历
function liveRemainFn(hand: TileType[]): (t: TileType) => number {
  let own: Record<string, number> = {}
  hand.forEach((t) => {
    own[Tile.tid(t)] = (own[Tile.tid(t)] || 0) + 1
  })
  let vis = boardVisible()
  return (t: TileType) =>
    Math.max(0, 4 - (vis[Tile.tid(t)] || 0) - (own[Tile.tid(t)] || 0))
}

// 有效进张：摸到后非标距离下降的牌张数（含剩余枚数）
function localEval(
  hand: TileType[],
  melds: Meld[],
): { dist: number; uke: number } {
  let need = 4 - melds.length
  if (need < 0 || hand.length !== need * 3 + 1) return { dist: 8, uke: 0 }
  if (Tile.isTing(hand, melds)) return { dist: 0, uke: 0 }
  let base = Tile.effectiveShanten(hand, melds, liveRemainFn(hand))
  let uke = 0
  let tryTile = (cand: TileType) => {
    let rem = remainingCount(cand, hand)
    if (rem <= 0) return
    let after = [...hand, cand]
    if (Tile.effectiveShanten(after, melds, liveRemainFn(after)) < base)
      uke += rem
  }
  Tile.TT.forEach((type) => {
    for (let n = 1; n <= 9; n++)
      tryTile({ type, num: n, suit: Tile.SN[type], id: n + type })
  })
  tryTile({ type: "zhong", num: 0, suit: "红中", id: "红中" })
  if (uke > 0) return { dist: Math.max(base, 1), uke }
  return { dist: Math.max(base, 2), uke: 0 }
}

// ===== 高级：评估缓存 / 危险模型 / 2-ply 搜索 =====
const HAND_CACHE = new Map<string, EvalResult>()
const HAND_CACHE_MAX = 6000

function handKey(hand: TileType[], melds: Meld[]): string {
  let h = hand
    .map((t) => Tile.tid(t))
    .sort()
    .join(",")
  let m = melds
    .map((x) => x.type + ":" + x.ts.map(Tile.tid).sort().join(","))
    .sort()
    .join("|")
  return h + "#" + m
}

// 本地评估（带缓存）：dist=本地向听距离，uke=进张数（听牌时为听口剩余枚数），wins=听口种类
function evalHand(hand: TileType[], melds: Meld[]): EvalResult {
  let key = handKey(hand, melds)
  let c = HAND_CACHE.get(key)
  if (c) return c
  let res = computeEvalHand(hand, melds)
  if (HAND_CACHE.size >= HAND_CACHE_MAX) HAND_CACHE.clear()
  HAND_CACHE.set(key, res)
  return res
}

function computeEvalHand(hand: TileType[], melds: Meld[]): EvalResult {
  let need = 4 - melds.length
  if (need < 0 || hand.length !== need * 3 + 1)
    return { dist: 8, uke: 0, wins: 0 }
  // 用近似的 localEval 快速评估（2-ply 内层搜索量很大，不在此做精确 drawsForTing）
  let le = localEval(hand, melds)
  if (le.dist === 0) {
    let wins = Tile.winTiles(hand, melds).length
    return { dist: 0, uke: 0, wins }
  }
  return { dist: le.dist, uke: le.uke, wins: 0 }
}

// 单张手牌质量（越大越好）
function evalQuality(e: EvalResult): number {
  return -e.dist * 1000 + e.uke * 8 + e.wins * 200
}

// 14 张手的“最优弃张后”评估
function bestDiscardEval(hand: TileType[], melds: Meld[]): EvalResult {
  let need = 4 - melds.length
  if (hand.length !== need * 3 + 2) return { dist: 8, uke: 0, wins: 0 }
  let best: EvalResult | null = null,
    bestScore = -Infinity,
    seen = new Set<string>()
  for (let i = 0; i < hand.length; i++) {
    let id = Tile.tid(hand[i])
    if (seen.has(id)) continue
    seen.add(id)
    let rest = hand.filter((_, j) => j !== i)
    let e = evalHand(rest, melds)
    let sc = evalQuality(e)
    if (sc > bestScore) {
      bestScore = sc
      best = e
    }
  }
  return best || { dist: 8, uke: 0, wins: 0 }
}

// 对手听牌威胁 0~1（本变体须有副露才能听，副露数是强信号）
function threatOf(i: number): number {
  let p = G.players[i]
  if (G.ting.has(i)) return 1
  let t = p.melds.length * 0.45
  if (p.isD) t += 0.1
  return Math.min(0.9, t)
}

// 某张牌对三家对手的综合危险度 0~1
function dangerOf(pI: number, tile: TileType): number {
  let id = Tile.tid(tile)
  let vis = visibleCount(tile)
  if (vis >= 4) return 0 // 四张全见，不可能再被和
  let d = 0
  for (let i = 0; i < PLAYER_COUNT; i++) {
    if (i === pI) continue
    let th = threatOf(i)
    if (th <= 0) continue
    let p = G.players[i]
    // 本变体无振听：对手打过的牌仍可能被其和（概率略低），不能当绝对安全牌
    let discarded = p.disc.some((t) => Tile.tid(t) === id)
    let nearMeld = p.melds.some((m) =>
      m.ts.some(
        (t) =>
          t.type === tile.type &&
          tile.type !== "zhong" &&
          Math.abs(t.num - tile.num) <= 1,
      ),
    )
    let base = vis >= 3 ? 0.2 : 0.5 // 只剩最后一张时风险很低但非零
    let risk = (base + (nearMeld ? 0.35 : 0)) * (discarded ? 0.4 : 1)
    d += th * Math.min(1, risk)
  }
  return Math.min(1, d / 3)
}

// 攻防切换：默认进攻；仅当离听远、已过中盘且领先时才转守
function hardAttackMode(pI: number, dist: number): boolean {
  if (dist <= 2) return true
  if (G.discard.length < 24) return true
  let p = G.players[pI]
  let maxOther = Math.max(
    ...G.players.filter((_, i) => i !== pI).map((x) => x.score),
  )
  return p.score <= maxOther
}

// 2-ply：下一摸的期望手牌质量（按进张枚数加权，带超时；melds 缺省用场上副露，杠后评估传杠后副露）
function nextDrawEV(
  pI: number,
  hand13: TileType[],
  deadline: number,
  melds?: Meld[],
): number {
  melds = melds || G.players[pI].melds
  let need = 4 - melds.length
  if (hand13.length !== need * 3 + 1)
    return evalQuality(evalHand(hand13, melds))
  let baseSh = Tile.effectiveShanten(hand13, melds, liveRemainFn(hand13))
  let cands: { t: TileType; rem: number }[] = []
  let push = (t: TileType) => {
    let rem = remainingCount(t, hand13)
    if (rem <= 0) return
    let after = [...hand13, t]
    if (Tile.effectiveShanten(after, melds, liveRemainFn(after)) >= baseSh)
      return // 只展开能降向听的进张
    cands.push({ t, rem })
  }
  Tile.TT.forEach((type) => {
    for (let n = 1; n <= 9; n++)
      push({ type, num: n, suit: Tile.SN[type], id: n + type })
  })
  push({ type: "zhong", num: 0, suit: "红中", id: "红中" })
  let sum = 0,
    wsum = 0
  for (let c of cands) {
    if (performance.now() > deadline) break
    let e = bestDiscardEval([...hand13, c.t], melds)
    sum += c.rem * evalQuality(e)
    wsum += c.rem
  }
  return wsum ? sum / wsum : evalQuality(evalHand(hand13, melds))
}

// 高级：2-ply 出牌
export function hardDiscardIndex(pI: number): number {
  let p = G.players[pI]
  let deadline = performance.now() + 40
  // 能听：听牌那一轮的弃张算「听牌点炮」，比黑炮少 1 番，可趁机把手里的危险牌丢出去
  let tingTiles = Tile.handTingDiscards(p.hand, p.melds)
  if (tingTiles.length) {
    let best = tingTiles[0],
      bestScore = -Infinity,
      seen = new Set<string>()
    for (let t of tingTiles) {
      if (seen.has(Tile.tid(t))) continue
      seen.add(Tile.tid(t))
      let i = p.hand.findIndex((x) => Tile.tid(x) === Tile.tid(t))
      let rest = p.hand.filter((_, j) => j !== i)
      let wins = Tile.winTiles(rest, p.melds)
      let rem = wins.reduce((s, w) => s + remainingCount(w, rest), 0)
      let score = rem * 10 + wins.length + dangerOf(pI, t) * 30
      if (score > bestScore) {
        bestScore = score
        best = t
      }
    }
    return p.hand.findIndex((x) => Tile.tid(x) === Tile.tid(best))
  }
  // 候选 1-ply 粗排
  let cands: { i: number; rest: TileType[]; e: EvalResult }[] = [],
    seen = new Set<string>()
  for (let i = 0; i < p.hand.length; i++) {
    let id = Tile.tid(p.hand[i])
    if (seen.has(id)) continue
    seen.add(id)
    let rest = p.hand.filter((_, j) => j !== i)
    cands.push({ i, rest, e: evalHand(rest, p.melds) })
  }
  cands.sort((a, b) => a.e.dist - b.e.dist || b.e.uke - a.e.uke)
  // 自己未听且已有人听牌：此时点炮是黑炮（独付、+2 番），宁可拆牌也不放
  // 三档：无人上听偏激进（safeW 0.1+候选放宽），有人上听偏保守（safeW 4），听牌的是庄家更保守（safeW 8，点庄赢家黑炮独付 8 分）
  let oppTing = false,
    dealerTing = false
  G.ting.forEach((i) => {
    if (i !== pI) {
      oppTing = true
      if (G.players[i].isD) dealerTing = true
    }
  })
  let attack = hardAttackMode(pI, cands[0].e.dist)
  let safeW = attack ? 0.1 : 1.3
  if (oppTing) safeW = Math.max(safeW, 4)
  if (dealerTing) safeW = Math.max(safeW, 8)
  let top = cands.slice(0, oppTing ? cands.length : 8)
  let best = p.hand[top[0].i],
    bestScore = -Infinity
  for (let c of top) {
    let t = p.hand[c.i]
    let score = evalQuality(c.e) - dangerOf(pI, t) * safeW * 500
    if (c.e.dist <= 2 && performance.now() < deadline) {
      score += nextDrawEV(pI, c.rest, deadline) * 0.6
    }
    if (score > bestScore) {
      bestScore = score
      best = t
    }
  }
  return p.hand.findIndex((x) => Tile.tid(x) === Tile.tid(best))
}

// 高级：2-ply 鸣牌评估
function hardClaimOutcome(pI: number, act: ClaimAct): EvalResult | null {
  let res = simulateClaim(pI, act)
  if (!res) return null
  let need = 4 - res.melds.length
  if (res.hand.length !== need * 3 + 2) return null
  return bestDiscardEval(res.hand, res.melds)
}

function evalClaim(pI: number, act: ClaimAct, cur: EvalResult): number {
  if (act.a === "kong") {
    // 明杠也看前后距离：补摸期望质量 - 当前质量；孤张杠/抢摸为正，拆顺刻的坏杠为负
    let res = simulateClaim(pI, act)
    if (!res) return -Infinity
    return (
      nextDrawEV(pI, res.hand, performance.now() + 40, res.melds) -
      evalQuality(cur)
    )
  }
  let out = hardClaimOutcome(pI, act)
  if (!out) return -Infinity
  let q = evalQuality(out) - evalQuality(cur)
  if (act.ting) return 100000 + q // 能听就要；多个可听按 q 排序取最优
  if (out.dist >= cur.dist) return -Infinity // 距离没拉近就是白耗一手，不开门
  return q
}

// 安全度 0~1：现物 + 已见张数。
// 本变体无筋/壁/振听/抢杠概念，故不实现对应标准理论
// ponytail: 安全模型为启发式，若实测点炮率偏高再引入对手听口推断
function tileSafety(pI: number, tile: TileType): number {
  let id = Tile.tid(tile)
  let rivers = 0
  G.players.forEach((p, i) => {
    if (i !== pI && p.disc.some((t) => Tile.tid(t) === id)) rivers++
  })
  let safe = rivers > 0 ? 0.6 + 0.15 * rivers : 0.2
  if (visibleCount(tile) >= 3) safe = 1
  return Math.max(0, Math.min(1, safe))
}

// 对手威胁：副露数 + 已听牌 + 庄家
function opponentThreat(pI: number): number {
  let threat = 0
  G.players.forEach((p, i) => {
    if (i === pI) return
    threat += p.melds.length * 0.6
    if (G.ting.has(i)) threat += 2
    if (p.isD) threat += 0.4
  })
  return threat
}

// 按配置的名次概率取一张（prob=[第1,第2,第3]名概率；名次不足顺延到末位）
function pickRank<T>(ranked: T[], prob?: number[]): T {
  if (ranked.length < 2 || !prob || !prob.length) return ranked[0]
  let r = Math.random(),
    acc = 0,
    idx = 0
  for (let i = 0; i < prob.length; i++) {
    acc += prob[i]
    if (r < acc) {
      idx = i
      break
    }
    idx = i
  }
  return ranked[Math.min(idx, ranked.length - 1)]
}

// 中级：先保听牌，再比有效进张，保留搭子，轻度避炮
export function normalDiscardIndex(pI: number): number {
  let p = G.players[pI]
  let cfg = AI_LEVELS.normal
  let tingTiles = Tile.handTingDiscards(p.hand, p.melds)
  if (tingTiles.length) {
    let scored: { t: TileType; wins: number }[] = []
    tingTiles.forEach((t) => {
      let i = p.hand.findIndex((x) => Tile.tid(x) === Tile.tid(t))
      let wins = Tile.winTiles(
        p.hand.filter((_, j) => j !== i),
        p.melds,
      ).length
      scored.push({ t, wins })
    })
    scored.sort((a, b) => b.wins - a.wins)
    let pick = pickRank(scored, cfg.discardRankProb) // 配置：出牌名次倾向
    return p.hand.findIndex((x) => Tile.tid(x) === Tile.tid(pick.t))
  }
  let threat = opponentThreat(pI)
  let safeW = cfg.defenseWeight * (threat >= 2 ? 2 : 1)
  let seen = new Set<string>(),
    ranked: { t: TileType; score: number }[] = []
  for (let i = 0; i < p.hand.length; i++) {
    let t = p.hand[i],
      id = Tile.tid(t)
    if (seen.has(id)) continue
    seen.add(id)
    let rest = p.hand.filter((_, j) => j !== i)
    let le = localEval(rest, p.melds)
    let zhong = t.type === "zhong" ? 1 : 0
    let score =
      le.uke * 10 -
      le.dist * 1000 +
      connectedness(rest) +
      tileSafety(pI, t) * safeW * 20 -
      zhong * 3 +
      (Math.random() - 0.5) * cfg.randomness * 20
    ranked.push({ t, score })
  }
  ranked.sort((a, b) => b.score - a.score)
  let pick = pickRank(ranked, cfg.discardRankProb) // 配置：出牌名次倾向
  return p.hand.indexOf(pick.t)
}

// 初级：现行一步贪心（听口优先 + 连通度）加随机扰动
export function easyDiscardIndex(pI: number): number {
  let p = G.players[pI]
  let seen = new Set<string>(),
    best = p.hand[0],
    bestScore = -Infinity
  for (let i = 0; i < p.hand.length; i++) {
    let id = Tile.tid(p.hand[i])
    if (seen.has(id)) continue
    seen.add(id)
    let rest = p.hand.filter((_, j) => j !== i)
    let score =
      Tile.winTiles(rest, p.melds).length * 1000 +
      connectedness(rest) +
      (Math.random() - 0.5) * 400
    if (score > bestScore) {
      bestScore = score
      best = p.hand[i]
    }
  }
  return p.hand.indexOf(best)
}

// ===== AI 鸣牌 =====
// 模拟鸣牌后的手牌/副露（仅用于评估，不直接改状态）
function simulateClaim(
  pI: number,
  act: ClaimAct,
): { hand: TileType[]; melds: Meld[] } | null {
  let p = G.players[pI],
    t = G.lastD
  if (!t) return null
  if (act.a === "peng" || act.a === "kong") {
    let want = act.a === "kong" ? 3 : 2
    let used = p.hand.filter((x) => Tile.tid(x) === Tile.tid(t)).slice(0, want)
    if (used.length < want) return null
    return {
      hand: p.hand.filter((x) => !used.includes(x)),
      melds: [
        ...p.melds,
        { type: act.a, ts: [...used, t], claimedId: Tile.tid(t) },
      ],
    }
  }
  if (act.a === "chi") {
    let used: TileType[] = []
    act.d.forEach((n: number) => {
      if (n === t.num) return
      let found = p.hand.find(
        (x) => x.type === t.type && x.num === n && !used.includes(x),
      )
      if (found) used.push(found)
    })
    if (used.length !== 2) return null
    return {
      hand: p.hand.filter((x) => !used.includes(x)),
      melds: [
        ...p.melds,
        { type: "chi", ts: [...used, t], claimedId: Tile.tid(t) },
      ],
    }
  }
  return null
}

// 鸣牌后按本地规则选最优弃张，返回弃张后的向听距离/听口/有效进张
function claimOutcome(
  pI: number,
  act: ClaimAct,
): { dist: number; wins: number; uke: number } | null {
  let res = simulateClaim(pI, act)
  if (!res) return null
  let need = 4 - res.melds.length
  if (res.hand.length !== need * 3 + 2) return null
  let seen = new Set<string>(),
    best: { dist: number; wins: number; uke: number } | null = null,
    bestScore = -Infinity
  for (let i = 0; i < res.hand.length; i++) {
    let id = Tile.tid(res.hand[i])
    if (seen.has(id)) continue
    seen.add(id)
    let rest = res.hand.filter((_, j) => j !== i)
    let le = localEval(rest, res.melds)
    let wins = Tile.winTiles(rest, res.melds).length
    let score = -le.dist * 1000 + wins * 100
    if (score > bestScore) {
      bestScore = score
      best = { dist: le.dist, wins, uke: le.uke }
    }
  }
  return best
}

function bestTingAct(pI: number, acts: ClaimAct[]): ClaimAct {
  let best = acts[0],
    bestScore = -Infinity
  acts.forEach((a) => {
    let out = claimOutcome(pI, a)
    let s = out ? -out.dist * 1000 + out.wins * 100 : 0
    if (s > bestScore) {
      bestScore = s
      best = a
    }
  })
  return best
}

function aiChooseClaimEasy(pI: number, acts: ClaimAct[]): ClaimAct | null {
  let hu = acts.find((a) => a.a === "hu")
  if (hu) return hu
  if (G.ting.has(pI)) return null
  let kong = acts.find((a) => a.a === "kong")
  if (kong) return kong // 有杠必杠
  let peng = acts.find((a) => a.a === "peng")
  if (peng && Math.random() < AI_LEVELS.easy.claimPengRate) return peng
  let chis = acts.filter((a) => a.a === "chi")
  if (chis.length && Math.random() < AI_LEVELS.easy.claimChiRate)
    return chis[Math.floor(Math.random() * chis.length)]
  return null
}

function aiChooseClaimNormal(pI: number, acts: ClaimAct[]): ClaimAct | null {
  let hu = acts.find((a) => a.a === "hu")
  if (hu) return hu
  if (G.ting.has(pI)) return null
  let ting = acts.filter((a) => a.ting)
  if (ting.length) return bestTingAct(pI, ting)
  let kong = acts.find((a) => a.a === "kong")
  if (kong) return kong
  let peng = acts.find((a) => a.a === "peng")
  if (peng && Math.random() < AI_LEVELS.normal.claimPengRate) return peng
  let chis = acts.filter((a) => a.a === "chi")
  if (chis.length) {
    let base = handTingDistance(G.players[pI].hand, G.players[pI].melds)
    let gain = chis.find((a) => {
      let o = claimOutcome(pI, a)
      return o && o.dist <= base
    })
    if (gain && Math.random() < AI_LEVELS.normal.claimChiRate) return gain
  }
  return null
}

function aiChooseClaimHard(pI: number, acts: ClaimAct[]): ClaimAct | null {
  let hu = acts.find((a) => a.a === "hu")
  if (hu) return hu
  if (G.ting.has(pI)) return null
  let p = G.players[pI]
  let cur = evalHand(p.hand, p.melds)
  let scored = acts.map((a) => ({ a, s: evalClaim(pI, a, cur) }))
  scored.sort((x, y) => y.s - x.s)
  // 只在正收益（或能上听，evalClaim 已加 100000）时鸣牌：不急于开门、不空耗吃碰
  if (scored.length && scored[0].s > 0) return scored[0].a
  return null
}

export function aiChooseClaim(pI: number, acts: ClaimAct[]): ClaimAct | null {
  let lvl = aiLevelOf(pI)
  if (lvl === "easy") return aiChooseClaimEasy(pI, acts)
  if (lvl === "hard") return aiChooseClaimHard(pI, acts)
  return aiChooseClaimNormal(pI, acts)
}

// ===== AI 自身杠 =====
function simulateSelfKong(
  p: Player,
  act: ClaimAct,
): { hand: TileType[]; melds: Meld[] } | null {
  if (act.a === "selfKong") {
    let counts: Record<string, number> = {}
    p.hand.forEach((t) => {
      counts[Tile.tid(t)] = (counts[Tile.tid(t)] || 0) + 1
    })
    let id = Object.keys(counts).find((k) => counts[k] >= 4)
    if (!id) return null
    let used: TileType[] = [],
      hand: TileType[] = []
    p.hand.forEach((t) => {
      if (Tile.tid(t) === id && used.length < 4) used.push(t)
      else hand.push(t)
    })
    return { hand, melds: [...p.melds, { type: "kong", ts: used }] }
  }
  if (act.a === "buKong") {
    let m = p.melds.find(
      (mm) => mm.type === "peng" && Tile.tid(mm.ts[0]) === Tile.tid(act.d),
    )
    if (!m) return null
    let hand: TileType[] = [],
      removed = false
    p.hand.forEach((t) => {
      if (!removed && Tile.tid(t) === Tile.tid(act.d)) removed = true
      else hand.push(t)
    })
    if (!removed) return null
    let melds = p.melds.map((mm) =>
      mm === m ? { ...mm, type: "kong", ts: [...mm.ts, act.d] } : mm,
    )
    return { hand, melds }
  }
  return null
}

export function evalSelfKong(pI: number, act: ClaimAct): number {
  let p = G.players[pI]
  let res = simulateSelfKong(p, act)
  if (!res) return -1
  // 自杠同样看前后距离：补摸期望质量 - 当前最优打后质量
  let cur = evalQuality(bestDiscardEval(p.hand, p.melds))
  return nextDrawEV(pI, res.hand, performance.now() + 40, res.melds) - cur
}
