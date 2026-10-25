// 把按月 JSON 合并成按年 JSON：页面只加载年文件，请求数从 23 个降到 2 个。
// 用法：npm run data:cars（月数据更新后跑一次；CI 的 check-build 会校验年文件是否同步）
import { readFileSync, writeFileSync } from "node:fs"
import type { MonthSales } from "../lib/car-sales.ts"

const dir = new URL("../public/data/car-sales/", import.meta.url)
const index = JSON.parse(
  readFileSync(new URL("index.json", dir), "utf8"),
) as { months: string[] }

const byYear = new Map<string, MonthSales[]>()
for (const month of index.months) {
  const data = JSON.parse(
    readFileSync(new URL(`${month}.json`, dir), "utf8"),
  ) as MonthSales
  const year = month.slice(0, 4)
  byYear.set(year, [...(byYear.get(year) ?? []), data])
}

for (const [year, months] of byYear) {
  writeFileSync(
    new URL(`${year}.json`, dir),
    JSON.stringify({ year, months }) + "\n",
  )
}

console.log("car-sales 年文件：", [...byYear.keys()].sort().join(", "))
