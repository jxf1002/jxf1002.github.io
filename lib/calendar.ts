// 日历拼图纯逻辑：棋盘、拼块、日期换算、求解器
export type Mode = "basic" | "advanced"

export type Shape = ReadonlyArray<readonly [number, number]>

export type Placed = {
  piece: number
  cells: string[]
  rotation?: number
  mirrored?: boolean
}

export type Target = { month: number; day: number; weekday: number }

export const MODES = ["basic", "advanced"] as const

export const MODE_META: Record<Mode, { name: string }> = {
  basic: { name: "初级" },
  advanced: { name: "高级" },
}

export const MONTH_NAMES = [
  "1月",
  "2月",
  "3月",
  "4月",
  "5月",
  "6月",
  "7月",
  "8月",
  "9月",
  "10月",
  "11月",
  "12月",
] as const

export const WEEKDAY_NAMES = [
  "周一",
  "周二",
  "周三",
  "周四",
  "周五",
  "周六",
  "周日",
] as const

const BASIC_LAYOUT: (string | null)[][] = [
  ["m0", "m1", "m2", "m3", "m4", "m5", null],
  ["m6", "m7", "m8", "m9", "m10", "m11", null],
  ["d1", "d2", "d3", "d4", "d5", "d6", "d7"],
  ["d8", "d9", "d10", "d11", "d12", "d13", "d14"],
  ["d15", "d16", "d17", "d18", "d19", "d20", "d21"],
  ["d22", "d23", "d24", "d25", "d26", "d27", "d28"],
  ["d29", "d30", "d31", null, null, null, null],
]

// 实物常见的 7×8 布局：月份两行，日期排到 31，星期拆在右下角
const ADVANCED_LAYOUT: (string | null)[][] = [
  ["m0", "m1", "m2", "m3", "m4", "m5", null],
  ["m6", "m7", "m8", "m9", "m10", "m11", null],
  ["d1", "d2", "d3", "d4", "d5", "d6", "d7"],
  ["d8", "d9", "d10", "d11", "d12", "d13", "d14"],
  ["d15", "d16", "d17", "d18", "d19", "d20", "d21"],
  ["d22", "d23", "d24", "d25", "d26", "d27", "d28"],
  ["d29", "d30", "d31", "w0", "w1", "w2", "w3"],
  [null, null, null, null, "w4", "w5", "w6"],
]

// 两套拼块共有的 6 个五连方，按同一顺序/朝向放在最前面，
// 这样切换初级/高级时形状、顺序、颜色都一致
const SHARED_PIECES: readonly Shape[] = [
  [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1]], // P
  [[0, 0], [0, 2], [1, 0], [1, 1], [1, 2]], // U
  [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1]], // L
  [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]], // V
  [[0, 0], [0, 1], [1, 1], [2, 1], [2, 2]], // Z
  [[0, 0], [0, 1], [0, 2], [1, 2], [1, 3]], // 斜条
]

// 经典 8 块：6 格一块，其余 5 格，合计 41 格
const BASIC_PIECES: readonly Shape[] = [
  ...SHARED_PIECES,
  [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]],
  [[0, 0], [0, 1], [0, 2], [0, 3], [1, 1]],
]

// 标准 10 块：3 个四连方 + 7 个五连方，合计 47 格
const ADVANCED_PIECES: readonly Shape[] = [
  ...SHARED_PIECES,
  [[0, 1], [1, 1], [2, 0], [2, 1]],
  [[0, 1], [0, 2], [1, 0], [1, 1]],
  [[0, 2], [1, 0], [1, 1], [1, 2], [2, 2]],
  [[0, 0], [0, 1], [0, 2], [0, 3]],
]

export type Board = {
  mode: Mode
  grid: (string | null)[][]
  rows: number
  cols: number
  /** 可落子的格子，不含 null */
  ids: string[]
  at: Map<string, { row: number; col: number }>
}

const boardCache = new Map<Mode, Board>()

