export const MIN_SPEED = 1
export const MAX_SPEED = 20

export type SportReport = {
  elapsedSeconds: number
  minutes: number
  time: string
  speed: string
  distance: string
  calories: string
  heartRate: string
  pace: string
  note: string
}

export function runnerDuration(speed: number): string {
  return (1.05 - (speed / MAX_SPEED) * 0.88).toFixed(2) + "s"
}

export function speedProgress(speed: number): number {
  return ((speed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED)) * 100
}

export function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0")
  const seconds = (totalSeconds % 60).toString().padStart(2, "0")
  return minutes + ":" + seconds
}

export function buildReport(
  speed: number,
  rawElapsedSeconds: number,
): SportReport {
  const elapsedSeconds = Math.max(1, Math.floor(rawElapsedSeconds))
  const distance = (speed * elapsedSeconds) / 3600
  const minutes = elapsedSeconds / 60
  const calories = distance * 60
  const heartRate = Math.min(190, Math.round(108 + speed * 3.8))
  const paceMinutes = 60 / speed
  const paceWholeMinutes = Math.floor(paceMinutes)
  const paceSeconds = Math.round((paceMinutes - paceWholeMinutes) * 60)
    .toString()
    .padStart(2, "0")

  return {
    elapsedSeconds,
    minutes,
    time: minutes < 1 ? elapsedSeconds + " 秒" : minutes.toFixed(1) + " 分钟",
    speed: speed + " km/h",
    distance: distance.toFixed(2) + " km",
    calories: Math.round(calories) + " kcal",
    heartRate: heartRate + " bpm",
    pace: paceWholeMinutes + ":" + paceSeconds + " /km",
    note:
      minutes >= 20
        ? "耐力协议完成，今天的你很强。卡路里按 60kg 体重模型估算。"
        : minutes >= 5
          ? "节奏稳定，继续保持这份能量。卡路里按 60kg 体重模型估算。"
          : "短时冲刺完成，下一次再多跑一点。卡路里按 60kg 体重模型估算。",
  }
}
