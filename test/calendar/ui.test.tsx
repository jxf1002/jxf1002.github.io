// 日历拼图 UI 冒烟：拖拽放置/旋转/翻转、悬浮按钮、取回方向、提示通关
// node --import tsx --test test/calendar/ui.test.tsx
import assert from "node:assert/strict"
import test from "node:test"
import { JSDOM } from "jsdom"

// 先搭 DOM，再动态导入任何碰 DOM 的模块
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: "https://localhost/calendar/",
  pretendToBeVisual: true,
})
const w = dom.window
globalThis.window = w as unknown as Window & typeof globalThis
globalThis.document = w.document
globalThis.localStorage = w.localStorage
globalThis.Event = w.Event
globalThis.MouseEvent = w.MouseEvent
globalThis.KeyboardEvent = w.KeyboardEvent
globalThis.HTMLElement = w.HTMLElement
globalThis.HTMLInputElement = w.HTMLInputElement
globalThis.Element = w.Element
globalThis.Node = w.Node
globalThis.getComputedStyle = w.getComputedStyle.bind(w)
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const { act } = await import("react")
const { createRoot } = await import("react-dom/client")
const { default: CalendarGame } = await import(
  "../../components/calendar/CalendarGame"
)
const Cal = await import("../../lib/calendar.ts")

let container: HTMLElement
let root: ReturnType<typeof createRoot>

async function mount() {
  container = w.document.createElement("div")
  w.document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root.render(<CalendarGame />))
}

async function unmount() {
  await act(async () => root.unmount())
  container.remove()
}

const cell = (id: string) =>
  container.querySelector<HTMLButtonElement>(`[data-cell="${id}"]`)
const pieceButton = (piece: number) =>
  container.querySelector<HTMLButtonElement>(`[data-piece="${piece}"]`)
const modeButton = (mode: string) => {
  const el = container.querySelector<HTMLButtonElement>(`[data-mode="${mode}"]`)
  assert.ok(el, `有 ${mode} 模式按钮`)
  return el
}
const action = (name: string) => {
  const el = container.querySelector<HTMLButtonElement>(
    `[data-action="${name}"]`,
  )
  assert.ok(el, `有 ${name} 按钮`)
  return el
}
const click = async (el: Element) => {
  await act(async () => {
    el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }))
  })
}
const status = () =>
  container.querySelector('[role="status"]')?.textContent?.trim() ?? ""

async function flush() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

// 受控 date input 要走原生 setter 才能触发 React onChange
async function setDate(value: string) {
  const input = container.querySelector<HTMLInputElement>('input[type="date"]')
  assert.ok(input, "有日期输入框")
  const setter = Object.getOwnPropertyDescriptor(
    w.HTMLInputElement.prototype,
    "value",
  )?.set
  assert.ok(setter)
  await act(async () => {
    setter.call(input, value)
    input.dispatchEvent(new w.Event("input", { bubbles: true }))
    input.dispatchEvent(new w.Event("change", { bubbles: true }))
  })
}

type PointerOptions = {
  pointerType?: string
  isPrimary?: boolean
  pointerId?: number
}

function pointerEvent(
  type: string,
  x: number,
  y: number,
  options: PointerOptions = {},
) {
  const event = new w.MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0,
  })
  Object.defineProperty(event, "isPrimary", {
    value: options.isPrimary ?? true,
  })
  Object.defineProperty(event, "pointerId", {
    value: options.pointerId ?? 1,
  })
  Object.defineProperty(event, "pointerType", {
    value: options.pointerType ?? "mouse",
  })
  return event
}

async function sendPointer(
  el: Element,
  type: string,
  x: number,
  y: number,
  options?: PointerOptions,
) {
  await act(async () => {
    el.dispatchEvent(pointerEvent(type, x, y, options))
  })
}

async function dragPiece(
  el: Element,
  x: number,
  y: number,
  options?: PointerOptions,
) {
  await sendPointer(el, "pointerdown", 0, 0, options)
  await sendPointer(el, "pointermove", x, y, options)
  await sendPointer(el, "pointerup", x, y, options)
}

// jsdom 没有真实布局，elementFromPoint 用桩指定落点
function stubPoint(cellId: string | null | (() => string | null)) {
  const original = w.document.elementFromPoint
  Object.defineProperty(w.document, "elementFromPoint", {
    configurable: true,
    value: () => {
      const id = typeof cellId === "function" ? cellId() : cellId
      return id ? cell(id) : null
    },
  })
  return () => {
    Object.defineProperty(w.document, "elementFromPoint", {
      configurable: true,
      value: original,
    })
  }
}

