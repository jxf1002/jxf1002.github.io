import { PN, PLAYER_COUNT, HUMAN } from "./constants.ts"
import * as Tile from "./tile.ts"
import * as AI from "./ai.ts"
import { AI_LEVELS } from "./ai.ts"
import { G } from "./state.ts"
export { G }
import * as Score from "./score.ts"
import type {
  ClaimAct,
  Meld,
  PerStat,
  Player,
  SimRow,
  Stats,
  Tile as TileType,
  UIHooks,
} from "./types.ts"

// 全局节拍（毫秒）：所有动作间隔统一走它，随时可调；轮到玩家时自然阻塞不等
export let TICK = 1000

// 牌墙预留（参数可改）：牌尾死墙只给杠补牌/宝牌；死墙之前的 FEN_TILES 张为分章
export const DEAD_WALL = 8 // 死墙张数
export const FEN_TILES = 4 // 分章张数
const AI_LEVEL_KEY = "mahjong_aiLevel"

// 无头模拟开关（仅测试用）：把异步调度收进队列，由 simulateRound 同步驱动
let SIM_MODE = false
let simQueue: (() => void)[] = []
let simFirstTing: number | null = null
let simTingSeen: Partial<Record<number, number>> = {}

function freshStats(): Stats {
  return {
    hands: 0,
    rotations: 0,
    draw: 0,
    per: [0, 1, 2, 3].map(() => ({
      zimo: 0,
      ron: 0,
      heipao: 0,
      baopi: 0,
      dianpao: 0,
      dianhei: 0,
    })),
  }
}

function normPer(p: Partial<PerStat>): PerStat {
  return {
    zimo: p.zimo || 0,
    ron: p.ron || 0,
    heipao: p.heipao || 0,
    baopi: p.baopi || 0,
    dianpao: p.dianpao || 0,
    dianhei: p.dianhei || 0,
  }
}

let uiCB: UIHooks | null = null
export function setUI(cb: UIHooks) {
  uiCB = cb
}
function ui<K extends keyof UIHooks>(
  fn: K,
  ...args: Parameters<NonNullable<UIHooks[K]>>
) {
  const cb = uiCB?.[fn] as
    ((...a: Parameters<NonNullable<UIHooks[K]>>) => void) | undefined
  cb?.(...args)
  if (fn === "update") saveState()
}

// 结算后待执行的下一局动作：回主页暂停后点「继续游戏」仍可接力
let pendingNext: (() => void) | null = null

// 电脑动作汉字提示：仅电脑玩家；托管时东家也显示
function showAct(pI: number, text: string) {
  if (SIM_MODE || (pI === HUMAN && !G.auto)) return
  ui("actFx", pI, text)
}

// ===== 存档：localStorage 实时记录，关页面后可继续 =====
const SAVE_KEY = "mahjong_save_v2"

export function saveState() {
  try {
    if (G.demo || !G.players.length) return
    if (G.over) {
      // 本局已结算：只留积分与统计。刷新后从大厅开新一局，不再回到已结束的手牌
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({
          over: true,
          dealer: G.dealer,
          stats: G.stats,
          scores: G.players.map((p) => p.score),
        }),
      )
      return
    }
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        deck: G.deck,
        dead: G.dead,
        fen: G.fen,
        fenN: G.fenN,
        fenStart: G.fenStart,
        players: G.players,
        curP: G.curP,
        dealer: G.dealer,
        discard: G.discard,
        wall: G.wall,
        baopi: G.baopi,
        bpR: G.bpR,
        ting: [...G.ting],
        winner: G.winner,
        lastD: G.lastD,
        lastDB: G.lastDB,
        lastDraw: G.lastDraw,
        lastFrom: G.lastFrom,
        phase: G.phase,
        pending: G.pending,
        passed: [...G.passed],
        tingIntent: G.tingIntent,
        selfHu: G.selfHu,
        token: G.token,
        playing: true,
        stats: G.stats,
        forceTing: G.forceTing,
        aiLevel: G.aiLevel,
      }),
    )
  } catch (e) {
    /* 忽略存储异常 */
  }
}

