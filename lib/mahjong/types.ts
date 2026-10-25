// 麻将引擎共享类型：game/tile/score 与测试、未来的 React UI 共用
// 牌面 type 用 string（'wan' | 'tiao' | 'tong' | 'zhong'），与运行时 JSON 存档一致

export type Tile = {
  type: string
  num: number
  suit: string
  id: string
  claimed?: string // 被吃/碰/杠走时记下动作名
  tingDiscard?: boolean // 首次听牌打出的那张
}

export type Meld = {
  type: string // 'chi' | 'peng' | 'kong'
  ts: Tile[]
  claimedId?: string
}

// 拆解结果里的一副面子（kind: 'tri' | 'seq'）
export type Group = { kind: string; type?: string; num?: number }

export type Player = {
  index: number
  hand: Tile[]
  melds: Meld[]
  disc: Tile[]
  name: string
  isD: boolean
  score: number
}

export type PerStat = {
  zimo: number
  ron: number
  heipao: number
  baopi: number
  dianpao: number
  dianhei: number
}

export type Stats = {
  hands: number
  rotations: number
  draw: number
  per: PerStat[]
}

export type AIConfig = {
  randomness: number
  claimPengRate: number
  claimChiRate: number
  kongRate: number
  defenseWeight: number
  ukeireWeight: number
  scoreWeight: number
  useTingInfo: boolean
  useOpponentModel: boolean
  discardRankProb?: number[]
}

export type Phase = "discard" | "claim" | "fen"

// 引擎全局状态 G 的形状
export type State = {
  deck: Tile[]
  dead: Tile[]
  fen: Tile[]
  fenN: number
  fenStart: number
  players: Player[]
  curP: number
  dealer: number
  discard: Tile[]
  wall: number
  baopi: Tile | null
  bpR: boolean
  ting: Set<number>
  over: boolean
  winner: number | null
  lastD: Tile | null
  lastDB: number
  lastDraw: Tile | null
  lastFrom: string
  phase: Phase
  pending: number[]
  passed: Set<number>
  lock: boolean
  token: number
  tingIntent: boolean
  selfHu: boolean
  forceTing: boolean
  playing: boolean
  aiLevel: string
  aiLevels: string[] | null
  auto: boolean
  stats: Stats | null
  demo: boolean
}

// d 随动作而变：吃为顺子号数组，补杠/自杠为一张牌；l 为按钮文案，仅 UI 读取
export type ClaimAct = { a: string; l?: string; d?: any; ting?: boolean }

export type EvalResult = { dist: number; uke: number; wins: number }

export type SimRow = {
  rank: number
  wins: number
  hands: number
  score: number
  hard: number
  dealIn: number[]
  tingSum: number[]
  tingN: number[]
}

// UI 展示用的数据形状（引擎产出，components/mahjong 渲染）
export type BreakdownRow = {
  name: string
  me: boolean
  isD: boolean
  delta: number
  total: number
  fan: number | string
}

export type WinData = {
  name: string
  title: string
  isZimo: boolean
  isBaopi: boolean
  hand: Tile[]
  melds: Meld[]
  winTile: Tile | null
}

export type SummaryStat = {
  zimo?: number
  ron?: number
  heipao?: number
  baopi?: number
  dianpao?: number
  dianhei?: number
}

export type SummaryData = {
  hands: number
  rotations: number
  draw: number
  hu: number
  scores: Array<{
    name: string
    me: boolean
    isD: boolean
    score: number
    stat: SummaryStat
  }>
}

// UI 回调表：每个页面实现一个子集（无 DOM 的测试传 no-op），引擎只管喊
export type UIHooks = Partial<{
  update: () => void
  addLog: (msg: string) => void
  showWinBanner: (data: WinData) => void
  hideWinBanner: () => void
  showModal: (
    title: string,
    result: string,
    score: string,
    detail: string,
    btnText: string,
    cb: (() => void) | null,
    breakdown: BreakdownRow[] | null,
  ) => void
  showSummary: (data: SummaryData) => void
  effect: (kind: string) => void
  actFx: (pI: number, text: string) => void
}>
