// mir2 React UI 冒烟测试：node --import tsx --test test/mir2/ui.test.tsx
// 只测「引擎事件 → DOM」这条链：挂载、存档键、控制按钮与首领弹窗
import assert from "node:assert/strict"
import fs from "node:fs"
import test, { after } from "node:test"
import { JSDOM } from "jsdom"

// 先把 DOM 搭起来，再动态导入任何碰 DOM 的模块
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://localhost/mir2/",
  pretendToBeVisual: true,
})
const w = dom.window
globalThis.window = w as unknown as Window & typeof globalThis
globalThis.document = w.document
globalThis.localStorage = w.localStorage
globalThis.screen = w.screen
globalThis.Event = w.Event
globalThis.MouseEvent = w.MouseEvent
globalThis.HTMLElement = w.HTMLElement
globalThis.Element = w.Element
globalThis.Node = w.Node
globalThis.getComputedStyle = w.getComputedStyle.bind(w)
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// 数据表用本地 JSON 顶替 fetch（页面用相对 URL data/*.json）
const dataDir = new URL("../../public/mir2/data/", import.meta.url)
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const file = String(input).replace(/^.*\//, "").replace(/\?.*$/, "")
  return { json: async () => JSON.parse(fs.readFileSync(new URL(file, dataDir), "utf8")) } as Response
}) as typeof globalThis.fetch

const { act } = await import("react")
const { createRoot } = await import("react-dom/client")
const Game = await import("../../lib/mir2/game.ts")
const { save, load } = await import("../../lib/mir2/storage.ts")
const { default: Mir2Game } = await import("../../components/mir2/Mir2Game")

const container = w.document.createElement("div")
w.document.body.appendChild(container)
const root = createRoot(container)
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })
const render = () => act(async () => root.render(<Mir2Game />))
const click = (el: Element | null) =>
  act(async () => (el as HTMLElement).dispatchEvent(new w.MouseEvent("click", { bubbles: true })))
const $ = (sel: string) => container.querySelector(sel)
const $$ = (sel: string) => container.querySelectorAll(sel)

test("挂载 → 数据加载 → 主界面渲染", async () => {
  w.localStorage.clear()
  await render()
  await flush()

  assert.ok($("#chars"), "有角色区")
  assert.equal($$(".mir2-col").length, 3, "三职业角色卡")
  for (const key of ["warrior", "mage", "taoist"]) assert.ok($("#char-" + key), key + " 卡存在")
  assert.ok($("#bag"), "背包区")
  assert.equal($("#bag")!.textContent!.includes("空空如也"), true, "空背包提示")
  assert.equal($$(".gold-num").length, 2, "两处金币（顶栏 + 背包）")
  assert.equal($(".gold-num")!.textContent, "0", "初始金币 0")
  assert.equal($("#speed-val")!.textContent, "1", "初始倍速 1")
  assert.equal($("#btn-run")!.textContent, "⏸ 暂停", "初始运行中")
  assert.ok($("#btn-boss"), "挑战首领按钮")
  assert.equal($("#modal")!.classList.contains("open"), false, "弹窗默认关闭")
})

test("存档键 mir2-save-v1 写入并读回，金币随引擎状态重渲染", async () => {
  Game.S.gold = 12345
  assert.equal(save(), true, "写入成功")
  assert.ok(w.localStorage.getItem("mir2-save-v1"), "存档键存在")
  assert.equal(JSON.parse(w.localStorage.getItem("mir2-save-v1")!).gold, 12345, "金币已落盘")

  Game.S.gold = 0
  assert.equal(load(), true, "读回成功")
  assert.equal(Game.S.gold, 12345, "金币已恢复")

  // 触发一次引擎事件 → 界面从引擎状态重渲染
  await click($("#btn-run"))
  assert.equal($("#btn-run")!.textContent, "▶ 继续", "暂停后按钮翻转")
  assert.equal($(".gold-num")!.textContent, "12,345", "金币按引擎状态显示")
  await click($("#btn-run"))
  assert.equal($("#btn-run")!.textContent, "⏸ 暂停", "继续后按钮复位")
})

test("升速按钮改引擎状态并重渲染，首领弹窗开合", async () => {
  Game.S.gold = 100
  await click($("#btn-speed-up"))
  assert.equal(Game.S.speedMax, 2, "解锁 ×2")
  assert.equal(Game.S.speed, 2, "当前速度拉到新上限")
  assert.equal(Game.S.gold, 0, "扣费 100")
  assert.equal($("#speed-val")!.textContent, "2", "速度显示更新")

  // 未满 35 级：点挑战首领只弹门槛说明
  await click($("#btn-boss"))
  assert.ok($("#modal")!.classList.contains("open"), "门槛弹窗打开")
  assert.ok($("#modal-title")!.textContent!.includes("挑战首领"), "标题为挑战首领")
  await click($("#modal-close"))
  assert.equal($("#modal")!.classList.contains("open"), false, "关闭弹窗")

  // 三人 41 级：列出全部首领
  for (const c of Game.S.chars) c.level = 41
  await click($("#btn-boss"))
  assert.equal($$(".boss-row").length, 17, "17 只首领")
  assert.equal($$(".boss-action button[data-fight]").length, 17, "全部可挑战")

  // 打第一只：进战斗页，引擎结算后由 bossDone 钩子切到胜利页
  await click($$(".boss-action button[data-fight]")[0])
  assert.ok($("#modal-title")!.textContent!.includes("讨伐"), "进入战斗页")
  let guard = 0
  await act(async () => {
    while (Game.S.challenge && !Game.S.challenge.done && guard++ < 5000) Game.challengeTick()
  })
  assert.ok(Game.S.challenge && Game.S.challenge.done, "首领已击败")
  assert.ok($("#modal-title")!.textContent!.includes("击败首领"), "切到胜利页")

  await click($("#modal-close"))
  assert.ok(!Game.S.challenge, "关闭弹窗时清掉挑战态")

  // 收尾：停掉挂机（卸载在 after 里统一做，清掉定时器）
  Game.S.running = false
})

after(async () => {
  await act(async () => {
    root.unmount()
  })
})
