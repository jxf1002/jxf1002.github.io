// 日历拼图纯逻辑：棋盘、日期、旋转、落子、求解器
import assert from "node:assert/strict"
import test from "node:test"
import {
  MODES,
  MONTH_NAMES,
  WEEKDAY_NAMES,
  boardOf,
  cellLabel,
  hint,
  orient,
  parseIsoDate,
  placementCells,
  placementNearCenter,
  piecesOf,
  shapeBounds,
  solve,
  targetIds,
  topLeftCell,
  weekdayOf,
} from "../../lib/calendar.ts"
import type { Mode, Placed } from "../../lib/calendar.ts"

function targetFor(mode: Mode, iso: string): string[] {
  const parts = parseIsoDate(iso)
  assert.ok(parts, `日期 ${iso} 有效`)
  const weekday = weekdayOf(parts.year, parts.month, parts.day)
  return targetIds(mode, {
    month: parts.month - 1,
    day: parts.day,
    weekday,
  })
}

function assertSolution(
  mode: Mode,
  target: readonly string[],
  solution: readonly Placed[],
): void {
  const board = boardOf(mode)
  const targetSet = new Set(target)
  const used = new Set<number>()
  const covered = new Set<string>()
  for (const item of solution) {
    assert.ok(!used.has(item.piece), "同一块拼图不能放两次")
    used.add(item.piece)
    for (const id of item.cells) {
      assert.ok(board.at.has(id), `格子 ${id} 在棋盘上`)
      assert.ok(!targetSet.has(id), `不能盖住目标格 ${id}`)
      assert.ok(!covered.has(id), `格子 ${id} 不能重复覆盖`)
      covered.add(id)
    }
  }
  assert.equal(used.size, piecesOf(mode).length, "所有拼块都要用上")
  const expected = board.ids.filter(id => !targetSet.has(id))
  assert.equal(covered.size, expected.length, "非目标格要全部盖住")
  for (const id of expected) assert.ok(covered.has(id), `${id} 已覆盖`)
}

test("棋盘：初级 43 格、高级 50 格", () => {
  const basic = boardOf("basic")
  const advanced = boardOf("advanced")
  assert.equal(basic.rows, 7)
  assert.equal(basic.cols, 7)
  assert.equal(basic.ids.length, 43)
  assert.equal(advanced.rows, 8)
  assert.equal(advanced.cols, 7)
  assert.equal(advanced.ids.length, 50)

  for (const mode of MODES) {
    const ids = boardOf(mode).ids
    assert.equal(ids.filter(id => id[0] === "m").length, 12)
    assert.equal(ids.filter(id => id[0] === "d").length, 31)
    assert.equal(
      ids.filter(id => id[0] === "w").length,
      mode === "advanced" ? 7 : 0,
    )
  }
})

test("日期：闰年、星期和非法日期", () => {
  assert.deepEqual(parseIsoDate("2026-10-24"), {
    year: 2026,
    month: 10,
    day: 24,
  })
  assert.equal(parseIsoDate("2026-02-30"), null)
  assert.equal(parseIsoDate("2026-2-3"), null)
  assert.equal(parseIsoDate(""), null)
  // 2026-10-24 是周六；2024-02-29 是周四
  assert.equal(weekdayOf(2026, 10, 24), 5)
  assert.equal(weekdayOf(2024, 2, 29), 3)
})

test("标签：月份、日期、星期", () => {
  const target = targetIds("advanced", { month: 9, day: 24, weekday: 5 })
  assert.deepEqual(target, ["m9", "d24", "w5"])
  assert.deepEqual(
    targetIds("basic", { month: 9, day: 24, weekday: 5 }),
    ["m9", "d24"],
  )
  assert.equal(MONTH_NAMES.length, 12)
  assert.equal(WEEKDAY_NAMES.length, 7)
  assert.equal(cellLabel("m0"), "1月")
  assert.equal(cellLabel("m11"), "12月")
  assert.equal(cellLabel("d24"), "24")
  assert.equal(cellLabel("w5"), "周六")
})

test("拼块：数量、面积和四连方/五连方配比", () => {
  const basic = piecesOf("basic")
  assert.equal(basic.length, 8)
  assert.equal(basic.reduce((sum, shape) => sum + shape.length, 0), 41)

  const advanced = piecesOf("advanced")
  assert.equal(advanced.length, 10)
  assert.equal(advanced.reduce((sum, shape) => sum + shape.length, 0), 47)
  assert.equal(advanced.filter(shape => shape.length === 4).length, 3)
  assert.equal(advanced.filter(shape => shape.length === 5).length, 7)
})

test("拼块：初级/高级相同的 6 块排在最前，形状和顺序一致", () => {
  const basic = piecesOf("basic")
  const advanced = piecesOf("advanced")
  assert.deepEqual(basic.slice(0, 6), advanced.slice(0, 6))
  assert.ok(basic.slice(0, 6).every(shape => shape.length === 5))
})