function targets() {
  return new Set(
    Cal.targetIds("advanced", { month: 9, day: 24, weekday: 5 }),
  )
}

function expectedAt(
  piece: number,
  rotation: number,
  mirrored: boolean,
  center: string,
) {
  return Cal.placementNearCenter(
    "advanced",
    piece,
    rotation,
    mirrored,
    center,
    targets(),
  )
}

async function placeViaDrag(piece: number, center: string) {
  const restore = stubPoint(center)
  try {
    const tray = pieceButton(piece)
    assert.ok(tray)
    await dragPiece(tray, 120, 120)
  } finally {
    restore()
  }
  await flush()
  const expected = expectedAt(piece, 0, false, center)
  assert.ok(expected)
  return expected
}

test("日期和模式：目标格、按钮文案、没有留空字样", async () => {
  await mount()
  try {
    await setDate("2026-10-24")
    assert.equal(modeButton("basic").textContent?.trim(), "初级")
    assert.equal(modeButton("advanced").textContent?.trim(), "高级")
    assert.match(
      container.querySelector(".page-header p")?.textContent ?? "",
      /拖动拼块完成拼图，空格旋转，Tab 键翻转。/,
    )
    assert.equal(
      container.querySelector(".calendar-date")?.textContent?.trim(),
      "",
    )
    assert.equal(
      container
        .querySelector(".calendar-date input")
        ?.getAttribute("aria-label"),
      "日期",
    )
    assert.ok(cell("m9")?.classList.contains("is-target"))
    assert.ok(cell("d24")?.classList.contains("is-target"))
    assert.equal(cell("w5"), null)
    assert.equal(cell("m9")?.textContent?.trim(), "10月")
    assert.equal(cell("d24")?.textContent?.trim(), "24")

    await click(modeButton("advanced"))
    assert.ok(cell("w5")?.classList.contains("is-target"))
    assert.equal(cell("w5")?.textContent?.trim(), "周六")
    assert.equal(container.querySelectorAll(".calendar-cell").length, 56)
    assert.match(status(), /拖动拼块到棋盘/)
  } finally {
    await unmount()
  }
})

test("交互：点选不再放置，拖拽才放置，单击取回", async () => {
  await mount()
  try {
    await setDate("2026-10-24")
    await click(modeButton("advanced"))
    await click(pieceButton(0)!)
    await click(cell("d1")!)
    assert.equal(
      container.querySelectorAll(".calendar-cell.is-covered").length,
      0,
    )

    const expected = await placeViaDrag(0, "d1")
    for (const id of expected) {
      assert.ok(cell(id)?.classList.contains("is-covered"), id)
    }
    assert.equal(pieceButton(0), null)

    await click(cell(expected[0])!)
    assert.ok(pieceButton(0))
    assert.equal(
      container.querySelectorAll(".calendar-cell.is-covered").length,
      0,
    )
  } finally {
    await unmount()
  }
})

test("换日期会清空已放的拼块", async () => {
  await mount()
  try {
    await setDate("2026-10-24")
    await click(modeButton("advanced"))
    const expected = await placeViaDrag(0, "d1")
    assert.ok(cell(expected[0])?.classList.contains("is-covered"))

    await setDate("2026-10-25")
    assert.equal(
      container.querySelectorAll(".calendar-cell.is-covered").length,
      0,
    )
    assert.ok(cell("d25")?.classList.contains("is-target"))
  } finally {
    await unmount()
  }
})

test("提示：连续提示可以拼完并显示完成", async () => {
  await mount()
  try {
    await setDate("2026-10-24")
    for (let i = 0; i < 8; i += 1) {
      await click(action("hint"))
    }
    assert.ok(container.querySelector(".calendar-win"))
    assert.match(status(), /拼好了/)
    assert.equal(
      container.querySelector(".calendar-win")?.textContent?.trim(),
      "拼好了！",
    )
    assert.equal(
      container.querySelectorAll(".calendar-cell.is-covered").length,
      41,
    )
    assert.ok(!cell("m9")?.classList.contains("is-covered"))
    assert.ok(!cell("d24")?.classList.contains("is-covered"))
    assert.equal(action("hint").disabled, true)

    await click(action("reset"))
    assert.equal(
      container.querySelectorAll(".calendar-cell.is-covered").length,
      0,
    )
    assert.equal(container.querySelector(".calendar-win"), null)
  } finally {
    await unmount()
  }
})

