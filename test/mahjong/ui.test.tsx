// 麻将 React UI 冒烟测试：node --import tsx --test test/mahjong/ui.test.tsx
// 只测「引擎事件 → DOM」这条链：挂载、开局、手牌/牌河、body 态、存档、听牌弹窗
import assert from "node:assert/strict"
import test from "node:test"
import { JSDOM } from "jsdom"
import { SN } from "../../lib/mahjong/constants.ts"

// 先把 DOM 搭起来，再动态导入任何碰 DOM 的模块
const dom = new JSDOM("<!doctype html><html class=\"dark\"><body></body></html>", {
  url: "https://localhost/mahjong/",
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
globalThis.matchMedia = ((q: string) => ({
  matches: false,
  media: q,
  onchange: null,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
  dispatchEvent: () => false,
})) as unknown as typeof globalThis.matchMedia
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const { act } = await import("react")
const { createRoot } = await import("react-dom/client")
const Game = await import("../../lib/mahjong/game.ts")
const { default: MahjongGame } = await import("../../components/mahjong/MahjongGame")
const { HUMAN } = await import("../../lib/mahjong/constants.ts")

type Tile = { type: string; num: number; suit: string; id: string }
const T = (type: string, num = 0): Tile =>
  type === "zhong"
    ? { type, num: 0, suit: "红中", id: "红中" }
    : { type, num, suit: SN[type], id: num + type }

const G = Game.G
const container = w.document.createElement("div")
w.document.body.appendChild(container)
const root = createRoot(container)
const render = () => act(async () => root.render(<MahjongGame />))
const click = (el: Element | null) =>
  act(async () => (el as HTMLElement).dispatchEvent(new w.MouseEvent("click", { bubbles: true })))
const $ = (sel: string) => container.querySelector(sel)
const $$ = (sel: string) => container.querySelectorAll(sel)

test("挂载 → 开新局 → 牌桌 / 存档 / 回到大厅", async () => {
  w.localStorage.clear()
  await render()

  // 大厅：空牌桌 + 四家座位 + 难度三档
  assert.ok($("#lobby"), "有大厅")
  assert.ok(!$("#lobby")!.classList.contains("hide"), "大厅可见")
  assert.equal($$(".seat").length, 4, "四个座位")
  assert.equal($$(".diff-btn").length, 3, "三档难度")
  assert.ok($("#btn-continue")!.classList.contains("hide"), "无存档时隐藏继续游戏")

  // 新的游戏（无存档 → 不问确认直接开局）
  await click($("#btn-new"))
  assert.ok(G.playing, "进入游玩态")
  assert.ok(w.document.body.classList.contains("playing"), "body.playing 生效")
  assert.ok($("#lobby")!.classList.contains("hide"), "大厅收起")
  assert.equal($$(".seat").length, 4, "牌桌仍是四家")

  // 手牌：自己 13~14 张、其余三家扣着（同张数）
  const mine = $$("#hb .tile")
  assert.ok(mine.length >= 13 && mine.length <= 14, `自己手牌 ${mine.length} 张`)
  assert.equal($$("#hb .tile img").length, mine.length, "自己手牌正放")
  const right = $$("#hr .tile")
  assert.ok(right.length >= 13, `右手牌 ${right.length} 张`)
  assert.equal($$("#hr .tile img").length, 0, "别家手牌扣着")
  assert.ok($$("#wd .wt").length <= 24, "牌墙最多画 24 张")
  assert.match($("#wall-count")!.textContent || "", /剩余|分章/, "牌墙计数")

  // 开局即落盘
  assert.match(w.localStorage.getItem("mahjong_save_v2") || "", /players/, "存档已写入")

  // 回到大厅：冻结牌局、保留存档
  await click($("#btn-s"))
  assert.ok(!G.playing, "回大厅")
  assert.ok(!w.document.body.classList.contains("playing"), "body.playing 撤销")
  assert.ok(!$("#lobby")!.classList.contains("hide"), "大厅重现")
  assert.ok(!$("#btn-continue")!.classList.contains("hide"), "有存档时显示继续游戏")
  assert.equal($$("#hb .tile").length, 0, "大厅不画手牌")
  assert.ok(Game.restore(), "存档可还原")
})

test("听牌待打：候选牌标亮 + 悬停弹窗 + 失焦关闭", async () => {
  // 清干净上一局（有存档/有玩家时「新的游戏」会先弹确认框）
  Game.clearSave()
  G.players = []
  await render()
  await click($("#btn-new"))
  assert.ok(G.playing, "开局")

  // 手工摆一手听牌牌型：副露 111万，手牌 456万 567条 23条 77筒 + 9筒待打
  // （引擎规则：门前清不能听牌，所以必须有副露）
  G.players[HUMAN].melds = [
    { type: "peng", ts: [T("wan", 1), T("wan", 1), T("wan", 1)], claimedId: "1wan" },
  ]
  G.players[HUMAN].hand = [
    T("wan", 4), T("wan", 5), T("wan", 6),
    T("tiao", 5), T("tiao", 6), T("tiao", 7),
    T("tiao", 2), T("tiao", 3),
    T("tong", 7), T("tong", 7),
    T("tong", 9),
  ]
  G.tingIntent = true
  G.curP = HUMAN
  G.phase = "discard"
  G.over = false
  G.lock = false
  await render()

  const targets = $$("#hb .tile.ting-target")
  assert.ok(targets.length > 0, `有听牌候选 ${targets.length} 张`)
  for (const t of targets) assert.ok(t.classList.contains("clickable"), "候选牌可点")
  assert.equal($("#ting-pop"), null, "未悬停时无弹窗")

  await act(async () => {
    targets[0].dispatchEvent(new w.MouseEvent("mouseover", { bubbles: true }))
  })
  const pop = w.document.getElementById("ting-pop")
  assert.ok(pop, "悬停后弹出听牌弹窗")
  assert.ok((pop!.querySelectorAll(".tile.mini").length ?? 0) > 0, "弹窗内有听牌张")
  assert.ok(/^\d+px$/.test(pop!.style.left), "弹窗有定位 left")

  // 点按候选牌以外区域 → 关闭
  await act(async () => {
    w.document.body.dispatchEvent(new w.Event("pointerdown", { bubbles: true }))
  })
  assert.equal(w.document.getElementById("ting-pop"), null, "失焦后关闭")

  // 点同张候选牌 → 打出并进入听牌
  G.tingIntent = true
  await render()
  const again = $$("#hb .tile.ting-target")
  await click(again[0])
  assert.ok(G.players[HUMAN].hand.length <= 13, "候选牌已打出")

  // 收尾：回大厅，作废后续 AI 定时器（否则会在测试外继续跑）
  await act(async () => Game.toLobby())
  assert.ok(!G.playing, "收尾回大厅")
})

test("横屏牌桌：点横屏进 .land（竖视口配 .rot），牌河只留最新 N 张", async () => {
  Game.clearSave()
  G.players = []
  // 触屏设备 + 竖屏手机视口
  globalThis.matchMedia = ((q: string) => ({
    matches: q.includes("coarse"),
    media: q,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof globalThis.matchMedia
  const setView = (width: number, height: number) => {
    Object.defineProperty(w, "innerWidth", { value: width, configurable: true, writable: true })
    Object.defineProperty(w, "innerHeight", { value: height, configurable: true, writable: true })
  }
  const bodyCls = w.document.body.classList
  setView(390, 844)
  // 视口尺寸是挂载时取一次 + 每次 resize 刷新（组件在第一个用例里就挂载了）
  await act(async () => w.dispatchEvent(new w.Event("resize")))

  await render()
  await click($("#btn-new"))
  assert.ok(G.playing, "开局")
  assert.ok(!bodyCls.contains("land"), "竖屏偏好不进横屏版式")
  assert.ok(bodyCls.contains("port"), "竖屏偏好 → body.port")
  assert.equal($$("#compass .on").length, 1, "风盘高亮当前出牌者")

  // 点横屏按钮 → 横屏版式；视口仍是竖的，所以加 .rot 整页旋转
  await click($("#orient-btn"))
  assert.ok(bodyCls.contains("land"), "点横屏 → body.land")
  assert.ok(bodyCls.contains("rot"), "竖视口 → body.rot")
  assert.ok(!bodyCls.contains("port"), "横屏不再叠竖屏版式")

  // 真横过来（视口变宽）= 撤旋转、留版式
  setView(844, 390)
  await act(async () => w.dispatchEvent(new w.Event("resize")))
  assert.ok(bodyCls.contains("land"), "真横屏仍是 .land")
  assert.ok(!bodyCls.contains("rot"), "真横屏不旋转")
  assert.ok(!bodyCls.contains("land-sm"), "390 高走 md 档")

  // 牌河超量只留最新 12 张（从最早的裁起，最新一张带 .latest）
  G.players[HUMAN].disc = Array.from({ length: 20 }, (_, i) => T("tiao", (i % 9) + 1))
  G.lastDB = HUMAN
  G.lastDraw = null
  await render()
  const pond = $$("#dcb .tile")
  assert.equal(pond.length, 12, "横屏牌河裁到 12 张")
  assert.ok(pond[pond.length - 1].classList.contains("latest"), "留下的最后一张是最新弃牌")

  // 更矮的画布再降一档，裁得更狠
  setView(844, 360)
  await act(async () => w.dispatchEvent(new w.Event("resize")))
  assert.ok(bodyCls.contains("land-sm"), "360 高走 sm 档")
  await render()
  assert.equal($$("#dcb .tile").length, 8, "sm 档牌河裁到 8 张")

  await act(async () => Game.toLobby())
  assert.ok(!G.playing, "收尾回大厅")
})
