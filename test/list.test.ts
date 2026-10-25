// 三个数据页共用的排序/分页
import assert from "node:assert/strict"
import test from "node:test"
import { paginate, sortRows } from "../lib/list.ts"

test("分页：空数组也有第 1 页", () => {
  assert.deepEqual(paginate([], 1, 10), {
    total: 0,
    totalPages: 1,
    page: 1,
    items: [],
  })
})

test("分页：页码越界夹回最后一页", () => {
  const result = paginate([1, 2, 3], 99, 2)
  assert.equal(result.page, 2)
  assert.equal(result.totalPages, 2)
  assert.deepEqual(result.items, [3])
})

test("分页：pageSize 大于总数", () => {
  const result = paginate([1, 2, 3], 1, 50)
  assert.deepEqual(result.items, [1, 2, 3])
  assert.equal(result.totalPages, 1)
})

test("排序：数字列升降序", () => {
  const rows = [{ n: 10 }, { n: 9 }, { n: null }]
  assert.deepEqual(
    sortRows(rows, "n", "asc").map((row) => row.n),
    [9, 10, null],
  )
  assert.deepEqual(
    sortRows(rows, "n", "desc").map((row) => row.n),
    [10, 9, null],
  )
})

test("排序：字符串列按中文排序，不是 NaN 静默不排", () => {
  const rows = [{ name: "上海" }, { name: "北京" }, { name: null }]
  assert.deepEqual(
    sortRows(rows, "name", "asc").map((row) => row.name),
    ["北京", "上海", null],
  )
  assert.deepEqual(
    sortRows(rows, "name", "desc").map((row) => row.name),
    ["上海", "北京", null],
  )
})
