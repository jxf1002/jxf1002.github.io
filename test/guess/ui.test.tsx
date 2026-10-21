// 猜数字 UI 冒烟：挂载 → 提交 → 提示（只填不交）→ 放弃 → 刷新恢复
// node --import tsx --test test/guess/ui.test.tsx
import assert from "node:assert/strict"
import test from "node:test"
import { JSDOM } from "jsdom"

// 先搭 DOM，再动态导入任何碰 DOM 的模块
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: "https://localhost/guess/",
  pretendToBeVisual: true,
})
const w = dom.window
globalThis.window = w as unknown as Window & typeof globalThis
globalThis.document = w.document
globalThis.localStorage = w.localStorage
globalThis.Event = w.Event
globalThis.KeyboardEvent = w.KeyboardEvent
globalThis.MouseEvent = w.MouseEvent
globalThis.HTMLElement = w.HTMLElement
globalThis.Element = w.Element
globalThis.Node = w.Node
globalThis.getComputedStyle = w.getComputedStyle.bind(w)
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const { act } = await import("react")
const { createRoot } = await import("react-dom/client")
const { default: GuessGame } = await import("../../components/guess/GuessGame")
const Guess = await import("../../lib/guess.ts")

const SAVE_KEY = "guess-save-v1"
const RECORD_KEY = "guess-records-v1"
const ANSWER = "4286"

let container: HTMLElement
let root: ReturnType<typeof createRoot>

// 固定答案，测试不依赖随机题目
function seed(answer = ANSWER) {
  w.localStorage.clear()
  w.localStorage.setItem(
    SAVE_KEY,
    JSON.stringify({ answer, rounds: [], status: "playing" }),
  )
}

async function mount() {
  container = w.document.createElement("div")
  w.document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root.render(<GuessGame />))
}

async function unmount() {
  await act(async () => root.unmount())
  container.remove()
}

const inputs = () => Array.from(container.querySelectorAll("input"))
const rows = () => Array.from(container.querySelectorAll("tbody tr"))
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
const press = async (el: Element, key: string) => {
  await act(async () => {
    el.dispatchEvent(new w.KeyboardEvent("keydown", { key, bubbles: true }))
  })
}
// 逐格输入（React 受控 input 要走原生 setter 才能触发 onChange）
async function type(code: string) {
  const list = inputs()
  for (let i = 0; i < Guess.LENGTH; i += 1) {
    const el = list[i] as HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(
      w.HTMLInputElement.prototype,
      "value",
    )!.set!
    await act(async () => {
      setter.call(el, code[i])
      el.dispatchEvent(new w.Event("input", { bubbles: true }))
    })
  }
}
const saved = () => JSON.parse(w.localStorage.getItem(SAVE_KEY)!)

test("挂载：4 格输入、表头、按钮、空状态", async () => {
  seed()
  await mount()
  assert.equal(inputs().length, 4)
  assert.equal(rows().length, 0)
  assert.ok(container.textContent?.includes("还没有记录"))
  const heads = Array.from(container.querySelectorAll("thead th")).map(
    (th) => th.textContent?.trim(),
  )
  assert.deepEqual(heads, ["猜测", "完全正确", "数字正确"])
  button("确认")
  button("提示")
  button("放弃")
  await unmount()
})

test("回车提交：历史 +1、剩余次数 -1、写入存档", async () => {
  seed()
  await mount()
  await type("0123")
  await press(inputs()[3], "Enter")
  assert.equal(rows().length, 1)
  assert.equal(rows()[0].children[0].textContent, "0123")
  assert.equal(rows()[0].children[1].textContent, "0")
  assert.equal(rows()[0].children[2].textContent, "1")
  assert.ok(container.textContent?.includes("还剩 9 次机会"))
  assert.equal(saved().rounds.length, 1)
  await unmount()
})

test("提示：只填充不提交，确认后才成为记录", async () => {
  seed()
  await mount()
  await click(button("提示"))
  assert.equal(inputs().map((i) => (i as HTMLInputElement).value).join(""), "0123")
  assert.equal(rows().length, 0)
  assert.ok(container.textContent?.includes("还剩 10 次机会"))
  assert.equal(saved().rounds.length, 0)

  await click(button("确认"))
  assert.equal(rows().length, 1)
  assert.equal(rows()[0].children[0].textContent, "0123")
  await unmount()
})

test("提示结果可手动改，提交的是改后的数字", async () => {
  seed()
  await mount()
  await click(button("提示"))
  await type("9876")
  await click(button("确认"))
  assert.equal(rows()[0].children[0].textContent, "9876")
  await unmount()
})

test("刷新恢复：进度还在，提示基于恢复的历史", async () => {
  seed()
  await mount()
  await type("0123")
  await press(inputs()[3], "Enter")
  await unmount()

  await mount()
  assert.equal(rows().length, 1)
  await click(button("提示"))
  const expected = Guess.hint([
    { guess: "0123", ...Guess.score(ANSWER, "0123") },
  ])
  assert.equal(inputs().map((i) => (i as HTMLInputElement).value).join(""), expected)
  await unmount()
})

test("放弃：揭晓答案、收起操作、写入战绩", async () => {
  seed()
  await mount()
  await click(button("放弃"))
  assert.equal(inputs().length, 0)
  assert.ok(container.textContent?.includes("答案 4286"))
  assert.ok(container.textContent?.includes("本局已放弃"))
  const records = JSON.parse(w.localStorage.getItem(RECORD_KEY)!)
  assert.equal(records.length, 1)
  assert.equal(records[0].result, "abandon")
  assert.equal(records[0].tries, 0)
  button("再来一局")
  await unmount()
})
