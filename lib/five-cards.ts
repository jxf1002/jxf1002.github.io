// 五张牌魔术纯逻辑：随机发牌、按花色/排列编码，以及存档校验
export type Card = { suit: number; rank: number }

export type Puzzle = {
  /** 扣牌：面朝下的那张，也是玩家要猜的答案 */
  hidden: Card
  /** 第一张明牌，与扣牌同花色 */
  key: Card
  /** 后三张明牌，按排列顺序编码 d */
  order: Card[]
}

export const SUIT_CODES = ["s", "h", "d", "c"] as const
export const SUIT_NAMES = ["黑桃", "红桃", "方块", "梅花"] as const
export const RANK_NAMES = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
] as const

// 六种排列依次表示 d = 1..6；顺序来自「按点数升序、同点花色强度升序」排好的三张牌
const PERMUTATIONS = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
]

export const DECK: Card[] = Array.from({ length: 52 }, (_, i) => ({
  suit: Math.floor(i / 13),
  rank: (i % 13) + 1,
}))

export function cardId(card: Card): string {
  return `${SUIT_CODES[card.suit]}${card.rank}`
}

export function cardName(card: Card): string {
  return `${SUIT_NAMES[card.suit]}${RANK_NAMES[card.rank - 1]}`
}

export function sameCard(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank
}

/** 点数升序；同点数按花色强度从弱到强：梅花 < 方块 < 红桃 < 黑桃 */
export function compareCards(a: Card, b: Card): number {
  return a.rank - b.rank || b.suit - a.suit
}

export function isCard(value: unknown): value is Card {
  if (!value || typeof value !== "object") return false
  const card = value as Record<string, unknown>
  return (
    typeof card.suit === "number"
    && typeof card.rank === "number"
    && Number.isInteger(card.suit)
    && Number.isInteger(card.rank)
    && card.suit >= 0
    && card.suit <= 3
    && card.rank >= 1
    && card.rank <= 13
  )
}

/**
 * 从 5 张牌生成谜题：找同花色的一对，选好方向让 d 在 1..6，
 * 剩下三张排序后按 d 对应的排列摆出。
 */
export function makePuzzle(cards: Card[]): Puzzle {
  if (cards.length !== 5 || new Set(cards.map(cardId)).size !== 5) {
    throw new Error("需要 5 张互不相同的牌")
  }

  let pair: [Card, Card] | undefined
  for (let i = 0; i < cards.length && !pair; i += 1) {
    for (let j = i + 1; j < cards.length; j += 1) {
      if (cards[i].suit === cards[j].suit) {
        pair = [cards[i], cards[j]]
        break
      }
    }
  }
  if (!pair) throw new Error("5 张牌里一定有一对同花色")

  const [a, b] = pair
  const diff = (b.rank - a.rank + 13) % 13
  if (diff === 0) throw new Error("同花色对子不能是同一点数")
  const key = diff <= 6 ? a : b
  const hidden = diff <= 6 ? b : a
  const d = diff <= 6 ? diff : 13 - diff

  const rest = cards
    .filter((card) => !sameCard(card, key) && !sameCard(card, hidden))
    .sort(compareCards)
  const order = PERMUTATIONS[d - 1].map((i) => rest[i])
  return { hidden, key, order }
}

export function randomPuzzle(): Puzzle {
  const pool = [...DECK]
  for (let i = 0; i < 5; i += 1) {
    const j = i + Math.floor(Math.random() * (pool.length - i))
    const temp = pool[i]
    pool[i] = pool[j]
    pool[j] = temp
  }
  return makePuzzle(pool.slice(0, 5))
}

/** 已知 P 和后三张，解出扣牌 */
export function solve(key: Card, order: Card[]): Card {
  const sorted = [...order].sort(compareCards)
  const ids = sorted.map(cardId)
  const positions = order.map((card) => ids.indexOf(cardId(card)))
  const d = PERMUTATIONS.findIndex((perm) =>
    perm.every((value, i) => value === positions[i]),
  ) + 1
  if (d < 1) throw new Error("后三张不是有效的排列")
  return { suit: key.suit, rank: ((key.rank - 1 + d) % 13) + 1 }
}

/** 校验 localStorage 里的题目，同时确认它能被解回扣牌 */
export function isPuzzle(value: unknown): value is Puzzle {
  if (!value || typeof value !== "object") return false
  const puzzle = value as Partial<Puzzle>
  if (!isCard(puzzle.hidden) || !isCard(puzzle.key)) return false
  if (!Array.isArray(puzzle.order) || puzzle.order.length !== 3) return false
  if (!puzzle.order.every(isCard)) return false
  const all = [puzzle.hidden, puzzle.key, ...puzzle.order]
  if (new Set(all.map(cardId)).size !== 5) return false
  return sameCard(solve(puzzle.key, puzzle.order), puzzle.hidden)
}