test("拖拽：从托盘拖到棋盘", async () => {
  await mount()
  const restore = stubPoint("d1")
  try {
    await setDate("2026-10-24")
    await click(modeButton("advanced"))
    const expected = expectedAt(0, 0, false, "d1")
    assert.ok(expected)
    const tray = pieceButton(0)
    assert.ok(tray)
    await dragPiece(tray, 120, 120)
    assert.equal(
      container.querySelector(".calendar-drag-actions"),
      null,
    )
    assert.equal(pieceButton(0), null)
    for (const id of expected) {
      assert.ok(cell(id)?.classList.contains("is-covered"), id)
    }
  } finally {
    restore()
    await unmount()
  }
})

test("拖拽：松手用最后显示的预览，不按松手坐标重算", async () => {
  await mount()
  let point: string | null = "d1"
  const restore = stubPoint(() => point)
  try {
    await setDate("2026-10-24")
    await click(modeButton("advanced"))
    const expected = expectedAt(0, 0, false, "d1")
    assert.ok(expected)

    const tray = pieceButton(0)
    assert.ok(tray)
    await sendPointer(tray, "pointerdown", 0, 0)
    await sendPointer(tray, "pointermove", 120, 120)
    assert.ok(
      container.querySelectorAll(".calendar-cell.is-preview").length > 0,
    )

    // 手指在松手前漂到旁边的留空格
    point = "m9"
    await sendPointer(tray, "pointerup", 120, 120)

    assert.equal(pieceButton(0), null)
    for (const id of expected) {
      assert.ok(cell(id)?.classList.contains("is-covered"), id)
    }
  } finally {
    restore()
    await unmount()
  }
})

test("拖拽：托盘旋转/翻转同步，落点无效也保留方向", async () => {
  await mount()
  const restore = stubPoint("m9")
  try {
    await setDate("2026-10-24")
    await click(modeButton("advanced"))
    const tray = pieceButton(0)
    assert.ok(tray)
    await sendPointer(tray, "pointerdown", 0, 0)
    await sendPointer(tray, "pointermove", 120, 120)
    assert.ok(pieceButton(0)?.classList.contains("is-drag-source"))

    await act(async () => {
      w.dispatchEvent(new w.KeyboardEvent("keydown", {
        key: " ",
        bubbles: true,
        cancelable: true,
      }))
      w.dispatchEvent(new w.KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        cancelable: true,
      }))
    })
    assert.equal(pieceButton(0)?.dataset.rotation, "1")
    assert.equal(pieceButton(0)?.dataset.mirrored, "true")

    await sendPointer(tray, "pointerup", 120, 120)
    assert.ok(pieceButton(0))
    assert.equal(pieceButton(0)?.dataset.rotation, "1")
    assert.equal(pieceButton(0)?.dataset.mirrored, "true")
    assert.equal(
      container.querySelectorAll(".calendar-cell.is-covered").length,
      0,
    )
    assert.match(status(), /放不下/)
  } finally {
    restore()
    await unmount()
  }
})

test("拖拽：已放下的拼块可以换位置", async () => {
  await mount()
  try {
    await setDate("2026-10-24")
    await click(modeButton("advanced"))
    const oldCells = await placeViaDrag(0, "d1")
    const expected = expectedAt(0, 0, false, "d18")
    assert.ok(expected)

    const source = cell(oldCells[0])
    assert.ok(source)
    const restore = stubPoint("d18")
    try {
      await dragPiece(source, 140, 140)
    } finally {
      restore()
    }
    for (const id of expected) {
      assert.ok(cell(id)?.classList.contains("is-covered"), id)
    }
    for (const id of oldCells) {
      if (!expected.includes(id)) {
        assert.ok(!cell(id)?.classList.contains("is-covered"), id)
      }
    }
  } finally {
    await unmount()
  }
})

