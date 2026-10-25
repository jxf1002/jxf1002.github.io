// 运动页纯逻辑：强度、卡路里、心率与报告文案
import assert from "node:assert/strict"
import test from "node:test"
import { buildReport, cycleFor, formatTime, metFor } from "../lib/sport.ts"

test("运动：四种运动的强度、卡路里、心率与报告文案", () => {
  // 跑步 10km/h × 10 分钟：MET 9.8，50kg 下 86 kcal
  const run = buildReport("run", 10, 600)
  assert.equal(run.time, "10.0 分钟")
  assert.deepEqual(run.metrics, [
    { label: "运动时长", value: "10.0 分钟" },
    { label: "平均速度", value: "10 km/h" },
    { label: "估算距离", value: "1.67 km" },
    { label: "卡路里消耗", value: "86 kcal" },
    { label: "平均心率", value: "143 bpm" },
    { label: "平均配速", value: "6:00 /km" },
  ])
  assert.equal(
    run.note,
    "节奏稳定，继续保持这份能量。卡路里按 50kg 体重模型估算。",
  )

  // 骑行看踏频，游泳看每 100m 配速，跳绳没有距离、只有次数
  assert.equal(
    buildReport("bike", 22, 600).metrics.at(-1)?.value,
    "75 rpm",
  )
  assert.equal(buildReport("swim", 2.2, 600).metrics[1].value, "2:44 /100m")
  assert.equal(buildReport("swim", 2.2, 600).metrics[2].value, "367 m")
  assert.equal(buildReport("rope", 100, 600).metrics[1].value, "1000 次")
  assert.equal(buildReport("rope", 100, 600).metrics.length, 5)

  // 强度曲线单调，动作周期随强度变快
  assert.ok(metFor("bike", 40) > metFor("bike", 20))
  assert.equal(cycleFor("rope", 60), "1.00s")
  assert.equal(cycleFor("run", 20), "0.60s")
  assert.equal(formatTime(0), "00:00")
  assert.equal(formatTime(65), "01:05")
  assert.equal(buildReport("run", 8, 20).time, "20 秒")
  assert.equal(
    buildReport("run", 8, 1500).note,
    "耐力拉满，今天的你很强。卡路里按 50kg 体重模型估算。",
  )
})
