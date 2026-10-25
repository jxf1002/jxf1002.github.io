// 五张牌魔术 UI 冒烟：挂载 → 猜对/猜错 → 刷新恢复 → 下一局
// node --import tsx --test test/five-cards/ui.test.tsx
import assert from "node:assert/strict"
import test from "node:test"
import { JSDOM } from "jsdom"
import type { Card } from "../../lib/five-cards.ts"

// 先搭 DOM，再动态导入任何碰 DOM 的模块
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: "https://localhost/five-cards/",
  pretendToBeVisual: true,
})
const w = dom.window
globalThis.window = w as unknown as Window & typeof globalThis
globalThis.document = w.document
globalThis.localStorage = w.localStorage
globalThis.Event = w.Event
globalThis.MouseEvent = w.MouseEvent
globalThis.HTMLElement = w.HTMLElement
globalThis.Element = w.Element
globalThis.Node = w.Node
globalThis.getComputedStyle = w.getComputedStyle.bind(w)
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const { act } = await import("react")
const { createRoot } = await import("react-dom/client")
const { default: FiveCardsGame } = await import(
  "../../components/five-cards/FiveCardsGame"
)
const Five = await import("../../lib/five-cards.ts")

const SAVE_KEY = "five-cards-save-v1"
const HIDDEN_ID = "s7"
// 唯一同花色对是 S1/S7，d=6；后三张 H3,C5,D9 按 321 排列
const PUZZLE = Five.makePuzzle([
  { suit: 0, rank: 1 },
  { suit: 0, rank: 7 },
  { suit: 1, rank: 3 },
  { suit: 2, rank: 9 },
  { suit: 3, rank: 5 },
])

let container: HTMLElement
let root: ReturnType<typeof createRoot>

function seed(guess: Card | null = null) {
  w.localStorage.clear()
  w.localStorage.setItem(SAVE_KEY, JSON.stringify({ puzzle: PUZZLE, guess }))
}

async function mount() {
  container = w.document.createElement("div")
  w.document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root.render(<FiveCardsGame />))
}

async function unmount() {
  await act(async () => root.unmount())
  container.remove()
}

const topImages = () => Array.from(container.querySelectorAll(".five-cards-spread img"))
const boardButtons = () =>
  Array.from(container.querySelectorAll<HTMLButtonElement>(".five-cards-board button"))
const cardButton = (id: string) => {
  const el = container.querySelector(`[data-card="${id}"]`)
  assert.ok(el, `有 ${id} 这张牌`)
  return el
}
const button = (text: string) => {
  const el = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === text,
  )
  assert.ok(el, `有「${text}」按钮`)
  return el
}
const click = async (el: Element) => {
  await act(async () => {
    el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }))
  })
}
const saved = () => JSON.parse(w.localStorage.getItem(SAVE_KEY)!)

test("挂载：五张牌、52 张牌盘、4 张明牌灰显", async () => {
  seed()
  await mount()
  assert.equal(topImages().length, 5)
  assert.ok(topImages()[0].getAttribute("src")?.endsWith("/cards/webp/back.webp"))
  assert.equal(boardButtons().length, 52)
  assert.equal(boardButtons().filter((b) => b.disabled).length, 4)
  assert.equal(container.querySelectorAll(".is-used").length, 4)
  assert.ok(container.textContent?.includes("只有一次机会"))
  assert.equal(topImages()[1].getAttribute("src"), "/cards/webp/s1.webp")
  await unmount()
})

test("猜对：翻开扣牌、提示正确、只能猜一次", async () => {
  seed()
  await mount()
  await click(cardButton(HIDDEN_ID))
  assert.ok(container.textContent?.includes("猜对了"))
  assert.ok(container.textContent?.includes("黑桃7"))
  assert.equal(topImages()[0].getAttribute("src"), "/cards/webp/s7.webp")
  assert.ok(cardButton(HIDDEN_ID).classList.contains("is-answer"))
  assert.equal(boardButtons().filter((b) => b.disabled).length, 52)
  assert.deepEqual(saved().guess, { suit: 0, rank: 7 })
  button("开始下一局")
  await unmount()
})

test("猜错：标出答案和错误选择，写入存档", async () => {
  seed()
  await mount()
  await click(cardButton("s2"))
  assert.ok(container.textContent?.includes("猜错了"))
  assert.ok(container.textContent?.includes("黑桃7"))
  assert.ok(cardButton("s2").classList.contains("is-wrong"))
  assert.ok(cardButton(HIDDEN_ID).classList.contains("is-answer"))
  assert.equal(topImages()[0].getAttribute("src"), "/cards/webp/s7.webp")
  assert.deepEqual(saved().guess, { suit: 0, rank: 2 })
  await unmount()
})

test("刷新：已猜的结果和扣牌仍在，不重新出题", async () => {
  seed({ suit: 0, rank: 2 })
  await mount()
  assert.ok(container.textContent?.includes("猜错了"))
  assert.equal(topImages()[0].getAttribute("src"), "/cards/webp/s7.webp")
  assert.equal(boardButtons().filter((b) => b.disabled).length, 52)
  await unmount()
})

test("刷新：未猜时保持同一题", async () => {
  seed()
  await mount()
  const before = w.localStorage.getItem(SAVE_KEY)
  await unmount()
  await mount()
  assert.equal(w.localStorage.getItem(SAVE_KEY), before)
  assert.ok(topImages()[0].getAttribute("src")?.endsWith("/cards/webp/back.webp"))
  assert.equal(boardButtons().filter((b) => b.disabled).length, 4)
  await unmount()
})

test("开始下一局：新题、收起结果、恢复可选", async () => {
  seed({ suit: 0, rank: 2 })
  await mount()
  await click(button("开始下一局"))
  assert.equal(saved().guess, null)
  assert.ok(topImages()[0].getAttribute("src")?.endsWith("/cards/webp/back.webp"))
  assert.ok(!container.textContent?.includes("猜错了"))
  assert.equal(boardButtons().filter((b) => b.disabled).length, 4)
  await unmount()
})
