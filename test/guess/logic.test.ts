// 猜数字纯逻辑：反馈计算、合法性、候选集，以及提示功能（推荐质量 + 异常输入）
import assert from "node:assert/strict"
import test from "node:test"
import {
  LENGTH,
  MAX_TRIES,
  OPENING,
  allCodes,
  candidates,
  hint,
  isPlayable,
  randomCode,
  score,
} from "../../lib/guess.ts"
import type { Round } from "../../lib/guess.ts"

// 用答案反推一轮真实反馈
function round(answer: string, guess: string): Round {
  return { guess, ...score(answer, guess) }
}

// 与 hint 内部一致的「期望剩余候选」代价：sum(n²)
function cost(pool: string[], guess: string): number {
  const buckets = new Array<number>(25).fill(0)
  for (const code of pool) {
    const s = score(code, guess)
    buckets[s.bulls * 5 + s.cows] += 1
  }
  return buckets.reduce((sum, n) => sum + n * n, 0)
}

test("反馈：完全正确 / 位置全错 / 数字全无 / 混合", () => {
  assert.deepEqual(score("1234", "1234"), { bulls: 4, cows: 0 })
  assert.deepEqual(score("1234", "4321"), { bulls: 0, cows: 4 })
  assert.deepEqual(score("1234", "5678"), { bulls: 0, cows: 0 })
  assert.deepEqual(score("1234", "1243"), { bulls: 2, cows: 2 })
})

test("合法性：4 位、不重复、纯数字", () => {
  assert.ok(isPlayable("0123"))
  assert.ok(!isPlayable("0124".slice(0, 3)))
  assert.ok(!isPlayable("0012"))
  assert.ok(!isPlayable("12a4"))
  assert.ok(!isPlayable("１２３４"))
})

test("全部组合：5040 组，不重复且都合法", () => {
  const codes = allCodes()
  assert.equal(codes.length, 5040)
  assert.equal(new Set(codes).size, 5040)
  assert.ok(codes.every(isPlayable))
  assert.ok(isPlayable(randomCode()))
})

test("提示：无历史时返回 0123", () => {
  assert.equal(hint([]), OPENING)
  assert.ok(isPlayable(hint([])))
})

test("提示：永远给出合法且与历史一致的猜测", () => {
  const answer = "4286"
  const rounds: Round[] = []
  for (let i = 0; i < 5 && !rounds.some((r) => r.bulls === LENGTH); i += 1) {
    const guess = hint(rounds)
    assert.ok(isPlayable(guess), `合法：${guess}`)
    const pool = candidates(rounds)
    if (pool.length > 0) assert.ok(pool.includes(guess), `一致：${guess}`)
    rounds.push(round(answer, guess))
  }
})

test("提示：只剩一个候选时直接给答案", () => {
  const answer = "4286"
  const rounds: Round[] = []
  while (candidates(rounds).length > 1 && rounds.length < MAX_TRIES) {
    rounds.push(round(answer, hint(rounds)))
  }
  assert.equal(candidates(rounds).length, 1)
  assert.equal(hint(rounds), answer)
})

test("提示：不推荐已经猜过的组合", () => {
  // 答案不含 0/1/2/3，首猜 0123 得到 0 完全正确 0 数字正确
  const rounds = [round("4567", OPENING)]
  assert.deepEqual(score("4567", OPENING), { bulls: 0, cows: 0 })
  assert.notEqual(hint(rounds), OPENING)
})

test("提示：确为候选集里期望剩余最少的一组", () => {
  const pool = candidates([round("4567", OPENING)])
  const best = Math.min(...pool.map((g) => cost(pool, g)))
  assert.equal(cost(pool, hint([round("4567", OPENING)])), best)
})

test("提示：同一历史结果稳定（平局按数字序）", () => {
  const rounds = [round("4286", OPENING)]
  const first = hint(rounds)
  assert.equal(hint(rounds), first)
  assert.equal(hint([...rounds]), first)
})

test("提示：与历史顺序无关", () => {
  const a = round("4286", OPENING)
  const b = round("4286", "9876")
  assert.equal(hint([a, b]), hint([b, a]))
})

test("提示：反馈自相矛盾时不崩溃，仍给合法猜测", () => {
  // 4 位不重复的前提下 3 个完全正确 + 1 个数字正确不可能出现
  const broken: Round[] = [{ guess: OPENING, bulls: 3, cows: 1 }]
  assert.equal(candidates(broken).length, 0)
  assert.ok(isPlayable(hint(broken)))
})

test(`提示：10 个固定答案都能在 ${MAX_TRIES} 次内猜中且不重复`, () => {
  const answers = [
    "4286",
    "0123",
    "9876",
    "5041",
    "1937",
    "8264",
    "3579",
    "6042",
    "2851",
    "7403",
  ]
  for (const answer of answers) {
    const rounds: Round[] = []
    const seen = new Set<string>()
    while (rounds.length < MAX_TRIES) {
      const guess = hint(rounds)
      assert.ok(isPlayable(guess))
      assert.ok(!seen.has(guess), `${answer} 重复推荐 ${guess}`)
      seen.add(guess)
      const feedback = score(answer, guess)
      rounds.push({ guess, ...feedback })
      if (feedback.bulls === LENGTH) break
    }
    assert.equal(rounds.at(-1)?.guess, answer, `${answer} 命中`)
    assert.ok(rounds.length <= MAX_TRIES, `${answer} 用了 ${rounds.length} 次`)
  }
})
