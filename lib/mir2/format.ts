// 展示格式化：旧 app.js 里的数字 / 时间 / 冷却文案

export function fmtNum(n: number) {
  return n.toLocaleString("zh-CN")
}

export function fmtGold(n: number) {
  if (n < 10000) return fmtNum(n)
  const w = n / 10000
  return (Number.isInteger(w) ? w : w.toFixed(1)) + "万"
}

export function fmtPct(p: number) {
  return (p * 100).toFixed(2) + "%"
}

// 冷却 mm:ss（向上取整到秒）
export function fmtCdShort(ms: number) {
  const s = Math.ceil(ms / 1000)
  const m = (s / 60) | 0
  return m + ":" + String(s % 60).padStart(2, "0")
}

// 掉落记录时间：M/D HH:mm
export function fmtDropTime(at: number) {
  const d = new Date(at)
  const p = (n: number) => String(n).padStart(2, "0")
  return (d.getMonth() + 1) + "/" + d.getDate() + " " + p(d.getHours()) + ":" + p(d.getMinutes())
}
