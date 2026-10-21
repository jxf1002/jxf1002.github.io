// 五张牌魔术纯逻辑：编解码、排序、随机出题、存档校验
import assert from "node:assert/strict"
import test from "node:test"
import {
  DECK,
  cardId,
  cardName,
  compareCards,
  isCard,
  isPuzzle,
  makePuzzle,
  randomPuzzle,
  sameCard,
  solve,
} from "../../lib/five-cards.ts"
import type { Card } from "../../lib/five-cards.ts"

// 与题目规则一致的排列表
const PERMS = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
]

function card(suit: number, rank: number): Card {
  return { suit, rank }
}

test("牌组：52 张、四花色各 13 张", () => {
  assert.equal(DECK.length, 52)
  assert.equal(new Set(DECK.map(cardId)).size, 52)
  for (let suit = 0; suit < 4; suit += 1) {
    assert.equal(DECK.filter((c) => c.suit === suit).length, 13)
  }
  assert.equal(cardId(card(0, 1)), "s1")
  assert.equal(cardId(card(3, 13)), "c13")
  assert.equal(cardName(card(0, 1)), "黑桃A")
  assert.equal(cardName(card(3, 13)), "梅花K")
})

test("牌面校验：只接受 0-3 花色和 1-13 整数点数", () => {
  assert.ok(isCard(card(0, 1)))
  assert.ok(isCard(card(3, 13)))
  assert.ok(!isCard({ suit: 4, rank: 1 }))
  assert.ok(!isCard({ suit: -1, rank: 1 }))
  assert.ok(!isCard({ suit: 0, rank: 0 }))
  assert.ok(!isCard({ suit: 0, rank: 14 }))
  assert.ok(!isCard({ suit: 0, rank: 1.5 }))
  assert.ok(!isCard({ suit: "0", rank: 1 }))
  assert.ok(!isCard(null))
})

test("排序：点数升序，同点数 梅花 < 方块 < 红桃 < 黑桃", () => {
  const cards = [
    card(3, 5),
    card(1, 5),
    card(0, 5),
    card(2, 5),
    card(0, 1),
  ]
  assert.deepEqual(
    [...cards].sort(compareCards).map(cardId),
    ["s1", "c5", "d5", "h5", "s5"],
  )
})

test("所有同花色点对：都能用 d=1..6 编码并解回", () => {
  for (let suit = 0; suit < 4; suit += 1) {
    for (let a = 1; a <= 13; a += 1) {
      for (let b = a + 1; b <= 13; b += 1) {
        // 另外三张各来自不同花色，保证这一对是唯一同花色对
        const fillers = [0, 1, 2, 3]
          .filter((s) => s !== suit)
          .map((s, i) => card(s, ((a + i * 4) % 13) + 1))
        const hand = [card(suit, a), card(suit, b), ...fillers]
        const puzzle = makePuzzle(hand)

        assert.equal(puzzle.hidden.suit, suit)
        assert.ok(
          sameCard(puzzle.key, card(suit, a))
          || sameCard(puzzle.key, card(suit, b)),
        )
        assert.ok(
          sameCard(puzzle.hidden, card(suit, a))
          || sameCard(puzzle.hidden, card(suit, b)),
        )
        assert.ok(!sameCard(puzzle.key, puzzle.hidden))

        // P 往后数到扣牌的距离必须在 1..6
        const d = (puzzle.hidden.rank - puzzle.key.rank + 13) % 13
        assert.ok(d >= 1 && d <= 6, `d=${d}`)

        assert.ok(sameCard(solve(puzzle.key, puzzle.order), puzzle.hidden))
        const ids = [puzzle.hidden, puzzle.key, ...puzzle.order].map(cardId)
        assert.equal(new Set(ids).size, 5)
      }
    }
  }
})

test("排列：后三张的六种顺序依次对应 d=1..6", () => {
  const key = card(2, 13)
  const rest = [card(0, 1), card(1, 2), card(3, 3)]
  for (let d = 1; d <= 6; d += 1) {
    const order = PERMS[d - 1].map((i) => rest[i])
    assert.deepEqual(solve(key, order), card(2, d))
  }
})

test("同点数的后三张按花色从弱到强排序", () => {
  const puzzle = makePuzzle([
    card(0, 2),
    card(0, 8),
    card(1, 5),
    card(2, 5),
    card(3, 5),
  ])
  assert.ok(sameCard(puzzle.hidden, card(0, 8)))
  // d=6 → 排列 321，后三张从 C5,D5,H5 变成 H5,D5,C5
  assert.deepEqual(puzzle.order.map((c) => c.suit), [1, 2, 3])
  assert.ok(sameCard(solve(puzzle.key, puzzle.order), puzzle.hidden))
})

test("回归：同点数 K 按花色从弱到强，C K / S 7 / H K 编码为 213", () => {
  const order = [card(3, 13), card(0, 7), card(1, 13)]
  // 标准升序 S7, C K, H K；展示 C K, S7, H K → d=3
  assert.ok(sameCard(solve(card(0, 1), order), card(0, 4)))

  const puzzle = makePuzzle([
    card(2, 1),
    card(2, 4),
    card(3, 13),
    card(0, 7),
    card(1, 13),
  ])
  assert.ok(sameCard(puzzle.key, card(2, 1)))
  assert.ok(sameCard(puzzle.hidden, card(2, 4)))
  assert.deepEqual(puzzle.order.map(cardId), ["c13", "s7", "h13"])
})

test("随机出题：2000 局都能解回且五张互不重复", () => {
  for (let i = 0; i < 2000; i += 1) {
    const puzzle = randomPuzzle()
    assert.ok(isPuzzle(puzzle))
    assert.ok(sameCard(solve(puzzle.key, puzzle.order), puzzle.hidden))
    assert.equal(
      new Set([puzzle.hidden, puzzle.key, ...puzzle.order].map(cardId)).size,
      5,
    )
  }
})

test("非法手牌直接报错", () => {
  assert.throws(() => makePuzzle([card(0, 1)]))
  assert.throws(() =>
    makePuzzle([
      card(0, 1),
      card(0, 1),
      card(1, 2),
      card(2, 3),
      card(3, 4),
    ]),
  )
})

test("isPuzzle：拒绝坏存档", () => {
  const puzzle = randomPuzzle()
  assert.ok(isPuzzle(puzzle))
  assert.ok(!isPuzzle(null))
  assert.ok(!isPuzzle({ ...puzzle, order: puzzle.order.slice(0, 2) }))
  assert.ok(
    !isPuzzle({
      ...puzzle,
      order: [puzzle.order[0], puzzle.order[0], puzzle.order[2]],
    }),
  )
  assert.ok(
    !isPuzzle({
      ...puzzle,
      hidden: {
        ...puzzle.hidden,
        rank: puzzle.hidden.rank === 13 ? 1 : puzzle.hidden.rank + 1,
      },
    }),
  )
})