test("旋转/翻转：格数不变，转四次回到原点", () => {
  for (const mode of MODES) {
    for (const shape of piecesOf(mode)) {
      const base = orient(shape, 0, false)
      assert.equal(orient(shape, 4, false).length, base.length)
      assert.deepEqual(orient(shape, 4, false), base)
      assert.equal(orient(shape, 1, false).length, base.length)
      assert.equal(orient(shape, 0, true).length, base.length)
      const bounds = shapeBounds(orient(shape, 1, true))
      assert.ok(bounds.rows >= 1)
      assert.ok(bounds.cols >= 1)
    }
  }
})

test("落子：以点到的实心格为左上角，越界返回 null", () => {
  assert.deepEqual(
    placementCells("advanced", 0, 0, false, "d1"),
    ["d1", "d2", "d3", "d8", "d9"],
  )
  assert.equal(placementCells("advanced", 0, 0, false, "d7"), null)
  assert.equal(placementCells("advanced", 0, 0, false, "nope"), null)
})

test("拖动定位：按拼块中心吸附，旋转后重新居中", () => {
  const before = placementNearCenter("basic", 6, 0, false, "d16")
  const after = placementNearCenter("basic", 6, 1, false, "d16")
  assert.ok(before)
  assert.ok(after)
  assert.ok(before.includes("d16"))
  assert.ok(after.includes("d16"))
  assert.notDeepEqual(before, after)
  assert.deepEqual(after, ["d8", "d9", "d15", "d16", "d22", "d23"])
})

test("拖动定位：理想位置被挡时在附近找候选", () => {
  const shifted = placementNearCenter(
    "basic",
    6,
    1,
    false,
    "d16",
    new Set(["d8"]),
  )
  assert.ok(shifted)
  assert.ok(!shifted.includes("d8"))
  assert.ok(shifted.includes("d16"))
  assert.deepEqual(shifted, ["d9", "d10", "d16", "d17", "d23", "d24"])
  assert.equal(
    placementNearCenter(
      "basic",
      6,
      1,
      false,
      "d16",
      new Set(boardOf("basic").ids),
    ),
    null,
  )
})

test("拖动定位：居中位置被内容挡住时向附近兜底", () => {
  const shifted = placementNearCenter(
    "basic",
    6,
    1,
    false,
    "d16",
    new Set(["d8", "d9"]),
  )
  assert.ok(shifted)
  assert.ok(!shifted.includes("d8"))
  assert.ok(!shifted.includes("d9"))
  assert.deepEqual(shifted, ["d15", "d16", "d22", "d23", "d29", "d30"])
})

test("拖动定位：棋盘边缘可以向内补一格", () => {
  const edge = placementNearCenter("advanced", 0, 0, false, "d1")
  assert.ok(edge)
})

test("锚点：拼块最上、再最左的格子", () => {
  assert.equal(topLeftCell("advanced", ["d1", "d2", "d3", "d10", "d11"]), "d1")
  assert.equal(topLeftCell("advanced", ["d3", "d2"]), "d2")
  assert.equal(topLeftCell("advanced", ["nope"]), null)
})

test("求解器：返回的拼块方向能还原占用的格子", () => {
  for (const mode of MODES) {
    const target = targetFor(mode, "2026-10-24")
    const solution = solve(mode, target)
    assert.ok(solution)
    for (const item of solution) {
      const anchor = topLeftCell(mode, item.cells)
      assert.ok(anchor)
      const cells = placementCells(
        mode,
        item.piece,
        item.rotation ?? 0,
        item.mirrored ?? false,
        anchor,
      )
      assert.ok(cells)
      assert.deepEqual([...cells].sort(), [...item.cells].sort())
    }
  }
})

test("求解器：样例日期都能给出完整解", () => {
  const dates = ["2026-10-24", "2024-02-29", "2026-01-01", "2000-12-31"]
  for (const mode of MODES) {
    for (const iso of dates) {
      const target = targetFor(mode, iso)
      const solution = solve(mode, target)
      assert.ok(solution, `${mode} ${iso} 有解`)
      assertSolution(mode, target, solution)
    }
  }
})

test("提示：尊重已经放好的拼块，并且可以继续解完", () => {
  const target = targetFor("advanced", "2026-10-24")
  const first = solve("advanced", target)
  assert.ok(first)
  const locked = first[0]

  const rest = solve("advanced", target, [locked])
  assert.ok(rest)
  assert.ok(rest.every(item => item.piece !== locked.piece))
  assertSolution("advanced", target, [locked, ...rest])

  const next = hint("advanced", target, [locked])
  assert.ok(next)
  assert.notEqual(next.piece, locked.piece)
})

test("求解器：非法输入和无解局面返回 null", () => {
  const target = targetFor("basic", "2026-10-24")
  assert.equal(solve("basic", [...target, "w0"]), null)
  assert.equal(solve("basic", target, [{ piece: 0, cells: ["m9"] }]), null)
  assert.equal(solve("basic", target, [{ piece: 0, cells: ["d1"] }]), null)
  assert.equal(
    solve("basic", target, [
      { piece: 0, cells: ["d1"] },
      { piece: 0, cells: ["d2"] },
    ]),
    null,
  )
  assert.equal(solve("basic", target, [{ piece: 99, cells: ["d1"] }]), null)
})