export function boardOf(mode: Mode): Board {
  const cached = boardCache.get(mode)
  if (cached) return cached
  const grid = mode === "basic" ? BASIC_LAYOUT : ADVANCED_LAYOUT
  const ids: string[] = []
  const at = new Map<string, { row: number; col: number }>()
  grid.forEach((row, r) => {
    row.forEach((id, c) => {
      if (!id) return
      ids.push(id)
      at.set(id, { row: r, col: c })
    })
  })
  const board: Board = {
    mode,
    grid,
    rows: grid.length,
    cols: grid[0].length,
    ids,
    at,
  }
  boardCache.set(mode, board)
  return board
}

export function piecesOf(mode: Mode): readonly Shape[] {
  return mode === "basic" ? BASIC_PIECES : ADVANCED_PIECES
}

export function cellLabel(id: string): string {
  const index = Number(id.slice(1))
  if (id[0] === "m") return MONTH_NAMES[index]
  if (id[0] === "w") return WEEKDAY_NAMES[index]
  return String(index)
}

/** 按周一 = 0、周日 = 6 返回 */
export function weekdayOf(year: number, month: number, day: number): number {
  return (new Date(year, month - 1, day).getDay() + 6) % 7
}

export function parseIsoDate(
  value: string,
): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return null
  }
  return { year, month, day }
}