export function hasSave() {
  try {
    return !!localStorage.getItem(SAVE_KEY)
  } catch (e) {
    return false
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch (e) {
    /* ignore */
  }
}

// ===== AI 难度读写 =====
export function getAILevel(pI?: number): string {
  if (pI === undefined) return G.aiLevel || "normal"
  return AI.aiLevelOf(pI)
}

export function setAILevel(level: string): boolean {
  if (!AI_LEVELS[level]) return false
  G.aiLevel = level
  try {
    localStorage.setItem(AI_LEVEL_KEY, level)
  } catch (e) {
    /* ignore */
  }
  return true
}

export function loadAILevel() {
  try {
    let l = localStorage.getItem(AI_LEVEL_KEY)
    if (AI_LEVELS[l as string]) G.aiLevel = l as string
  } catch (e) {
    /* ignore */
  }
}

// ===== 游戏节奏：统一动作节拍，三档可调 =====
const PACE_KEY = "mahjong_pace"
export const PACE_MS = [500, 1000, 1500] // 快/中/慢
let pace = 1
export function getPace(): number {
  return pace
}
export function setPace(i: number): boolean {
  i = Number(i)
  if (!(i >= 0 && i < PACE_MS.length)) return false
  pace = i
  TICK = PACE_MS[i]
  try {
    localStorage.setItem(PACE_KEY, String(i))
  } catch (e) {
    /* ignore */
  }
  return true
}
export function loadPace() {
  try {
    let raw = localStorage.getItem(PACE_KEY)
    if (raw === null) return
    let v = Number(raw)
    if (v >= 0 && v < PACE_MS.length) {
      pace = v
      TICK = PACE_MS[v]
    }
  } catch (e) {
    /* ignore */
  }
}

// ===== 托管：东家交给最强 AI 自动打 =====
export function getAuto() {
  return !!G.auto
}

export function setAuto(on: boolean) {
  G.auto = !!on
  ui("update")
  if (G.auto) autoResume()
}

// 开启托管或续局时，立即接管东家当前等待的操作
function autoResume() {
  if (!G.auto || SIM_MODE || !G.playing || G.over) return
  if (G.selfHu) {
    G.selfHu = false
    win(HUMAN, null, true)
    return
  }
  if (G.phase === "claim" && G.pending.includes(HUMAN)) {
    let act = AI.aiChooseClaim(HUMAN, claimActions(HUMAN))
    if (act) executeClaim(HUMAN, act)
    else {
      G.pending = []
      G.passed.add(HUMAN)
      resolveClaims()
    }
    return
  }
  if (G.phase === "discard" && G.curP === HUMAN && !G.lock)
    scheduleAIDiscard(HUMAN)
}

export function restore() {
  try {
    let raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return false
    let d = JSON.parse(raw)
    if (d.over) {
      // 上局已结算的存档：只恢复积分与统计，回大厅，继续则开新一局
      G.dealer = Number.isInteger(d.dealer) ? d.dealer : 0
      G.players = []
      for (let i = 0; i < PLAYER_COUNT; i++) {
        let p = mkPlayer(i)
        p.score = (d.scores && d.scores[i]) || 0
        p.isD = i === G.dealer
        G.players.push(p)
      }
      G.stats = d.stats
        ? {
            hands: d.stats.hands || 0,
            rotations: d.stats.rotations || 0,
            draw: d.stats.draw || 0,
            per: (d.stats.per || []).map(normPer),
          }
        : freshStats()
      while (G.stats.per.length < 4) G.stats.per.push(normPer({}))
      G.deck = []
      G.dead = []
      G.fen = []
      G.fenN = 0
      G.fenStart = 0
      G.discard = []
      G.wall = 0
      G.baopi = null
      G.bpR = false
      AI.resetVisibleCache()
      G.ting = new Set()
      G.winner = null
      G.lastD = null
      G.lastDB = -1
      G.lastDraw = null
      G.lastFrom = ""
      G.phase = "discard"
      G.pending = []
      G.passed = new Set()
      G.tingIntent = false
      G.selfHu = false
      G.forceTing = false
      G.lock = false
      G.token = (d.token || 0) + 1
      G.playing = false
      G.over = true
      pendingNext = () => startRound(false)
      return true
    }
    if (!d.players || !d.players.length) return false
    G.deck = d.deck
    G.dead = d.dead || []
    G.fen = d.fen || []
    G.fenN = d.fenN || 0
    G.fenStart = d.fenStart || 0
    G.players = d.players
    G.curP = d.curP
    G.dealer = d.dealer
    G.discard = d.discard
    G.wall = d.wall
    G.baopi = d.baopi
    G.bpR = d.bpR
    AI.resetVisibleCache() // 恢复存档时重置已见牌缓存
    G.ting = new Set(d.ting)
    G.winner = d.winner
    G.lastD = d.lastD
    G.lastDB = d.lastDB
    G.lastDraw = d.lastDraw
    G.lastFrom = d.lastFrom
    G.phase = d.phase
    G.pending = d.pending || []
    G.passed = new Set(d.passed || [])
    G.tingIntent = !!d.tingIntent
    G.selfHu = !!d.selfHu
    G.forceTing = !!d.forceTing
    G.token = (d.token || 0) + 1
    G.aiLevel = AI_LEVELS[d.aiLevel] ? d.aiLevel : "normal"
    G.lock = false
    G.over = false
    G.playing = false
    G.stats = d.stats
      ? {
          hands: d.stats.hands || 0,
          rotations: d.stats.rotations || 0,
          draw: d.stats.draw || 0,
          per: (d.stats.per || []).map(normPer),
        }
      : freshStats()
    while (G.stats.per.length < 4) G.stats.per.push(normPer({}))
    return true
  } catch (e) {
    return false
  }
}

// 回主页面：冻结牌局、保留存档、回大厅
export function toLobby() {
  if (!G.players.length) {
    G.playing = false
    ui("update")
    return
  }
  G.playing = false
  G.lock = true
  G.token = (G.token || 0) + 1 // 作废所有待执行的定时器
  saveState() // 已结算则落盘「本局结束」快照，刷新后开新一局
  ui("update")
}

// 大厅继续游戏：恢复冻结前的牌局；若上一局已结算，则接力开始下一局
export function resumeGame() {
  if (!G.players.length) return
  if (G.over) {
    if (pendingNext) {
      let f = pendingNext
      pendingNext = null
      G.playing = true
      f()
    }
    return
  }
  G.playing = true
  G.token = (G.token || 0) + 1
  G.lock = false
  ui("update")
  resume()
}

function resume() {
  if (G.over) return
  if (G.selfHu) {
    if (G.auto) autoResume()
    return
  } // 等待玩家确认自摸
  if (G.phase === "fen") {
    scheduleFenStep()
  } else if (G.phase === "claim") {
    if (G.pending.includes(HUMAN)) {
      if (G.auto) autoResume()
      return
    }
    let token = G.token
    scheduleTask(() => {
      if (G.token === token && !G.over) resolveClaims()
    }, TICK)
  } else if (G.phase === "discard") {
    if (G.curP === HUMAN) {
      if (G.auto) {
        scheduleAIDiscard(HUMAN)
      } else if (G.forceTing) {
        // 上听吃状态恢复，让用户选择出牌
        ui("update")
      } else if (G.ting.has(HUMAN)) {
        G.lock = true
        let token = G.token
        scheduleTask(() => {
          if (G.token !== token || G.over) {
            G.lock = false
            return
          }
          humanAutoDiscard()
        }, TICK)
      }
    } else {
      scheduleAIDiscard(G.curP)
    }
  }
}

// ===== 新手指引演示局：固定牌面专供讲解，不写存档，退出时凭存档恢复真牌局 =====
export function startDemo() {
  G.token = (G.token || 0) + 1
  let T = (type: string, num = 0): TileType =>
    type === "zhong"
      ? { type, num: 0, suit: "红中", id: "红中" }
      : { type, num, suit: Tile.SN[type], id: num + type }
  let lastD = T("wan", 3)
  G.players = [
    {
      index: 0,
      name: PN[0],
      isD: true,
      score: 120,
      hand: [
        T("wan", 6),
        T("wan", 7),
        T("wan", 8),
        T("tiao", 2),
        T("tiao", 5),
        T("tiao", 7),
        T("tong", 3),
        T("tong", 6),
        T("tong", 8),
        T("wan", 3),
        T("wan", 3),
        T("zhong"),
        T("zhong"),
      ],
      melds: [
        {
          type: "peng",
          ts: [T("tiao", 9), T("tiao", 9), T("tiao", 9)],
          claimedId: "9tiao",
        },
      ],
      disc: [T("tiao", 1), T("wan", 9)],
    },
    {
      index: 1,
      name: PN[1],
      isD: false,
      score: -30,
      hand: [
        T("wan", 1),
        T("wan", 2),
        T("wan", 4),
        T("tiao", 3),
        T("tiao", 6),
        T("tiao", 8),
        T("tong", 2),
        T("tong", 5),
        T("tong", 7),
        T("tong", 9),
        T("wan", 5),
        T("tiao", 9),
        T("zhong"),
      ],
      melds: [
        {
          type: "chi",
          ts: [T("tiao", 4), T("tiao", 5), T("tiao", 6)],
          claimedId: "5tiao",
        },
      ],
      disc: [T("tiao", 1), T("wan", 9)],
    },
    {
      index: 2,
      name: PN[2],
      isD: false,
      score: -40,
      hand: [
        T("wan", 2),
        T("wan", 5),
        T("wan", 7),
        T("tiao", 1),
        T("tiao", 4),
        T("tiao", 8),
        T("tong", 1),
        T("tong", 4),
        T("tong", 6),
        T("tong", 9),
        T("wan", 8),
        T("tiao", 2),
        T("tiao", 7),
      ],
      melds: [],
      disc: [T("tong", 2)],
    },
    {
      index: 3,
      name: PN[3],
      isD: false,
      score: -50,
      hand: [
        T("wan", 1),
        T("wan", 4),
        T("wan", 6),
        T("tiao", 3),
        T("tiao", 6),
        T("tiao", 9),
        T("tong", 1),
        T("tong", 5),
        T("tong", 7),
        T("wan", 2),
        T("wan", 7),
        T("tiao", 8),
        T("tong", 4),
      ],
      melds: [],
      disc: [T("tiao", 5), lastD],
    },
  ]
  G.deck = []
  G.discard = G.players.flatMap((p) => p.disc)
  G.dead = []
  G.fen = []
  G.fenN = 0
  G.curP = 3
  G.dealer = 0
  G.wall = 38
  G.baopi = null
  G.bpR = false
  G.ting = new Set()
  G.over = false
  G.winner = null
  G.lastD = lastD
  G.lastDB = 3
  G.lastDraw = null
  G.lastFrom = ""
  G.phase = "claim"
  G.pending = [HUMAN]
  G.passed = new Set()
  G.lock = true
  G.tingIntent = false
  G.selfHu = false
  G.forceTing = false
  G.playing = true
  G.auto = false
  G.demo = true
  G.stats = freshStats()
  addTing(1)
  ui("update")
}

// 退出演示：凭存档恢复真牌局；无存档则回空大厅
export function endDemo() {
  G.demo = false
  pendingNext = null
  G.token = (G.token || 0) + 1
  G.lock = false
  G.pending = []
  if (restore()) return true
  G.players = []
  G.discard = []
  G.playing = false
  G.over = false
  G.ting = new Set()
  G.lastD = null
  G.lastDB = -1
  G.stats = freshStats()
  return false
}

function mkPlayer(i: number): Player {
  return {
    index: i,
    hand: [],
    melds: [],
    disc: [],
    name: PN[i],
    isD: false,
    score: 0,
  }
}

function sortHand(p: Player) {
  p.hand.sort((a, b) => {
    let ta = a.type === "zhong" ? 99 : Tile.TT.indexOf(a.type)
    let tb = b.type === "zhong" ? 99 : Tile.TT.indexOf(b.type)
    if (ta !== tb) return ta - tb
    return a.num - b.num
  })
}

function takeFromHand(p: Player, tile: TileType, n: number): TileType[] {
  let used: TileType[] = []
  for (let i = p.hand.length - 1; i >= 0 && used.length < n; i--) {
    if (Tile.tid(p.hand[i]) === Tile.tid(tile))
      used.push(p.hand.splice(i, 1)[0])
  }
  return used
}

export function init() {
  clearSave()
  G.dealer = 0
  G.playing = true
  G.stats = freshStats()
  startRound(true)
}

function buildSummary() {
  let s = G.stats || freshStats()
  let tot = { zimo: 0, ron: 0, heipao: 0, baopi: 0, dianpao: 0, dianhei: 0 }
  ;(s.per || []).forEach((p) => {
    p = normPer(p)
    tot.zimo += p.zimo
    tot.ron += p.ron
    tot.heipao += p.heipao
    tot.baopi += p.baopi
    tot.dianpao += p.dianpao
    tot.dianhei += p.dianhei
  })
  return {
    hands: s.hands,
    rotations: s.rotations,
    draw: s.draw,
    zimo: tot.zimo,
    ron: tot.ron,
    heipao: tot.heipao,
    baopi: tot.baopi,
    dianpao: tot.dianpao,
    dianhei: tot.dianhei,
    hu: tot.zimo + tot.ron,
    scores: G.players.map((p, i) => ({
      name: p.name,
      me: i === HUMAN,
      isD: p.isD,
      score: p.score,
      stat: normPer((s.per && s.per[i]) || {}),
    })),
  }
}

// 大厅查看战绩：只展示，不结束牌局
export function showStats() {
  if (!G.players.length) return
  ui("showSummary", buildSummary())
}

// 结束整局，返回统计并弹出结算
export function endGame() {
  if (!G.playing) return
  G.playing = false
  G.over = true // 冻结牌局
  G.lock = true
  G.token = (G.token || 0) + 1 // 作废所有待执行的定时器
  clearSave()
  ui("update")
  ui("showSummary", buildSummary())
}

function startRound(resetScores: boolean) {
  pendingNext = null
  let scores = resetScores ? [0, 0, 0, 0] : G.players.map((p) => p.score)

  if (G.stats) G.stats.hands++

  G.deck = Tile.shuffle(Tile.mkDeck())
  G.players = []
  for (let i = 0; i < PLAYER_COUNT; i++) {
    let p = mkPlayer(i)
    p.score = scores[i] || 0
    p.isD = i === G.dealer
    G.players.push(p)
  }
  G.curP = G.dealer
  G.discard = []
  G.baopi = null
  G.bpR = false
  G.ting = new Set()
  AI.resetVisibleCache() // 新一局重置已见牌缓存
  G.over = false
  G.winner = null
  G.lastD = null
  G.lastDB = -1
  G.lastDraw = null
  G.lastFrom = ""
  G.phase = "discard"
  G.pending = []
  G.passed = new Set()
  G.lock = false
  G.tingIntent = false
  G.selfHu = false
  G.forceTing = false
  G.token = (G.token || 0) + 1

  for (let r = 0; r < 13; r++) {
    for (let p = 0; p < PLAYER_COUNT; p++) G.players[p].hand.push(G.deck.pop()!)
  }
  G.players[G.dealer].hand.push(G.deck.pop()!)
  // 预留牌尾：死墙（杠补/宝牌用）与分章，正常摸牌只用到活牌墙
  G.dead = G.deck.splice(0, DEAD_WALL)
  G.fen = G.deck.splice(0, FEN_TILES)
  G.fenN = 0
  G.fenStart = 0
  G.wall = G.deck.length
  G.players.forEach(sortHand)

  G.players.forEach((p, i) => {
    if (i === HUMAN) return
    if (p.hand.length === 13 && Tile.isTing(p.hand, p.melds)) addTing(i)
  })

  ui("update")
  ui("addLog", "新一局开始，庄家：" + G.players[G.dealer].name)

  if (
    G.ting.has(G.dealer) &&
    Tile.canWin(G.players[G.dealer].hand, G.players[G.dealer].melds)
  ) {
    let token = G.token
    scheduleTask(() => {
      if (G.token === token && !G.over) win(G.dealer, null, true)
    }, TICK)
  } else if (G.dealer !== HUMAN) {
    scheduleAIDiscard(G.dealer)
  } else if (G.auto) {
    scheduleAIDiscard(G.dealer)
  }
}

function addTing(i: number) {
  if (G.ting.has(i)) return
  let m = G.players[i].melds.length
  if (m < 1 || m >= 4) return // 门前清不能听牌；手把一(4副露)不能听牌
  G.ting.add(i)
  if (SIM_MODE && simFirstTing === null) simFirstTing = G.discard.length
  // 仅测试用：记下每家每把首次上听的巡数（SIM_MODE 生产环境恒为 false，走不到这里）
  if (SIM_MODE && !(i in simTingSeen)) simTingSeen[i] = G.discard.length
  ui("addLog", G.players[i].name + " 听牌")
  revealBP()
}

// 宝牌：从牌尾取一张并取走（死墙优先，空则回退活牌墙）；取走的物理张不再可摸
function takeBaopi(): TileType | null {
  if (G.dead.length) return G.dead.pop()!
  if (G.deck.length) {
    G.wall--
    return G.deck.pop()!
  }
  return null
}

function revealBP() {
  if (G.bpR) return
  let t = takeBaopi()
  if (!t) return
  G.baopi = t
  G.bpR = true
  ui("addLog", "宝牌翻开：" + Tile.label(G.baopi))
  ui("update")
}

// 宝牌若已见三张则换宝（同样从牌尾取一张并取走）
function ensureBaopi() {
  if (!G.bpR || !G.baopi) return
  if (AI.visibleCount(G.baopi) < 3) return
  let t = takeBaopi()
  if (!t) return
  G.baopi = t
  ui("addLog", "宝牌已见三张，换宝为 " + Tile.label(G.baopi))
  ui("update")
}

function drawWall(pI: number): TileType | null {
  if (!G.deck.length) return null
  let t = G.deck.pop()!
  G.wall--
  G.players[pI].hand.push(t)
  G.lastDraw = t
  G.lastFrom = "wall"
  return t
}

// 杠补牌：从死墙取，死墙空则回退活牌墙；均空返回 null
function drawDead(pI: number): TileType | null {
  let t: TileType
  if (G.dead.length) t = G.dead.pop()!
  else if (G.deck.length) {
    t = G.deck.pop()!
    G.wall--
  } else return null
  G.players[pI].hand.push(t)
  G.lastDraw = t
  G.lastFrom = "wall"
  return t
}

// ===== 分章：活牌墙摸完后，四家依次各摸一张、不打出，能和则和，否则流局 =====
function startFen() {
  if (G.over) return
  G.phase = "fen"
  G.fenStart = G.curP % PLAYER_COUNT
  G.fenN = 0
  G.selfHu = false
  G.pending = []
  G.lock = false
  G.tingIntent = false
  G.forceTing = false
  ui("addLog", "活牌墙摸完，进入分章")
  ui("update")
  scheduleFenStep()
}

function scheduleFenStep() {
  let token = G.token
  scheduleTask(() => {
    if (G.token === token && !G.over && G.phase === "fen") fenStep()
  }, TICK)
}

function fenStep() {
  if (G.over || G.phase !== "fen") return
  if (G.fenN >= FEN_TILES || (!G.fen.length && !G.deck.length)) {
    endDraw()
    return
  }
  let pI = (G.fenStart + G.fenN) % PLAYER_COUNT
  G.curP = pI
  let t: TileType
  if (G.fen.length) t = G.fen.pop()!
  else {
    t = G.deck.pop()!
    G.wall--
  } // 兜底：分章不足时用活墙
  G.players[pI].hand.push(t)
  G.lastDraw = t
  G.lastFrom = "fen"
  G.fenN++

  // 分章只摸不打，须已听牌才能和（与正常自摸一致）
  let canSelfHu = false
  if (G.ting.has(pI)) {
    if (G.bpR && G.baopi && Tile.tid(t) === Tile.tid(G.baopi)) canSelfHu = true
    else if (Tile.canWin(G.players[pI].hand, G.players[pI].melds))
      canSelfHu = true
  }
  ui("update")

  if (canSelfHu) {
    if (pI === HUMAN) {
      if (SIM_MODE || G.auto) {
        win(pI, null, true)
        return
      }
      G.selfHu = true // 只弹「和」，等玩家点
      ui("update")
      return
    }
    let token = G.token
    scheduleTask(() => {
      if (G.token === token && !G.over) win(pI, null, true)
    }, TICK)
    return
  }
  scheduleFenStep()
}

function advanceTurn() {
  if (G.over) return
  G.lock = false // 新回合解锁；轮到自己时可直接操作
  G.curP = (G.curP + 1) % PLAYER_COUNT
  let pI = G.curP
  let drawn = drawWall(pI)
  if (!drawn) {
    startFen()
    return
  }

  G.selfHu = false
  // 听牌后自摸到宝牌：视为可胡；是否胡由玩家决定
  let canSelfHu = false
  if (G.ting.has(pI)) {
    if (G.bpR && G.baopi && Tile.tid(drawn) === Tile.tid(G.baopi))
      canSelfHu = true
    else if (Tile.canWin(G.players[pI].hand, G.players[pI].melds))
      canSelfHu = true
  }

  if (canSelfHu) {
    if (pI === HUMAN) {
      if (SIM_MODE || G.auto) {
        win(pI, null, true)
        return
      }
      // 等玩家确认是否胡牌
      G.selfHu = true
      G.phase = "discard"
      G.pending = []
      ui("update")
      return
    }
    // 电脑自摸：空1拍再结算，避免“一出牌下家就胡”没有节奏
    G.lock = true
    ui("update")
    let token = G.token
    scheduleTask(() => {
      if (G.token === token && !G.over) win(pI, null, true)
    }, TICK)
    return
  }

  G.phase = "discard"
  G.pending = []
  G.tingIntent = false
  ui("update")

  if (pI === HUMAN) {
    if (SIM_MODE) {
      aiDiscard(HUMAN)
      return
    }
    if (G.auto) {
      scheduleAIDiscard(HUMAN)
      return
    }
    if (G.ting.has(pI)) {
      G.lock = true
      let token = G.token
      scheduleTask(() => {
        if (G.token !== token || G.over) {
          G.lock = false
          return
        }
        humanAutoDiscard()
      }, TICK)
    }
  } else {
    scheduleAIDiscard(pI)
  }
}

function humanAutoDiscard() {
  G.lock = false
  if (G.over || G.phase !== "discard" || G.curP !== HUMAN) return
  let p = G.players[HUMAN]
  if (!p.hand.length) return
  doDiscard(HUMAN, p.hand.length - 1)
}

export function handleDiscard(idx: number) {
  if (
    !G.playing ||
    G.over ||
    G.lock ||
    G.selfHu ||
    G.auto ||
    G.phase !== "discard" ||
    G.curP !== HUMAN
  )
    return
  // 点了听牌（或上听吃）后只能打出听牌张，防止错误操作
  if (G.forceTing || G.tingIntent) {
    let p = G.players[HUMAN]
    if (!isTingDiscard(p.hand, p.melds, p.hand[idx])) return
  }
  doDiscard(HUMAN, idx)
}

function doDiscard(pI: number, idx: number) {
  if (G.over) return
  let p = G.players[pI]
  let t = p.hand[idx]
  if (!t) return
  // 本地规则：打出后不断幺九（手牌加副露须保留幺九）才能上听，人类与 AI 一致
  let tingOk = isTingDiscard(p.hand, p.melds, t)

  p.hand.splice(idx, 1)
  sortHand(p)
  p.disc.push(t)
  G.discard.push(t)
  G.lastD = t
  G.lastDB = pI
  G.lastDraw = null // 打出后新摸标记清除
  ui("addLog", p.name + " 打出 " + Tile.label(t))
  ensureBaopi()

  let wasTing = G.ting.has(pI)
  if (pI === HUMAN && !SIM_MODE && !G.auto) {
    // 人类：点了「听牌」或上听吃强制听牌，且打出的确实是合法听牌张，才生效
    if ((G.tingIntent || G.forceTing) && tingOk) {
      addTing(pI)
      if (!wasTing && G.ting.has(pI)) t.tingDiscard = true
    }
  } else if (tingOk) {
    addTing(pI)
    // 仅“首次听牌”打出的这张标注，之后维持听牌的弃牌用正常颜色
    if (!wasTing && G.ting.has(pI)) t.tingDiscard = true
  }
  // 仅“打出上听牌”这一刻提示「听」（电脑；托管时东家也算）
  if (!wasTing && G.ting.has(pI)) showAct(pI, "听")
  G.tingIntent = false
  G.forceTing = false

  G.passed = new Set()
  let hasClaim = false
  for (let i = 0; i < PLAYER_COUNT; i++) {
    if (i === pI) continue
    if (claimActions(i).length > 0) {
      hasClaim = true
      break
    }
  }

  if (hasClaim) G.phase = "claim"
  else G.lock = true // 等待期间锁住操作，防止重复出牌

  // 出牌先进牌河并立即刷新，再空1拍等下家抓牌/吃碰副露
  ui("update")

  let token = G.token
  if (hasClaim) {
    scheduleTask(() => {
      if (G.token === token && !G.over) resolveClaims()
    }, TICK)
  } else {
    scheduleTask(() => {
      if (G.token === token && !G.over) advanceTurn()
    }, TICK)
  }
}

function canPeng(pI: number) {
  return (
    G.players[pI].hand.filter((t) => Tile.tid(t) === Tile.tid(G.lastD!))
      .length >= 2
  )
}
function canKong(pI: number) {
  return (
    G.players[pI].hand.filter((t) => Tile.tid(t) === Tile.tid(G.lastD!))
      .length >= 3
  )
}
function chiOpts(pI: number, t: TileType): number[][] {
  if (t.type === "zhong") return []
  let h = G.players[pI].hand,
    o: number[][] = []
  let has = (n: number) => h.some((x) => x.type === t.type && x.num === n)
  if (t.num >= 2 && t.num <= 8 && has(t.num - 1) && has(t.num + 1))
    o.push([t.num - 1, t.num, t.num + 1])
  if (t.num >= 3 && has(t.num - 2) && has(t.num - 1))
    o.push([t.num - 2, t.num - 1, t.num])
  if (t.num <= 7 && has(t.num + 1) && has(t.num + 2))
    o.push([t.num, t.num + 1, t.num + 2])
  return o
}

export function claimActions(pI: number): ClaimAct[] {
  let t = G.lastD
  if (!t || G.lastDB === pI) return []
  let p = G.players[pI]
  let acts: ClaimAct[] = []
  if (G.ting.has(pI) && Tile.canWin([...p.hand, t], p.melds))
    acts.push({ a: "hu", l: "和" })
  // 听牌后不能再吃碰杠；已有 3 副露时再鸣牌即成手把一（无法听牌），禁止吃碰杠
  if (p.melds.length < 3 && !G.ting.has(pI)) {
    let isUpper = G.lastDB === (pI + PLAYER_COUNT - 1) % PLAYER_COUNT
    chiOpts(pI, t)
      .sort((a, b) => a[0] - b[0])
      .forEach((opt) => {
        let leads = chiLeadsToTing(pI, t, opt)
        if (isUpper) {
          // 吃上家为正常吃牌，是否听牌由玩家决定；但吃完能听时按「上听」优先于碰杠
          acts.push({
            a: "chi",
            l: "吃 " + opt.join("-") + t.suit + (leads ? "·听" : ""),
            d: opt,
            ting: leads,
          })
        } else if (leads) {
          // 上听吃：非上家也能吃，吃完强制听牌
          acts.push({
            a: "chi",
            l: "吃 " + opt.join("-") + t.suit + "·听",
            d: opt,
            ting: true,
          })
        }
      })
    if (canPeng(pI)) {
      // 碰后也能通过打一张进入听牌时标注，便于玩家在吃/碰之间选择
      let leads = pengLeadsToTing(pI, t)
      acts.push({ a: "peng", l: "碰" + (leads ? "·听" : ""), ting: leads })
    }
    if (canKong(pI)) acts.push({ a: "kong", l: "杠" })
  }
  return acts
}

// 吃完后能否通过打一张进入听牌
function chiLeadsToTing(pI: number, t: TileType, opt: number[]) {
  let p = G.players[pI]
  let used: TileType[] = [],
    ok = true
  opt.forEach((n) => {
    if (n !== t.num) {
      let found = p.hand.find(
        (x) => x.type === t.type && x.num === n && !used.includes(x),
      )
      if (found) used.push(found)
      else ok = false
    }
  })
  if (!ok || used.length !== 2) return false
  let newHand = p.hand.filter((x) => !used.includes(x))
  let newMelds = [
    ...p.melds,
    { type: "chi", ts: [...used, t], claimedId: Tile.tid(t) },
  ]
  return Tile.handTingDiscards(newHand, newMelds).length > 0
}

// 碰后能否通过打一张进入听牌
function pengLeadsToTing(pI: number, t: TileType) {
  let p = G.players[pI]
  let used = p.hand.filter((x) => Tile.tid(x) === Tile.tid(t)).slice(0, 2)
  if (used.length !== 2) return false
  let newHand = p.hand.filter((x) => !used.includes(x))
  let newMelds = [
    ...p.melds,
    { type: "peng", ts: [...used, t], claimedId: Tile.tid(t) },
  ]
  return Tile.handTingDiscards(newHand, newMelds).length > 0
}

// 这张牌打出后能否进入听牌（含本地限制：打出后须不断幺九、须有副露等）
export function isTingDiscard(
  hand: TileType[],
  melds: Meld[],
  tile: TileType | null | undefined,
) {
  if (!tile) return false
  return Tile.handTingDiscards(hand, melds).some(
    (t) => Tile.tid(t) === Tile.tid(tile),
  )
}

// 打哪张牌可以听牌（出牌前可选）
export function tingDiscards(pI: number): TileType[] {
  let p = G.players[pI]
  return Tile.handTingDiscards(p.hand, p.melds)
}

// 抓牌上听方案：14 张时打出哪张可听牌、听哪些牌（回答“差的是哪张”）
export function tingPlans(pI: number) {
  let p = G.players[pI]
  let plans: { discard: TileType; wins: TileType[] }[] = []
  for (let d of Tile.handTingDiscards(p.hand, p.melds)) {
    let i = p.hand.findIndex((x) => Tile.tid(x) === Tile.tid(d))
    let rest = p.hand.filter((_, j) => j !== i)
    plans.push({ discard: d, wins: Tile.winTiles(rest, p.melds) })
  }
  return plans
}

// 还差一张（抓牌）：13 张时摸到哪些牌可上听；见光无剩余的牌会排除
export function drawsForTing(pI: number): TileType[] {
  return AI.handDrawsForTing(G.players[pI].hand, G.players[pI].melds)
}

// 距上听还有几张（本地规则近似）：0=已可听/打一张即听，1=差一张，n=更远
// “差一张”由 drawsForTing/tingPlans 精确判定；此函数用于更远时给出张数
export function localTingDistance(pI: number): number {
  let p = G.players[pI]
  if (!p || G.ting.has(pI)) return 0
  let d = AI.handTingDistance(p.hand, p.melds)
  // 吃/碰别家的牌后能打一张听牌，同样只差一张
  let need = 4 - p.melds.length
  if (d > 1 && p.hand.length === need * 3 + 1 && claimTingTiles(pI).length)
    d = 1
  return d
}

// 吃/碰别家可上听的牌：碰（手中有 2 张）或吃（顺子缺一张）后能打一张听牌
// 见光无剩余的牌会排除；杠不在此列
export function claimTingTiles(pI: number): TileType[] {
  let p = G.players[pI]
  if (!p || G.ting.has(pI) || p.melds.length >= 3) return []
  let counts: Record<string, number> = {}
  p.hand.forEach((t) => {
    counts[Tile.tid(t)] = (counts[Tile.tid(t)] || 0) + 1
  })
  let res: TileType[] = []
  let push = (cand: TileType, ok: boolean) => {
    if (!ok) return
    if ((counts[Tile.tid(cand)] || 0) + AI.visibleCount(cand) >= 4) return
    if (!res.some((t) => Tile.tid(t) === Tile.tid(cand))) res.push(cand)
  }
  let hasNum = (type: string, n: number) =>
    p.hand.some((x) => x.type === type && x.num === n)
  Tile.TT.forEach((type) => {
    for (let n = 1; n <= 9; n++) {
      let cand = { type, num: n, suit: Tile.SN[type], id: n + type }
      if ((counts[cand.id] || 0) >= 2) push(cand, pengLeadsToTing(pI, cand))
      if (n >= 2 && n <= 8 && hasNum(type, n - 1) && hasNum(type, n + 1))
        push(cand, chiLeadsToTing(pI, cand, [n - 1, n, n + 1]))
      if (n >= 3 && hasNum(type, n - 2) && hasNum(type, n - 1))
        push(cand, chiLeadsToTing(pI, cand, [n - 2, n - 1, n]))
      if (n <= 7 && hasNum(type, n + 1) && hasNum(type, n + 2))
        push(cand, chiLeadsToTing(pI, cand, [n, n + 1, n + 2]))
    }
  })
  let zt = { type: "zhong", num: 0, suit: "红中", id: "红中" }
  if ((counts[zt.id] || 0) >= 2) push(zt, pengLeadsToTing(pI, zt))
  res.sort((a, b) => {
    let ta = a.type === "zhong" ? 99 : Tile.TT.indexOf(a.type)
    let tb = b.type === "zhong" ? 99 : Tile.TT.indexOf(b.type)
    return ta - tb || a.num - b.num
  })
  return res
}

// 右侧长显：还差一张上听（吃/碰 与 手抓，重复只归吃/碰；都不满足则 null）
export function tingWatch(pI: number) {
  let p = G.players[pI]
  if (!p || G.ting.has(pI)) return null
  let claim = claimTingTiles(pI)
  let inClaim = new Set(claim.map(Tile.tid))
  let draws = drawsForTing(pI).filter((t) => !inClaim.has(Tile.tid(t)))
  if (!claim.length && !draws.length) return null
  return { claim, draws }
}

// 出牌前是否可以宣告听牌
export function canStartTing(pI: number): boolean {
  if (G.over || G.ting.has(pI) || G.tingIntent) return false
  if (G.phase !== "discard" || G.curP !== pI || G.lock) return false
  return tingDiscards(pI).length > 0
}

// 打完后（13 张）已经成听，可立即宣告；仅限本人出牌或本人弃张结算中，防止非本人回合非法听牌
export function canDeclareNow(pI: number): boolean {
  if (G.over || G.ting.has(pI)) return false
  if (G.curP !== pI || G.lock) return false
  if (G.phase !== "discard" && G.phase !== "claim") return false
  let p = G.players[pI]
  if (p.melds.length < 1 || p.melds.length >= 4) return false // 门前清 / 手把一 不能听牌
  let need = 4 - p.melds.length
  if (need < 0 || p.hand.length !== need * 3 + 1) return false
  return Tile.isTing(p.hand, p.melds)
}

// 进入听牌：13 张已听立即生效；14 张则进入选择状态
export function startTing(pI: number) {
  if (canDeclareNow(pI)) {
    addTing(pI)
    ui("update")
    return
  }
  if (!canStartTing(pI)) return
  G.tingIntent = true
  ui("update")
}

// 已听牌时，当前手牌能胡的牌
export function tingTiles(pI: number): TileType[] {
  let p = G.players[pI]
  let need = 4 - p.melds.length
  if (need < 0 || p.hand.length !== need * 3 + 1) return []
  return Tile.winTiles(p.hand, p.melds)
}

function countMax(hand: TileType[]): number {
  let c: Record<string, number> = {}
  hand.forEach((t) => {
    c[Tile.tid(t)] = (c[Tile.tid(t)] || 0) + 1
  })
  return Math.max(0, ...Object.values(c))
}

function hasConsecutive(hand: TileType[]): boolean {
  for (let i = 0; i < hand.length; i++) {
    for (let j = 0; j < hand.length; j++) {
      for (let k = 0; k < hand.length; k++) {
        if (i === j || j === k || i === k) continue
        let a = hand[i],
          b = hand[j],
          c = hand[k]
        if (a.type === "zhong" || a.type !== b.type || b.type !== c.type)
          continue
        let n = [a.num, b.num, c.num].sort((x, y) => x - y)
        if (n[1] === n[0] + 1 && n[2] === n[1] + 1) return true
      }
    }
  }
  return false
}

// 和牌条件提示：全部按本地规则计算（标准向听数不计幺九/刻子/花色限制，会误报，不用）
export function handHints(pI: number) {
  let p = G.players[pI]
  let all = [...p.hand]
  p.melds.forEach((m) => all.push(...m.ts))

  let suits = new Set<string>()
  all.forEach((t) => {
    if (t.type !== "zhong") suits.add(t.type)
  })

  // 已听 / 14 张抓牌上听 / 13 张已听未宣告 / 13 张差一摸，互斥且按序取
  let plans: { discard: TileType; wins: TileType[] }[] = [],
    wins: TileType[] = [],
    draws: TileType[] = []
  if (!G.ting.has(pI)) {
    plans = tingPlans(pI)
    if (!plans.length) {
      wins = tingTiles(pI)
      if (!wins.length) draws = drawsForTing(pI)
    }
  }

  return {
    yao: all.some(Tile.isYao),
    tri:
      p.melds.some((m) => m.type === "peng" || m.type === "kong") ||
      countMax(p.hand) >= 3,
    seq: p.melds.some((m) => m.type === "chi") || hasConsecutive(p.hand),
    pair: countMax(p.hand) >= 2,
    closed: p.melds.length === 0,
    color: suits.size >= 2,
    plans,
    wins,
    draws,
  }
}

export function selfActions(pI: number): ClaimAct[] {
  // 已听牌，或吃听/点听牌后只能打听牌张，均不再提供吃碰杠
  if (
    G.phase !== "discard" ||
    G.curP !== pI ||
    G.over ||
    G.ting.has(pI) ||
    G.forceTing ||
    G.tingIntent
  )
    return []
  let p = G.players[pI]
  if (p.melds.length >= 4) return []
  let acts: ClaimAct[] = []
  let counts: Record<string, number> = {}
  p.hand.forEach((t) => {
    counts[Tile.tid(t)] = (counts[Tile.tid(t)] || 0) + 1
  })
  // 暗杠会新增一副露：已有 3 副露时禁止（防手把一）；补杠不增副露，允许
  if (p.melds.length < 3 && Object.values(counts).some((c) => c >= 4))
    acts.push({ a: "selfKong", l: "暗杠" })
  p.melds.forEach((m) => {
    if (
      m.type === "peng" &&
      p.hand.some((t) => Tile.tid(t) === Tile.tid(m.ts[0]))
    ) {
      acts.push({ a: "buKong", l: "补杠 " + Tile.label(m.ts[0]), d: m.ts[0] })
    }
  })
  return acts
}

// ===== 鸣牌裁决 =====
// 优先级：胡 > 上听（吃听/碰听）> 杠/碰 > 吃；同级按打牌者下家顺序
export function claimPriority(act: ClaimAct): number {
  if (act.a === "hu") return 4
  if (act.ting) return 3
  if (act.a === "peng" || act.a === "kong") return 2
  return 1
}

// 从多个玩家的鸣牌中选出优先级最高者，同级取牌序靠前者
export function pickClaim(
  claims: { i: number; acts: ClaimAct[] }[],
  lastDB: number,
) {
  if (!claims.length) return null
  let maxP = Math.max(
    ...claims.map((c) => Math.max(...c.acts.map(claimPriority))),
  )
  let top = claims.filter(
    (c) => Math.max(...c.acts.map(claimPriority)) === maxP,
  )
  top.sort(
    (a, b) =>
      ((a.i - lastDB + PLAYER_COUNT) % PLAYER_COUNT) -
      ((b.i - lastDB + PLAYER_COUNT) % PLAYER_COUNT),
  )
  return top[0]
}

function resolveClaims() {
  if (G.over) return
  let claims: { i: number; acts: ClaimAct[] }[] = []
  for (let i = 0; i < PLAYER_COUNT; i++) {
    if (i === G.lastDB || G.passed.has(i)) continue
    let acts = claimActions(i)
    if (acts.length) claims.push({ i, acts })
  }
  if (!claims.length) {
    G.phase = "discard"
    advanceTurn()
    return
  }

  let chosen = pickClaim(claims, G.lastDB)!

  if (chosen.i === HUMAN) {
    if (SIM_MODE || G.auto) {
      let act = AI.aiChooseClaim(HUMAN, chosen.acts)
      if (act) executeClaim(HUMAN, act)
      else {
        G.passed.add(HUMAN)
        resolveClaims()
      }
      return
    }
    G.phase = "claim"
    G.pending = [HUMAN]
    ui("update")
    return
  }

  let act = AI.aiChooseClaim(chosen.i, chosen.acts)
  if (act) {
    // 裁决与执行同拍完成，不另起等待
    executeClaim(chosen.i, act)
  } else {
    G.passed.add(chosen.i)
    resolveClaims()
  }
}

function executeClaim(pI: number, act: ClaimAct) {
  let p = G.players[pI],
    t = G.lastD!
  G.phase = "discard"
  G.pending = []
  G.curP = pI
  G.ting.delete(pI)

  if (act.a === "hu") {
    win(pI, G.lastDB, false)
    return
  }

  // 标记这张牌被吃/碰/杠走
  if (t) t.claimed = act.a

  if (act.a === "peng") {
    let used = takeFromHand(p, t, 2)
    p.melds.push({ type: "peng", ts: [...used, t], claimedId: Tile.tid(t) })
    sortHand(p)
    ui("addLog", p.name + " 碰 " + Tile.label(t))
    showAct(pI, "碰")
  } else if (act.a === "kong") {
    let used = takeFromHand(p, t, 3)
    p.melds.push({ type: "kong", ts: [...used, t], claimedId: Tile.tid(t) })
    sortHand(p)
    ui("addLog", p.name + " 杠 " + Tile.label(t))
    showAct(pI, "杠")
    let drawn = drawDead(pI)
    if (!drawn) {
      endDraw()
      return
    }
    if (G.ting.has(pI) && Tile.canWin(p.hand, p.melds)) {
      win(pI, null, true)
      return
    }
  } else if (act.a === "chi") {
    // 吃上家为正常吃牌，是否听牌由玩家决定；吃另外两家为上听吃，必须听牌
    let isUpper = G.lastDB === (pI + PLAYER_COUNT - 1) % PLAYER_COUNT
    let used: TileType[] = []
    act.d.forEach((n: number) => {
      if (n !== t.num) {
        let i = p.hand.findIndex((x) => x.type === t.type && x.num === n)
        if (i >= 0) used.push(p.hand.splice(i, 1)[0])
      }
    })
    p.melds.push({ type: "chi", ts: [...used, t], claimedId: Tile.tid(t) })
    sortHand(p)
    ui("addLog", p.name + " 吃 " + Tile.label(t))
    // 吃牌一律先弹「吃」，随后（上听吃）再弹「听」
    showAct(pI, "吃")
    // 上听吃（吃另外两家）：吃完若能听牌则强制听牌
    let opts = isUpper ? [] : Tile.handTingDiscards(p.hand, p.melds)
    if (opts.length) {
      G.forceTing = true
      G.curP = pI
      ui("update") // 先显示副露与「吃」，空一拍再出牌
      if (pI === HUMAN && !SIM_MODE && !G.auto) {
        // 人类玩家：只设标记让用户自己选择打出哪张
        return
      }
      // AI：算出最优听牌张，空一拍后打出（出牌瞬间弹「听」）
      let best = opts[0],
        bestCount = -1,
        seen = new Set()
      for (let tt of opts) {
        if (seen.has(Tile.tid(tt))) continue
        seen.add(Tile.tid(tt))
        let rest = p.hand.filter((x) => x !== tt)
        let cnt = Tile.winTiles(rest, p.melds).length
        if (cnt > bestCount) {
          bestCount = cnt
          best = tt
        }
      }
      let token = G.token
      scheduleTask(() => {
        if (
          G.token !== token ||
          G.over ||
          G.phase !== "discard" ||
          G.curP !== pI
        )
          return
        doDiscard(pI, p.hand.indexOf(best))
      }, TICK)
      return
    }
  }

  ensureBaopi()
  ui("update")
  if (pI !== HUMAN) scheduleAIDiscard(pI)
  else if (SIM_MODE || G.auto) scheduleAIDiscard(HUMAN)
}

function selfAct(pIdx: number, a: string, d?: any): boolean {
  // any：d 随动作变（吃为顺子号数组，杠为一张牌）
  let p = G.players[pIdx]
  if (a === "selfKong") {
    let counts: Record<string, number> = {}
    p.hand.forEach((t) => {
      counts[Tile.tid(t)] = (counts[Tile.tid(t)] || 0) + 1
    })
    let id = Object.keys(counts).find((k) => counts[k] >= 4)
    if (!id) return false
    let tile = p.hand.find((t) => Tile.tid(t) === id)!
    let used = takeFromHand(p, tile, 4)
    p.melds.push({ type: "kong", ts: used })
    ui("addLog", p.name + " 暗杠")
    showAct(pIdx, "杠")
  } else if (a === "buKong") {
    let m = p.melds.find(
      (m) => m.type === "peng" && Tile.tid(m.ts[0]) === Tile.tid(d),
    )
    if (!m) return false
    let used = takeFromHand(p, d, 1)
    m.type = "kong"
    m.ts.push(used[0])
    ui("addLog", p.name + " 补杠 " + Tile.label(d))
    showAct(pIdx, "杠")
  } else {
    return false
  }
  sortHand(p)
  G.ting.delete(pIdx)
  let drawn = drawDead(pIdx)
  if (!drawn) {
    endDraw()
    return true
  }
  if (G.ting.has(pIdx) && Tile.canWin(p.hand, p.melds)) {
    win(pIdx, null, true)
    return true
  }
  ui("update")
  return true
}

function aiDiscard(pI: number) {
  if (G.over || G.phase !== "discard" || G.curP !== pI) return
  let p = G.players[pI]
  if (!p.hand.length) return
  if (G.ting.has(pI)) {
    doDiscard(pI, p.hand.length - 1)
    return
  } // 听牌后摸啥打啥，避免拆听
  let lvl = getAILevel(pI)
  let idx
  if (lvl === "easy") idx = AI.easyDiscardIndex(pI)
  else if (lvl === "hard") idx = AI.hardDiscardIndex(pI)
  else idx = AI.normalDiscardIndex(pI)
  doDiscard(pI, idx)
}

function aiTurn(pI: number) {
  if (G.over || G.phase !== "discard" || G.curP !== pI) return
  let selfActs = selfActions(pI)
  if (selfActs.length) {
    let lvl = getAILevel(pI)
    let act = selfActs[0],
      doIt = false
    if (lvl === "easy") doIt = Math.random() < 0.5
    else if (lvl === "hard") {
      let best = selfActs.reduce(
        (a, b) => (AI.evalSelfKong(pI, b) > AI.evalSelfKong(pI, a) ? b : a),
        selfActs[0],
      )
      if (AI.evalSelfKong(pI, best) > 0) {
        act = best
        doIt = true
      }
    } else if (AI.evalSelfKong(pI, act) >= 0) {
      doIt = true
    }
    if (doIt && selfAct(pI, act.a, act.d)) {
      if (G.over || G.phase !== "discard" || G.curP !== pI) return
      // 自杠/补杠后空1拍再出牌
      let token = G.token
      scheduleTask(() => {
        if (G.token !== token || G.over) return
        if (G.phase !== "discard" || G.curP !== pI) return
        aiDiscard(pI)
      }, TICK)
      return
    }
  }
  aiDiscard(pI)
}

// ===== AI 调度 =====
function scheduleTask(fn: () => void, delay: number) {
  if (SIM_MODE) {
    simQueue.push(fn)
    return
  }
  setTimeout(fn, delay)
}

function scheduleAIDiscard(pI: number, delay = TICK) {
  G.lock = true
  let token = G.token
  scheduleTask(() => {
    G.lock = false
    if (G.token !== token || G.over) return
    if (G.phase !== "discard" || G.curP !== pI) return
    aiTurn(pI)
  }, delay)
}

// ===== 无头模拟（仅测试用）=====
// 同步驱动整局（含 HUMAN 也交给 AI）。level 可为字符串（四家同档）
// 或长度为 4 的数组（按座位分别指定，用于“模块对战”）
export function simulateRound(level: string | string[]) {
  let prevLevel = G.aiLevel
  let prevLevels = G.aiLevels
  SIM_MODE = true
  simQueue = []
  simFirstTing = null
  if (Array.isArray(level)) {
    G.aiLevels = level.slice(0, PLAYER_COUNT)
  } else {
    G.aiLevels = null
    G.aiLevel = AI_LEVELS[level] ? level : "normal"
  }
  try {
    G.dealer = Math.floor(Math.random() * PLAYER_COUNT) // 随机庄家，消除座位先手优势
    G.playing = true
    G.stats = freshStats()
    startRound(true)
    let guard = 0
    while (!G.over && guard++ < 50000) {
      if (!simQueue.length) {
        // 无排队任务时，若轮到自己出牌则直接驱动（主要覆盖 HUMAN 庄家/回合）
        if (!G.lock && G.phase === "discard" && G.players.length) aiTurn(G.curP)
        else break
      }
      if (simQueue.length) {
        let task = simQueue.shift()!
        try {
          task()
        } catch (e) {
          /* 单步异常不阻塞模拟 */
        }
      }
    }
    return {
      over: G.over,
      winner: G.winner,
      firstTing: simFirstTing,
      discards: G.discard.length,
    }
  } finally {
    SIM_MODE = false
    simQueue = []
    G.aiLevel = prevLevel
    G.aiLevels = prevLevels
  }
}

// ===== 整桌模拟（仅测试用）：首把随机庄家清零开打，带分连打到 rotations>=circles =====
// levels 为长度 4 的数组（按座位指定难度）；转庄/连庄/流局规则与 win()/endDraw 一致，改了那边要同步改这里
// 返回单桌 {rank, wins, hands, score, hard, dealIn, tingSum, tingN}（rank=1+严格更高分人数，并列取最好名次）
export function simulateTable(levels: string[], circles?: number): SimRow {
  circles = Math.max(1, circles || 4)
  // 焦点座位：4 座中难度唯一不同的那家（如 1 hard vs 3 normal 取 hard 座）；全相同时取 0
  let hard = levels.findIndex((l) => levels.filter((x) => x === l).length === 1)
  if (hard < 0) hard = 0
  let prevLevel = G.aiLevel
  let prevLevels = G.aiLevels
  SIM_MODE = true
  simQueue = []
  try {
    G.aiLevels = levels.slice(0, PLAYER_COUNT)
    G.dealer = Math.floor(Math.random() * PLAYER_COUNT)
    G.playing = true
    G.stats = freshStats()
    let wins = 0
    let tingSum = [0, 0, 0, 0],
      tingN = [0, 0, 0, 0]
    let handGuard = 0
    let maxHands = circles * 24 + 50 // 连庄拖局安全帽
    startRound(true)
    while (G.stats!.rotations < circles && handGuard++ < maxHands) {
      simFirstTing = null
      simTingSeen = {}
      driveHand()
      if (G.winner === hard) wins++
      // 上听轮数：每方每把只计首听（焦点座取自己，基准方取3座最早），未听不计入
      if (simTingSeen[hard] !== undefined) {
        tingSum[hard] += simTingSeen[hard]!
        tingN[hard]++
      }
      let baseMin = Infinity
      for (let i = 0; i < PLAYER_COUNT; i++) {
        if (i !== hard && simTingSeen[i] !== undefined)
          baseMin = Math.min(baseMin, simTingSeen[i]!)
      }
      if (baseMin !== Infinity) {
        let seat = [0, 1, 2, 3].find(
          (i) => i !== hard && simTingSeen[i] === baseMin,
        )!
        tingSum[seat] += baseMin
        tingN[seat]++
      }
      if (G.stats!.rotations >= circles) break
      // 转庄已在 win() 内完成（非庄和牌才转庄，回到 0 位记一圈；庄和/流局不转）
      startRound(false)
    }
    let scores = G.players.map((p) => p.score)
    let rank = 1 + scores.filter((s) => s > scores[hard]).length
    let dealIn = G.stats!.per.map((p) => p.dianhei || 0) // 点炮率只计点黑炮，听牌点炮（dianpao）不计
    return {
      rank,
      wins,
      hands: G.stats!.hands,
      score: scores[hard],
      hard,
      dealIn,
      tingSum,
      tingN,
    }
  } finally {
    SIM_MODE = false
    simQueue = []
    G.aiLevel = prevLevel
    G.aiLevels = prevLevels
  }
}

function driveHand() {
  let guard = 0
  while (!G.over && guard++ < 50000) {
    if (!simQueue.length) {
      if (!G.lock && G.phase === "discard" && G.players.length) aiTurn(G.curP)
      else break
    }
    if (simQueue.length) {
      let task = simQueue.shift()!
      try {
        task()
      } catch (e) {
        /* 单步异常不阻塞模拟 */
      }
    }
  }
}

// ===== 玩家操作 =====
export function handleAB(pIdx: number, a: string, d?: any) {
  // any：d 随动作变，同 selfAct
  if (!G.playing || G.over) return
  // 自摸确认：胡 或 过（过则打出刚摸的牌）
  if (G.selfHu && pIdx === HUMAN) {
    if (a === "hu") {
      G.selfHu = false
      win(HUMAN, null, true)
      return
    }
    if (a === "pass") {
      G.selfHu = false
      if (G.phase === "fen") scheduleFenStep()
      else humanAutoDiscard()
      return
    }
    return
  }
  if (a === "ting") {
    startTing(pIdx)
    return
  }
  if (G.phase === "claim" && G.pending.includes(pIdx)) humanClaim(pIdx, a, d)
  else if (G.phase === "discard" && pIdx === G.curP && pIdx === HUMAN)
    selfAct(pIdx, a, d)
}

function humanClaim(pIdx: number, a: string, d?: any) {
  // any：d 随动作变，同 selfAct
  if (a === "pass") {
    G.pending = []
    G.passed.add(pIdx)
    resolveClaims()
    return
  }
  executeClaim(pIdx, { a, d } as ClaimAct)
}

// ===== 结算 =====
function win(pI: number, discarder: number | null, isZimo: boolean) {
  if (G.over) return
  G.over = true
  G.winner = pI

  let p = G.players[pI]
  let isDealer = p.isD
  let winTile = isZimo ? G.lastDraw : G.lastD
  let isBaopi = !!(
    isZimo &&
    G.bpR &&
    G.baopi &&
    winTile &&
    Tile.tid(winTile) === Tile.tid(G.baopi)
  )
  // 点炮方是否已听牌：听牌点炮三家共付，未听牌点炮为「黑炮」由放炮者独付
  let discarderIsTing = !isZimo && discarder! >= 0 && G.ting.has(discarder!)
  let heipao = !isZimo && !discarderIsTing

  let fan = Score.calcFan({ isDealer, isZimo, isBaopi, heipao })
  let sc = Score.calcScore({
    fan,
    isZimo,
    discarderIsTing,
    discarder: discarder!,
    winner: pI,
    dealer: G.dealer,
  })
  sc.deltas.forEach((d, i) => {
    G.players[i].score += d
  })

  let title = isZimo
    ? isDealer
      ? "庄家自摸"
      : "自摸"
    : isDealer
      ? "庄家和牌"
      : "和牌"
  let base = Math.pow(2, fan)
  // 庄家作为付款方时翻倍
  let dealerPays = isZimo
    ? pI !== G.dealer
    : !discarderIsTing
      ? discarder === G.dealer
      : pI !== G.dealer
  let detail =
    "番数 " +
    fan +
    " · 基础 " +
    base +
    " 分" +
    (dealerPays ? " · 庄家 " + base * 2 + " 分" : "")
  if (isDealer) detail += " · 庄家"
  if (isZimo) detail += " · 自摸"
  if (isBaopi) detail += " · 宝牌"
  if (heipao) detail += " · 黑炮"
  else if (!isZimo) detail += " · 听牌点炮"

  // 每人计番文本：和牌者为本人番型；付款的庄家多一番；未参与付款的不计
  let baseParts = []
  if (isDealer) baseParts.push("庄家 1番")
  if (isZimo) baseParts.push("自摸 1番")
  if (isBaopi) baseParts.push("宝牌 1番")
  if (heipao) baseParts.push("黑炮 2番")
  let breakdown = G.players.map((pl, i) => {
    let parts = [...baseParts]
    if (i !== pI && sc.deltas[i] < 0 && i === G.dealer) parts.push("庄家 1番")
    let fan =
      i !== pI && sc.deltas[i] < 0 && parts.length ? parts.join("·") : "—"
    return {
      name: pl.name,
      me: i === HUMAN,
      isD: pl.isD,
      delta: sc.deltas[i],
      total: pl.score,
      fan,
    }
  })

  if (G.stats && G.stats.per) {
    let s = normPer(G.stats.per[pI])
    G.stats.per[pI] = s
    if (isZimo) s.zimo++
    else {
      s.ron++
      if (heipao) {
        s.heipao++
        if (discarder! >= 0) {
          let ds = normPer(G.stats.per[discarder!])
          G.stats.per[discarder!] = ds
          ds.dianhei++
        }
      } else s.dianpao++
    }
    if (isBaopi) s.baopi++
  }

  // 本局结束：先定好下一局庄家（非庄和牌才转庄），再落盘，刷新即从新一局开始
  if (pI !== G.dealer) {
    G.dealer = (G.dealer + 1) % PLAYER_COUNT
    if (G.dealer === 0 && G.stats) G.stats.rotations++
  }
  ui("addLog", p.name + " " + title + "！" + detail + "，得分 +" + sc.gain)
  ui("update")
  ui("effect", isBaopi ? "baopi" : "win")
  ui("showWinBanner", {
    name: p.name,
    title,
    isZimo,
    isBaopi,
    hand: p.hand,
    melds: p.melds,
    winTile,
  })
  ui(
    "showModal",
    title,
    p.name + title + "了",
    "本局得分 +" + sc.gain,
    detail,
    "继续",
    (pendingNext = () => startRound(false)),
    breakdown,
  )
}

function endDraw() {
  let fromFen = G.phase === "fen"
  G.over = true
  if (G.stats) G.stats.draw++
  ui("addLog", fromFen ? "分章结束，无人和牌" : "流局，无人和牌")
  ui("update")
  let breakdown = G.players.map((pl, i) => ({
    name: pl.name,
    me: i === HUMAN,
    isD: pl.isD,
    delta: 0,
    total: pl.score,
    fan: "—",
  }))
  ui(
    "showModal",
    "流局",
    fromFen ? "分章结束，无人和牌" : "牌墙摸完，无人和牌",
    "本局不扣分",
    "",
    "继续",
    (pendingNext = () => startRound(false)),
    breakdown,
  )
}