test("拖拽：棋盘拼块旋转后只有一个影子且能放下", async () => {
  await mount()
  try {
    await setDate("2026-10-24")
    await click(modeButton("advanced"))
    const initial = await placeViaDrag(0, "d1")
    const source = cell(initial[0])
    assert.ok(source)

    const center = Cal.boardOf("advanced").ids.find((id) => {
      if (targets().has(id)) return false
      return expectedAt(0, 1, false, id) !== null
    })
    assert.ok(center)
    const expected = expectedAt(0, 1, false, center)
    assert.ok(expected)

    const restore = stubPoint(center)
    try {
      await sendPointer(source, "pointerdown", 0, 0)
      await sendPointer(source, "pointermove", 120, 120)
      assert.equal(
        container.querySelectorAll(".calendar-drag-ghost").length,
        1,
      )
      assert.ok(source.classList.contains("is-drag-source"))
      assert.equal(
        container.querySelectorAll(".calendar-cell.is-covered").length,
        0,
      )

      await act(async () => {
        w.dispatchEvent(new w.KeyboardEvent("keydown", {
          key: " ",
          bubbles: true,
          cancelable: true,
        }))
      })
      // 模拟空格激活焦点按钮：拖动期间这次 click 必须被忽略
      await click(source)
      assert.equal(
        container.querySelectorAll(".calendar-drag-ghost").length,
        1,
      )
      assert.equal(
        container.querySelectorAll(".calendar-cell.is-covered").length,
        0,
      )

      await sendPointer(source, "pointerup", 120, 120)
    } finally {
      restore()
    }

    for (const id of expected) {
      assert.ok(cell(id)?.classList.contains("is-covered"), id)
    }
    assert.equal(container.querySelectorAll(".calendar-drag-ghost").length, 0)
  } finally {
    await unmount()
  }
})

test("拖拽：棋盘落点不允许时回到原位", async () => {
  await mount()
  try {
    await setDate("2026-10-24")
    await click(modeButton("advanced"))
    const initial = await placeViaDrag(0, "d1")
    const source = cell(initial[0])
    assert.ok(source)

    const restore = stubPoint("m9")
    try {
      await dragPiece(source, 140, 140)
    } finally {
      restore()
    }
    for (const id of initial) {
      assert.ok(cell(id)?.classList.contains("is-covered"), id)
    }
    assert.match(status(), /放不下/)
  } finally {
    await unmount()
  }
})

test("拖动中：空格旋转、Tab 翻转，取回保留方向", async () => {
  await mount()
  try {
    await setDate("2026-10-24")
    await click(modeButton("advanced"))
    const center = Cal.boardOf("advanced").ids.find((id) => {
      if (targets().has(id)) return false
      return expectedAt(0, 1, true, id) !== null
    })
    assert.ok(center)
    const expected = expectedAt(0, 1, true, center)
    assert.ok(expected)

    const restore = stubPoint(center)
    try {
      const tray = pieceButton(0)
      assert.ok(tray)
      await sendPointer(tray, "pointerdown", 0, 0)
      await sendPointer(tray, "pointermove", 120, 120)

      let spacePrevented = false
      await act(async () => {
        const event = new w.KeyboardEvent("keydown", {
          key: " ",
          bubbles: true,
          cancelable: true,
        })
        w.dispatchEvent(event)
        spacePrevented = event.defaultPrevented
      })
      let tabPrevented = false
      await act(async () => {
        const event = new w.KeyboardEvent("keydown", {
          key: "Tab",
          bubbles: true,
          cancelable: true,
        })
        w.dispatchEvent(event)
        tabPrevented = event.defaultPrevented
      })
      assert.equal(spacePrevented, true)
      assert.equal(tabPrevented, true)
      assert.equal(pieceButton(0)?.dataset.rotation, "1")
      assert.equal(pieceButton(0)?.dataset.mirrored, "true")
      assert.equal(container.querySelector(".calendar-drag-actions"), null)

      await sendPointer(tray, "pointerup", 120, 120)
    } finally {
      restore()
    }

    for (const id of expected) {
      assert.ok(cell(id)?.classList.contains("is-covered"), id)
    }
    assert.equal(pieceButton(0), null)

    await flush()
    await click(cell(expected[0])!)
    assert.ok(pieceButton(0))
    assert.equal(pieceButton(0)?.dataset.rotation, "1")
    assert.equal(pieceButton(0)?.dataset.mirrored, "true")
  } finally {
    await unmount()
  }
})