export function isoToday(): string {
  const date = new Date()
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function targetIds(mode: Mode, target: Target): string[] {
  const ids = [`m${target.month}`, `d${target.day}`]
  if (mode === "advanced") ids.push(`w${target.weekday}`)
  return ids
}

function normalize(cells: ReadonlyArray<readonly [number, number]>): [number, number][] {
  const minRow = Math.min(...cells.map(([row]) => row))
  const minCol = Math.min(...cells.map(([, col]) => col))
  return cells
    .map(([row, col]) => [row - minRow, col - minCol] as [number, number])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
}

/** 旋转/翻转后归一化到左上角；返回的第一格是最上最左的实心格 */
export function orient(
  shape: Shape,
  rotation: number,
  mirrored: boolean,
): [number, number][] {
  let cells = shape.map(([row, col]) => [row, col] as [number, number])
  if (mirrored) cells = cells.map(([row, col]) => [row, -col])
  const turns = ((rotation % 4) + 4) % 4
  for (let i = 0; i < turns; i += 1) {
    cells = cells.map(([row, col]) => [col, -row])
  }
  return normalize(cells)
}

export function shapeBounds(shape: Shape): { rows: number; cols: number } {
  let rows = 0
  let cols = 0
  for (const [row, col] of shape) {
    rows = Math.max(rows, row + 1)
    cols = Math.max(cols, col + 1)
  }
  return { rows, cols }
}

/**
 * 以点到的格子为拼块左上角实心格，返回占用的格子。
 * 放不下（越界）时返回 null；目标格/重叠由调用方检查。
 */
export function placementCells(
  mode: Mode,
  piece: number,
  rotation: number,
  mirrored: boolean,
  anchorId: string,
): string[] | null {
  const shape = piecesOf(mode)[piece]
  if (!shape) return null
  const board = boardOf(mode)
  const anchor = board.at.get(anchorId)
  if (!anchor) return null
  const oriented = orient(shape, rotation, mirrored)
  const [anchorRow, anchorCol] = oriented[0]
  const cells: string[] = []
  for (const [row, col] of oriented) {
    const id = board.grid[anchor.row + row - anchorRow]?.[
      anchor.col + col - anchorCol
    ]
    if (!id) return null
    cells.push(id)
  }
  return cells
}

/** 拼块占用的格子里最上、再最左的一格，也就是放置时的锚点 */
export function topLeftCell(mode: Mode, cells: readonly string[]): string | null {
  const board = boardOf(mode)
  let bestId: string | null = null
  let bestRow = Infinity
  let bestCol = Infinity
  for (const id of cells) {
    const at = board.at.get(id)
    if (!at) return null
    if (at.row < bestRow || (at.row === bestRow && at.col < bestCol)) {
      bestRow = at.row
      bestCol = at.col
      bestId = id
    }
  }
  return bestId
}

/**
 * 拖拽定位：把拼块包围盒中心大致放到 centerCell。
 * 先找居中候选；居中候选都放不下时，再向附近最多约一格兜底，
 * 保证拥挤位置/留空格旁边旋转后也能找到可放点。
 * centerCell 本身是否允许放置由调用方判断。
 */
export function placementNearCenter(
  mode: Mode,
  piece: number,
  rotation: number,
  mirrored: boolean,
  centerCell: string,
  blocked: ReadonlySet<string> = new Set(),
): string[] | null {
  const board = boardOf(mode)
  const center = board.at.get(centerCell)
  if (!center) return null
  const shape = piecesOf(mode)[piece]
  if (!shape) return null

  const oriented = orient(shape, rotation, mirrored)
  const [anchorRow, anchorCol] = oriented[0]
  const { rows, cols } = shapeBounds(oriented)
  const idealRow = center.row - ((rows - 1) / 2 - anchorRow)
  const idealCol = center.col - ((cols - 1) / 2 - anchorCol)

  type Candidate = {
    cells: string[]
    covers: boolean
    distance: number
    row: number
    col: number
  }

  function better(current: Candidate | null, next: Candidate): Candidate {
    if (!current) return next
    if (next.distance < current.distance) return next
    if (next.distance === current.distance && next.covers && !current.covers) {
      return next
    }
    if (
      next.distance === current.distance
      && next.covers === current.covers
      && (next.row < current.row
        || (next.row === current.row && next.col < current.col))
    ) {
      return next
    }
    return current
  }

  function evaluate(row: number, col: number): Candidate | null {
    const anchorId = board.grid[row]?.[col]
    if (!anchorId) return null
    const cells = placementCells(mode, piece, rotation, mirrored, anchorId)
    if (!cells) return null
    if (cells.some(id => blocked.has(id))) return null
    return {
      cells,
      covers: cells.includes(centerCell),
      distance: (row - idealRow) ** 2 + (col - idealCol) ** 2,
      row,
      col,
    }
  }

  const centeredRows = [...new Set([Math.floor(idealRow), Math.ceil(idealRow)])]
  const centeredCols = [...new Set([Math.floor(idealCol), Math.ceil(idealCol)])]
  let centeredBest: Candidate | null = null
  for (const row of centeredRows) {
    for (const col of centeredCols) {
      const candidate = evaluate(row, col)
      if (candidate) centeredBest = better(centeredBest, candidate)
    }
  }
  if (centeredBest) return centeredBest.cells

  let expandedBest: Candidate | null = null
  for (let row = Math.floor(idealRow) - 1; row <= Math.ceil(idealRow) + 1; row += 1) {
    for (let col = Math.floor(idealCol) - 1; col <= Math.ceil(idealCol) + 1; col += 1) {
      const candidate = evaluate(row, col)
      if (candidate) expandedBest = better(expandedBest, candidate)
    }
  }
  return expandedBest?.cells ?? null
}

type Placement = {
  mask: bigint
  cells: string[]
  rotation: number
  mirrored: boolean
}

type OrientedShape = {
  cells: [number, number][]
  rotation: number
  mirrored: boolean
}

type SolverData = {
  bitOf: Map<string, number>
  allMask: bigint
  placements: Placement[][]
}

const solverCache = new Map<Mode, SolverData>()

function orientations(shape: Shape): OrientedShape[] {
  const unique = new Map<string, OrientedShape>()
  for (let rotation = 0; rotation < 4; rotation += 1) {
    for (const mirrored of [false, true]) {
      const cells = orient(shape, rotation, mirrored)
      const key = JSON.stringify(cells)
      if (!unique.has(key)) unique.set(key, { cells, rotation, mirrored })
    }
  }
  return [...unique.values()]
}

function solverData(mode: Mode): SolverData {
  const cached = solverCache.get(mode)
  if (cached) return cached
  const board = boardOf(mode)
  const bitOf = new Map<string, number>()
  board.ids.forEach((id, index) => bitOf.set(id, index))
  const allMask = (1n << BigInt(board.ids.length)) - 1n
  const placements = piecesOf(mode).map((shape) => {
    const seen = new Set<bigint>()
    const list: Placement[] = []
    for (const oriented of orientations(shape)) {
      const { rows, cols } = shapeBounds(oriented.cells)
      for (let row = 0; row + rows <= board.rows; row += 1) {
        for (let col = 0; col + cols <= board.cols; col += 1) {
          let mask = 0n
          const cells: string[] = []
          let fits = true
          for (const [r, c] of oriented.cells) {
            const id = board.grid[row + r]?.[col + c]
            const bit = id ? bitOf.get(id) : undefined
            if (bit === undefined) {
              fits = false
              break
            }
            mask |= 1n << BigInt(bit)
            cells.push(id as string)
          }
          if (!fits || seen.has(mask)) continue
          seen.add(mask)
          list.push({
            mask,
            cells,
            rotation: oriented.rotation,
            mirrored: oriented.mirrored,
          })
        }
      }
    }
    return list
  })
  const data = { bitOf, allMask, placements }
  solverCache.set(mode, data)
  return data
}

/**
 * 求完整解。placed 是已经放好的拼块，会被锁定；返回剩余拼块的摆法。
 * 无解返回 null。
 */
export function solve(
  mode: Mode,
  target: readonly string[],
  placed: readonly Placed[] = [],
): Placed[] | null {
  const data = solverData(mode)
  const targetSet = new Set(target)
  let targetMask = 0n
  for (const id of targetSet) {
    const bit = data.bitOf.get(id)
    if (bit === undefined) return null
    targetMask |= 1n << BigInt(bit)
  }

  const used = new Set<number>()
  let lockedMask = 0n
  for (const item of placed) {
    if (
      !Number.isInteger(item.piece)
      || item.piece < 0
      || item.piece >= data.placements.length
      || used.has(item.piece)
    ) {
      return null
    }
    used.add(item.piece)
    for (const id of item.cells) {
      const bit = data.bitOf.get(id)
      if (bit === undefined) return null
      const mask = 1n << BigInt(bit)
      if ((lockedMask & mask) !== 0n || (targetMask & mask) !== 0n) return null
      lockedMask |= mask
    }
  }

  const available = data.allMask & ~(targetMask | lockedMask)
  const order: number[] = []
  for (let piece = 0; piece < data.placements.length; piece += 1) {
    if (!used.has(piece)) order.push(piece)
  }
  const chosen: Placed[] = []

  function search(covered: bigint): boolean {
    if (covered === available) return true
    const rest = available & ~covered
    const low = rest & -rest
    if (low === 0n) return false
    for (const piece of order) {
      if (used.has(piece)) continue
      for (const placement of data.placements[piece]) {
        if ((placement.mask & low) === 0n) continue
        if ((placement.mask & ~available) !== 0n) continue
        if ((placement.mask & covered) !== 0n) continue
        used.add(piece)
        chosen.push({
          piece,
          cells: placement.cells,
          rotation: placement.rotation,
          mirrored: placement.mirrored,
        })
        if (search(covered | placement.mask)) return true
        chosen.pop()
        used.delete(piece)
      }
    }
    return false
  }

  return search(0n) ? chosen.slice() : null
}

/** 从当前局面找一块可以放的拼块 */
export function hint(
  mode: Mode,
  target: readonly string[],
  placed: readonly Placed[] = [],
): Placed | null {
  const solution = solve(mode, target, placed)
  return solution && solution.length > 0 ? solution[0] : null
}
