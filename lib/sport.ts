// 运动模型：四种运动各自的强度曲线、卡路里/心率估算与报告指标
// 卡路里用 MET（代谢当量）换算：(MET × 3.5 × 体重kg / 200) kcal/min，
// MET 参考 ACSM 体力活动纲要的常见区间，按速度线性插值

export type SportId = "run" | "bike" | "swim" | "rope"

export type Metric = { label: string, value: string }

export type SportReport = {
  elapsedSeconds: number
  time: string
  note: string
  metrics: Metric[]
}

/** 14 岁男生约 50kg，插画人物与估算模型用同一体重 */
export const WEIGHT_KG = 50

type SportDef = {
  name: string
  unit: string
  min: number
  max: number
  step: number
  defaultSpeed: number
  /** 滑块两端文案 */
  labels: [string, string]
  /** MET 曲线：[速度或频率, 代谢当量]，线性插值 */
  met: Array<[number, number]>
  /** 动作周期（秒），滑块越快周期越短 */
  cycle: (speed: number) => number
  /** 报告指标（跳绳没有距离，游泳按每 100m 配速） */
  metrics: (speed: number, seconds: number) => Metric[]
}

const SPORTS: Record<SportId, SportDef> = {
  run: {
    name: "跑步",
    unit: "km/h",
    min: 8,
    max: 20,
    step: 1,
    defaultSpeed: 10,
    labels: ["慢跑", "冲刺"],
    met: [
      [8, 8.3],
      [10, 9.8],
      [12, 11.8],
      [14, 13.5],
      [16, 15],
      [20, 19.8],
    ],
    // 一个周期 = 两步：8km/h 约 150 步/分，20km/h 约 200 步/分
    cycle: (speed) => cycleBetween(speed, 8, 20, 0.8, 0.6),
    metrics: (speed, seconds) => [
      { label: "运动时长", value: durationText(seconds) },
      { label: "平均速度", value: speed + " km/h" },
      { label: "估算距离", value: ((speed * seconds) / 3600).toFixed(2) + " km" },
      { label: "卡路里消耗", value: caloriesFor("run", speed, seconds) + " kcal" },
      { label: "平均心率", value: heartRateFor("run", speed) + " bpm" },
      { label: "平均配速", value: clockText(3600 / speed) + " /km" },
    ],
  },
  bike: {
    name: "骑行",
    unit: "km/h",
    min: 15,
    max: 40,
    step: 1,
    defaultSpeed: 22,
    labels: ["休闲骑", "全力蹬"],
    met: [
      [15, 5.5],
      [20, 7.5],
      [25, 10],
      [30, 12],
      [40, 15],
    ],
    // 踏频 65～100 转/分，一圈蹬踏一个周期
    cycle: (speed) => 60 / cadenceFor(speed),
    metrics: (speed, seconds) => [
      { label: "运动时长", value: durationText(seconds) },
      { label: "平均速度", value: speed + " km/h" },
      { label: "骑行距离", value: ((speed * seconds) / 3600).toFixed(2) + " km" },
      { label: "卡路里消耗", value: caloriesFor("bike", speed, seconds) + " kcal" },
      { label: "平均心率", value: heartRateFor("bike", speed) + " bpm" },
      { label: "平均踏频", value: cadenceFor(speed) + " rpm" },
    ],
  },
  swim: {
    name: "游泳",
    unit: "km/h",
    min: 1.5,
    max: 3.5,
    step: 0.1,
    defaultSpeed: 2.2,
    labels: ["蛙泳", "自由泳"],
    met: [
      [1.5, 6.5],
      [2, 8.5],
      [2.5, 10],
      [3, 10.8],
      [3.5, 11.5],
    ],
    // 一次划水 1.5～0.9 秒
    cycle: (speed) => cycleBetween(speed, 1.5, 3.5, 1.5, 0.9),
    metrics: (speed, seconds) => [
      { label: "运动时长", value: durationText(seconds) },
      { label: "平均配速", value: clockText(360 / speed) + " /100m" },
      { label: "游泳距离", value: Math.round((speed * 1000 * seconds) / 3600) + " m" },
      { label: "卡路里消耗", value: caloriesFor("swim", speed, seconds) + " kcal" },
      { label: "平均心率", value: heartRateFor("swim", speed) + " bpm" },
      { label: "划水频率", value: Math.round(20 + speed * 8) + " 次/分" },
    ],
  },
  rope: {
    name: "跳绳",
    unit: "次/分",
    min: 60,
    max: 160,
    step: 5,
    defaultSpeed: 100,
    labels: ["慢速", "快速"],
    met: [
      [60, 8.8],
      [80, 10.5],
      [100, 11.8],
      [120, 12.3],
      [160, 12.8],
    ],
    // 摇绳一圈 = 跳一次
    cycle: (speed) => 60 / speed,
    metrics: (speed, seconds) => [
      { label: "运动时长", value: durationText(seconds) },
      { label: "累计次数", value: Math.round((speed * seconds) / 60) + " 次" },
      { label: "跳跃频率", value: speed + " 次/分" },
      { label: "卡路里消耗", value: caloriesFor("rope", speed, seconds) + " kcal" },
      { label: "平均心率", value: heartRateFor("rope", speed) + " bpm" },
    ],
  },
}

