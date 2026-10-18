// 传奇挂机（mir2）引擎共享类型：状态、存档、JSON 数据表与 UI 钩子
// JSON/localStorage 里的表结构只写引擎真正用到的字段，其余交给索引签名

export type StatKey = "dc" | "mc" | "sc" | "ac" | "mac"
export type StatRange = [number, number]
export type Stats = Record<StatKey, StatRange>

export type Item = {
  Name: string
  StdMode: number
  NeedLevel?: number | null
  Price?: number | null
  Dc?: number | null
  DcMax?: number | null
  Mc?: number | null
  McMax?: number | null
  Sc?: number | null
  ScMax?: number | null
  Ac?: number | null
  AcMax?: number | null
  Mac?: number | null
  MacMax?: number | null
  // JSON 边界：数据表还有大量引擎不读的列
  [key: string]: unknown
}

export type Magic = {
  MagName: string
  Job: number
  NeedL1: number
  NeedL2: number
  NeedL3: number
  Power: number
  MaxPower: number
  DefPower: number
  DefMaxPower: number
  [key: string]: unknown
}

export type Monster = {
  Name: string
  Lvl: number
  HP: number
  AC: number
  MAC: number
  Exp: number
  [key: string]: unknown
}

export type LevelRow = { level: number; totalExp: number; expToNext: number }

export type Job = { key: string; name: string; job: number; main: StatKey }

export type Equip = Record<string, string>

export type Target = {
  Name: string
  HP: number
  MaxHP: number
  AC: number
  MAC: number
  // 测试里的临时木桩可以不带经验/类别；引擎自己创建的目标一定带
  Exp?: number
  kind?: "normal" | "elite" | "boss"
  count?: number
}

export type Char = {
  key: string
  name: string
  job: number
  level: number
  exp: number
  killsNormal: number
  killsElite: number
  killsBoss: number
  equip: Equip
  target: Target | null
  logs: string[]
  acc: number
  hinted: Record<string, number>
  comp: boolean
}

export type DropInfo = { name: string; by: string; from: string; at: number }

export type ChallengeResult = {
  name: string
  exp: number
  gold: number
  items: string[]
  counts: Record<string, number>
}

export type Challenge = {
  name: string
  hp: number
  maxHp: number
  ac: number
  mac: number
  exp: number
  lvl: number
  boost: number
  logs: string[]
  done: boolean
  result: ChallengeResult | null
}

export type GameState = {
  gold: number
  bag: Record<string, number>
  speed: number
  speedMax: number
  boost: number
  running: boolean
  chars: Char[]
  challenge: Challenge | null
  bossCd: Record<string, number>
  dropInfo: DropInfo[]
}

export type DBShape = {
  levels: LevelRow[]
  items: Item[]
  itemByName: Record<string, Item>
  magics: Magic[]
  monsters: Monster[]
  elites: Monster[]
  bosses: Monster[]
}

export type DBData = Partial<Omit<DBShape, "itemByName">>

export type SavedChar = {
  key?: string
  level?: number
  exp?: number
  kills?: number
  killsNormal?: number
  killsElite?: number
  killsBoss?: number
  equip?: Equip
}

// localStorage 边界：老存档可能缺字段
export type SaveData = {
  gold?: number
  bag?: Record<string, number>
  speed?: number
  speedMax?: number
  boost?: number
  bossCd?: Record<string, number>
  chars?: SavedChar[]
}

export type DropResult = {
  gold: number
  items: string[]
  counts: Record<string, number>
}

export type SellRow = { name: string; n: number; gold: number }
export type SellPreview = { rows: SellRow[]; total: number; count: number }

export type SkillOption = {
  name: string
  avg: number
  max: number
  bonus?: number
  m?: Magic | null
  lv?: number
}

// 引擎 → React 桥：引擎只喊事件，视图状态由组件自己维护
export type UIHooks = {
  update: () => void
  bossDone?: () => void
}
