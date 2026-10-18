// 定时器生命周期：UI 挂载时启动，卸载时停掉，测试不会留下跑动的循环
import { rebalanceEquips, tick } from "./game.ts"
import { save } from "./storage.ts"

let timers: Array<ReturnType<typeof setInterval>> = []

export function startLoop(paused: () => boolean) {
  stopLoop()
  timers = [
    setInterval(() => tick(paused()), 500),
    setInterval(() => {
      rebalanceEquips(false)
      save()
    }, 5000),
  ]
}

export function stopLoop() {
  for (const t of timers) clearInterval(t)
  timers = []
}