/** 滑块顺序，也是界面上的运动顺序 */
export const SPORT_IDS: SportId[] = ["run", "bike", "swim", "rope"]

export function sportDef(id: SportId): SportDef {
  return SPORTS[id]
}

/** 骑行踏频，跟速度线性相关 */
export function cadenceFor(speed: number): number {
  return Math.round(45 + speed * 1.35)
}

/** 线性插值 MET 表 */
export function metFor(sport: SportId, speed: number): number {
  const table = SPORTS[sport].met
  const first = table[0]
  const last = table[table.length - 1]
  if (speed <= first[0]) return first[1]
  if (speed >= last[0]) return last[1]

  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i]
    if (speed <= x1) {
      const [x0, y0] = table[i - 1]
      return y0 + ((speed - x0) / (x1 - x0)) * (y1 - y0)
    }
  }
  return last[1]
}

export function caloriesFor(
  sport: SportId,
  speed: number,
  seconds: number,
): number {
  const perMinute = (metFor(sport, speed) * 3.5 * WEIGHT_KG) / 200
  return Math.round((perMinute * seconds) / 60)
}

/** 心率跟着强度（MET）走，上限 188 */
export function heartRateFor(sport: SportId, speed: number): number {
  return Math.min(188, Math.round(92 + metFor(sport, speed) * 5.2))
}

/** 动作周期，写成 CSS 能直接用的时间值 */
export function cycleFor(sport: SportId, speed: number): string {
  return SPORTS[sport].cycle(speed).toFixed(2) + "s"
}

/** 滑块进度百分比 */
export function progressFor(sport: SportId, speed: number): number {
  const { min, max } = SPORTS[sport]
  return ((speed - min) / (max - min)) * 100
}

export function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0")
  const seconds = (totalSeconds % 60).toString().padStart(2, "0")
  return minutes + ":" + seconds
}

export function buildReport(
  sport: SportId,
  speed: number,
  rawElapsedSeconds: number,
): SportReport {
  const elapsedSeconds = Math.max(1, Math.floor(rawElapsedSeconds))
  const minutes = elapsedSeconds / 60

  return {
    elapsedSeconds,
    time: durationText(elapsedSeconds),
    note:
      minutes >= 20
        ? "耐力拉满，今天的你很强。卡路里按 50kg 体重模型估算。"
        : minutes >= 5
          ? "节奏稳定，继续保持这份能量。卡路里按 50kg 体重模型估算。"
          : "刚刚活动开，下一次再多一点。卡路里按 50kg 体重模型估算。",
    metrics: SPORTS[sport].metrics(speed, elapsedSeconds),
  }
}

function cycleBetween(
  speed: number,
  min: number,
  max: number,
  slow: number,
  fast: number,
): number {
  return slow + ((speed - min) / (max - min)) * (fast - slow)
}

function durationText(seconds: number): string {
  return seconds < 60 ? seconds + " 秒" : (seconds / 60).toFixed(1) + " 分钟"
}

/** 秒数转 分:秒 */
function clockText(secondsTotal: number): string {
  let minutes = Math.floor(secondsTotal / 60)
  let seconds = Math.round(secondsTotal % 60)
  if (seconds === 60) {
    minutes += 1
    seconds = 0
  }
  return minutes + ":" + seconds.toString().padStart(2, "0")
}