test("移动端拖动：悬浮旋转/翻转按钮支持多点触碰", async () => {
  await mount()
  try {
    await setDate("2026-10-24")
    await click(modeButton("advanced"))
    const center = Cal.boardOf("advanced").ids.find((id) => {
      if (targets().has(id)) return false
      return expectedAt(0, 1, true, id) !== null
    })
    assert.ok(center)
    const expected = expectedAt(0, 1, true, center)
    assert.ok(expected)

    const restore = stubPoint(center)
    try {
      const tray = pieceButton(0)
      assert.ok(tray)
      const touch = { pointerType: "touch" }
      await sendPointer(tray, "pointerdown", 0, 0, touch)
      await sendPointer(tray, "pointermove", 120, 120, touch)

      const rotate = container.querySelector<HTMLButtonElement>(
        '[data-drag-action="rotate"]',
      )
      const flip = container.querySelector<HTMLButtonElement>(
        '[data-drag-action="flip"]',
      )
      assert.ok(rotate)
      assert.ok(flip)
      assert.ok(rotate.querySelector("svg"))
      assert.ok(flip.querySelector("svg"))
      assert.equal(rotate.textContent?.trim(), "旋转")
      assert.equal(flip.textContent?.trim(), "翻转")

      const second = {
        pointerType: "touch",
        isPrimary: false,
        pointerId: 2,
      }
      await sendPointer(rotate, "pointerdown", 0, 0, second)
      assert.equal(pieceButton(0)?.dataset.rotation, "1")
      await sendPointer(flip, "pointerdown", 0, 0, second)
      assert.equal(pieceButton(0)?.dataset.mirrored, "true")

      await sendPointer(tray, "pointerup", 120, 120, touch)
    } finally {
      restore()
    }

    for (const id of expected) {
      assert.ok(cell(id)?.classList.contains("is-covered"), id)
    }
    assert.equal(container.querySelector(".calendar-drag-actions"), null)
  } finally {
    await unmount()
  }
})

test("移动端点选拼块：显示悬浮按钮，可旋转/翻转后再拖", async () => {
  await mount()
  try {
    await setDate("2026-10-24")
    await click(modeButton("advanced"))
    const touch = { pointerType: "touch" }
    const tray = pieceButton(0)
    assert.ok(tray)

    // 单点选中
    await sendPointer(tray, "pointerdown", 0, 0, touch)
    await sendPointer(tray, "pointerup", 0, 0, touch)
    assert.equal(pieceButton(0)?.getAttribute("aria-pressed"), "true")
    assert.match(status(), /已选中第 1 块/)

    const rotate = container.querySelector<HTMLButtonElement>(
      '[data-drag-action="rotate"]',
    )
    const flip = container.querySelector<HTMLButtonElement>(
      '[data-drag-action="flip"]',
    )
    assert.ok(rotate)
    assert.ok(flip)
    assert.ok(rotate.querySelector("svg"))
    assert.ok(flip.querySelector("svg"))
    assert.equal(rotate.textContent?.trim(), "旋转")
    assert.equal(flip.textContent?.trim(), "翻转")

    await sendPointer(rotate, "pointerdown", 0, 0, touch)
    assert.equal(pieceButton(0)?.dataset.rotation, "1")
    await sendPointer(flip, "pointerdown", 0, 0, touch)
    assert.equal(pieceButton(0)?.dataset.mirrored, "true")

    // 再点一次取消选中
    await sendPointer(tray, "pointerdown", 0, 0, touch)
    await sendPointer(tray, "pointerup", 0, 0, touch)
    assert.equal(pieceButton(0)?.getAttribute("aria-pressed"), "false")
    assert.equal(container.querySelector(".calendar-drag-actions"), null)

    // 重新选中后直接拖动，沿用刚才调整的方向
    await sendPointer(tray, "pointerdown", 0, 0, touch)
    await sendPointer(tray, "pointerup", 0, 0, touch)
    assert.equal(pieceButton(0)?.getAttribute("aria-pressed"), "true")

    const center = Cal.boardOf("advanced").ids.find((id) => {
      if (targets().has(id)) return false
      return expectedAt(0, 1, true, id) !== null
    })
    assert.ok(center)
    const expected = expectedAt(0, 1, true, center)
    assert.ok(expected)

    const restore = stubPoint(center)
    try {
      await sendPointer(tray, "pointerdown", 0, 0, touch)
      await sendPointer(tray, "pointermove", 120, 120, touch)
      await sendPointer(tray, "pointerup", 120, 120, touch)
    } finally {
      restore()
    }

    for (const id of expected) {
      assert.ok(cell(id)?.classList.contains("is-covered"), id)
    }
    assert.equal(container.querySelector(".calendar-drag-actions"), null)
  } finally {
    await unmount()
  }
})
