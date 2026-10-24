// 全量验证：两种模式下所有「月/日/星期」组合都有解
// node --import tsx test/calendar/coverage.ts
import {
  MODES,
  solve,
  targetIds,
} from "../../lib/calendar.ts"

const LONG_MONTHS = new Set([4, 6, 9, 11])
let failed = 0

for (const mode of MODES) {
  const started = Date.now()
  let total = 0
  for (let month = 1; month <= 12; month += 1) {
    for (let day = 1; day <= 31; day += 1) {
      if (day > 29 && month === 2) continue
      if (day > 30 && LONG_MONTHS.has(month)) continue
      const weekdays = mode === "advanced" ? [0, 1, 2, 3, 4, 5, 6] : [5]
      for (const weekday of weekdays) {
        total += 1
        const target = targetIds(mode, { month: month - 1, day, weekday })
        if (!solve(mode, target)) {
          failed += 1
          console.error(`✗ ${mode} ${month}/${day} 星期${weekday}`)
        }
      }
    }
  }
  console.log(`✓ ${mode}: ${total} 组合，${Date.now() - started}ms`)
}

if (failed) {
  console.error(`失败 ${failed} 个组合`)
  process.exit(1)
}
console.log("全部组合都有解")
