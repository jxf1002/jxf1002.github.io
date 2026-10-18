"use client"

import type { ReactNode } from "react"
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react"
import * as Game from "../../lib/mahjong/game"
import { HUMAN, SN } from "../../lib/mahjong/constants"
import { label as tileLabel, tid } from "../../lib/mahjong/tile"
import type { Tile } from "../../lib/mahjong/types"
import { MeldGroup, TableTile, svgName } from "./tiles"
import {
  ConfirmModal,
  FxLayer,
  LogModal,
  ResultModal,
  RotateTip,
  RulesModal,
  SummaryModal,
  posColor,
} from "./overlays"
import type { BreakdownRow, LogEntry, ModalData, SummaryData, WinData } from "./overlays"
import { startTour } from "./tour"

const G = Game.G

// 南北互换：左=北(3)、右=南(1)，出牌下→右→上→左即逆时针
const NAMES = ["nb", "nr", "nt", "nl"]
const RESULTS = ["rb", "rr", "rt", "rl"]
const HANDS = ["hb", "hr", "ht", "hl"]
const MELDS = ["mb", "mr", "mt", "ml"]
const ACTIONS = ["ab2", "ar", "at", "al"]
const PANELS = ["pb", "pr", "pt", "pl"]
const DISCS = ["dcb", "dcr", "dct", "dcl"]
const POS = ["bottom", "right", "top", "left"]
const SEAT_NAME = ["东", "南", "西", "北"]
const ACT_CLS: Record<string, string> = { 吃: "chi", 碰: "peng", 杠: "kong", 听: "ting" }
const PACE_LABEL = ["快", "中", "慢"]
const ORIENT_KEY = "mahjong_orient"

// 引擎的 ClaimAct 形状（l 可缺省，按动作名兜底）
type Action = { a: string; l?: string; d?: any; ting?: boolean }
type ActFx = { key: number; cls: string; text: string; left: number; top: number }

function isCoarse() {
  return typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches
}

function readOrient(): "portrait" | "landscape" {
  try {
    return localStorage.getItem(ORIENT_KEY) === "landscape" ? "landscape" : "portrait"
  } catch {
    return "portrait"
  }
}

function actionLabel(a: Action): string {
  return a.a === "chi"
    ? "吃"
    : a.a === "peng"
      ? "碰"
      : a.a === "kong" || a.a === "selfKong" || a.a === "buKong"
        ? "杠"
        : a.a === "hu"
          ? "和"
          : (a.l ?? a.a)
}

function actionCls(a: Action): string {
  return a.a === "selfKong" || a.a === "buKong" ? "kong" : a.a
}

export default function MahjongGame() {
  const [, force] = useReducer((n: number) => n + 1, 0)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [modal, setModal] = useState<ModalData | null>(null)
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [fx, setFx] = useState<{ kind: string; seed: number } | null>(null)
  const [acts, setActs] = useState<ActFx[]>([])
  const [rulesOpen, setRulesOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pace, setPace] = useState(1)
  const [orient, setOrient] = useState<"portrait" | "landscape">("portrait")
  const [tingSel, setTingSel] = useState(-1)
  const [tingPreview, setTingPreview] = useState<{ idx: number; wins: Tile[] } | null>(null)
  const [tingPop, setTingPop] = useState<{ wins: Tile[]; rect: DOMRect } | null>(null)

  const winRef = useRef<WinData | null>(null)
  const modalRef = useRef<ModalData | null>(null)
  const orientRef = useRef<"portrait" | "landscape">("portrait")
  const seatRefs = useRef<Array<HTMLDivElement | null>>([])
  const popRef = useRef<HTMLDivElement | null>(null)
  const fxTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fxSeed = useRef(0)
  const actKey = useRef(0)

  useEffect(() => {
    modalRef.current = modal
  }, [modal])
  useEffect(() => {
    orientRef.current = orient
  }, [orient])

  // ===== 引擎 → React 桥：引擎只管喊事件，UI 状态在这层落地 =====
  useEffect(() => {
    Game.setUI({
      update: () => {
        // 重渲染会换掉原牌节点，先清掉过期的预览/选中态
        setTingSel(-1)
        setTingPreview(null)
        setTingPop(null)
        force()
      },
      addLog: (msg: string) => {
        setLogs((l) => [{ t: new Date().toLocaleTimeString(), m: msg }, ...l].slice(0, 50))
      },
      showWinBanner: (data: WinData) => {
        winRef.current = data || null
      },
      hideWinBanner: () => {
        winRef.current = null
      },
      showModal: (
        title: string,
        result: string,
        score: string,
        detail: string,
        btnText: string,
        cb: (() => void) | null,
        breakdown: BreakdownRow[] | null,
      ) => {
        const win = winRef.current
        winRef.current = null
        const dealer = !!(win && G.players.find((p) => p.name === win.name)?.isD)
        setModal({
          title,
          result,
          score,
          detail,
          btnText,
          cb: cb || null,
          breakdown: breakdown || null,
          win,
          dealer,
          baopi: G.baopi,
          auto: !!G.auto,
        })
      },
      showSummary: (s: SummaryData) => setSummary(s),
      effect: (type: string) => {
        setFx({ kind: type, seed: ++fxSeed.current })
        if (fxTimer.current) clearTimeout(fxTimer.current)
        fxTimer.current = setTimeout(() => setFx(null), 1500)
      },
      actFx: (pI: number, text: string) => {
        const seat = seatRefs.current[pI]
        if (!seat) return
        const key = ++actKey.current
        setActs((l) => [
          ...l,
          {
            key,
            cls: ACT_CLS[text] || "",
            text,
            left: seat.offsetLeft + seat.offsetWidth / 2,
            top: seat.offsetTop + seat.offsetHeight / 2,
          },
        ])
        setTimeout(() => setActs((l) => l.filter((x) => x.key !== key)), 1400)
      },
    })

    // 启动：有存档则大厅显示继续游戏，否则只显示新的游戏
    Game.G.playing = false
    Game.loadAILevel()
    Game.loadPace()
    setPace(Game.getPace())
    setOrient(readOrient())
    if (Game.restore()) force()
    else {
      Game.G.players = []
      force()
    }

    // 新手指引：第一次进游戏自动跑一次，之后只手动点
    try {
      if (!localStorage.getItem("mahjong_guide_seen")) {
        localStorage.setItem("mahjong_guide_seen", "1")
        void startTour(() => force())
      }
    } catch {
      /* 隐私模式下忽略 */
    }

    // dev 下把引擎挂到 window：控制台调试（README 里的手动分章测试）用；导出构建里是死代码
    if (process.env.NODE_ENV !== "production") {
      ;(window as unknown as { __mj?: typeof Game }).__mj = Game
    }

    const onResize = () => force()
    window.addEventListener("resize", onResize)
    window.addEventListener("orientationchange", onResize)
    return () => {
      window.removeEventListener("resize", onResize)
      window.removeEventListener("orientationchange", onResize)
      if (fxTimer.current) clearTimeout(fxTimer.current)
    }
  }, [])

  // 每次渲染后同步 body 态与伪横屏（等价于原 applyOrient + updateStartButton）
  useEffect(() => {
    const playing = !!G.playing
    const portraitView =
      typeof matchMedia === "function" && matchMedia("(orientation: portrait)").matches
    const on = !!(playing && isCoarse() && portraitView)
    document.body.classList.toggle("playing", playing)
    document.body.classList.toggle("land", on && orientRef.current === "landscape")
    document.body.classList.toggle("port", on && orientRef.current === "portrait")
    // 退出游玩态即解横屏锁定 + 退全屏（桌面端/不支持的浏览器无操作）
    if (!playing) {
      if (screen.orientation?.unlock) {
        try {
          screen.orientation.unlock()
        } catch {
          /* 忽略 */
        }
      }
      if (document.fullscreenElement && document.exitFullscreen) {
        try {
          document.exitFullscreen().catch(() => {})
        } catch {
          /* 忽略 */
        }
      }
    }
  })

  // 听牌弹窗位置：等节点挂载后按锚点量一次（原 showTingPop 的手工定位）
  useLayoutEffect(() => {
    const pop = popRef.current
    if (!pop || !tingPop) return
    const r = tingPop.rect
    const pw = pop.offsetWidth
    const ph = pop.offsetHeight
    pop.style.left =
      Math.min(Math.max(8, r.left + r.width / 2 - pw / 2), Math.max(8, window.innerWidth - pw - 8)) +
      "px"
    let top = r.top - ph - 8
    if (top < 0) top = r.bottom + 8
    pop.style.top = top + "px"
  }, [tingPop])

  // 失焦兜底：下一次点按即关掉悬停弹窗
  useEffect(() => {
    if (!tingPop) return
    const hide = () => setTingPop(null)
    document.addEventListener("pointerdown", hide, true)
    return () => document.removeEventListener("pointerdown", hide, true)
  }, [tingPop])

  // 点按候选牌以外区域取消预览
  useEffect(() => {
    if (tingSel < 0) return
    const away = (e: PointerEvent) => {
      const el = e.target as HTMLElement | null
      if (el && el.closest && el.closest(".tile, .ting-preview")) return
      setTingSel(-1)
      setTingPreview(null)
    }
    document.addEventListener("pointerdown", away, true)
    return () => document.removeEventListener("pointerdown", away, true)
  }, [tingSel])

  // 移动端横屏偏好：尝试锁定方向（不请求全屏）；不支持的浏览器静默失败，靠 CSS 伪横屏旋转
  const tryLandscape = useCallback(() => {
    try {
      if (orientRef.current !== "landscape") return
      if (!isCoarse()) return
      if (screen.orientation?.lock) screen.orientation.lock("landscape").catch(() => {})
    } catch {
      /* 忽略 */
    }
  }, [])

  const startNewGame = useCallback(() => {
    tryLandscape()
    Game.init()
  }, [tryLandscape])

  const onNewClick = () => {
    if (Game.hasSave() || G.players.length) setConfirmOpen(true)
    else startNewGame()
  }

  const onCycleOrient = () => {
    const next = readOrient() === "landscape" ? "portrait" : "landscape"
    try {
      localStorage.setItem(ORIENT_KEY, next)
    } catch {
      /* 忽略 */
    }
    if (next === "portrait" && screen.orientation?.unlock) {
      try {
        screen.orientation.unlock()
      } catch {
        /* 忽略 */
      }
    }
    setOrient(next)
  }

  const closeModal = useCallback(() => {
    const cb = modalRef.current?.cb
    winRef.current = null
    setModal(null)
    if (cb) cb()
  }, [])

  const onModalHome = useCallback(() => {
    winRef.current = null
    setModal(null)
    Game.toLobby()
  }, [])

  const openTour = useCallback(() => {
    void startTour(() => force())
  }, [])

  // ===== 渲染 =====
  const playing = !!G.playing
  const human = G.players[HUMAN]
  const canDiscard =
    !G.over && playing && !G.lock && !G.auto && G.curP === HUMAN && G.phase === "discard"
  const tingActive = !!(human && (G.tingIntent || G.forceTing))
  const tingSet = tingActive ? new Set(Game.tingDiscards(HUMAN).map((t) => tid(t))) : null
  const tingPlanMap: Record<string, Tile[]> = {}
  if (tingActive) Game.tingPlans(HUMAN).forEach((pl) => (tingPlanMap[tid(pl.discard)] = pl.wins))

  let newIdx = -1
  if (human && G.lastDraw && (G.lastFrom === "wall" || G.lastFrom === "fen") && G.curP === HUMAN) {
    for (let k = human.hand.length - 1; k >= 0; k--) {
      if (tid(human.hand[k]) === tid(G.lastDraw)) {
        newIdx = k
        break
      }
    }
  }

  const fenPhase = playing && !G.over && G.phase === "fen"
  const wallText = fenPhase
    ? `分章 ${Math.min(G.fenN, Game.FEN_TILES)}/${Game.FEN_TILES}`
    : `剩余 ${G.wall}`
  const showDora = !!playing && !!(G.bpR && G.baopi && (G.ting.has(HUMAN) || G.over))

  // 中央大牌：可吃碰杠和时显示放炮张；自摸可和时显示刚摸到的和牌张
  let reminder: Tile | null = null
  if (playing && !G.over) {
    if (G.phase === "claim" && G.pending.includes(HUMAN) && G.lastD) reminder = G.lastD
    else if (G.selfHu && G.lastDraw) reminder = G.lastDraw
  }

  // 已听 / 听牌待选时不显示提示，避免单吊红中等已听牌型误导
  let hintTags: string[] | null = null
  if (
    !(
      G.over ||
      !playing ||
      !G.players.length ||
      G.ting.has(HUMAN) ||
      G.tingIntent ||
      G.forceTing ||
      Game.canStartTing(HUMAN) ||
      Game.canDeclareNow(HUMAN)
    )
  ) {
    const h = Game.handHints(HUMAN)
    hintTags = [
      !h.yao && "断幺九",
      !h.tri && "无碰牌",
      !h.seq && "无顺子",
      !h.pair && "缺对子",
      !h.color && "缺花色",
      h.closed && "门前清",
    ].filter((x): x is string => !!x)
  }

  let actions: Action[] = []
  if (playing && !G.over && !G.auto) {
    if (G.selfHu) {
      actions = [{ a: "hu", l: "和" }]
    } else if (G.phase === "claim" && G.pending.includes(HUMAN)) {
      actions = Game.claimActions(HUMAN)
      // 有和无过：能和时不给过
      if (!actions.some((x) => x.a === "hu")) actions.push({ a: "pass", l: "过" })
    } else if (G.phase === "discard" && G.curP === HUMAN) {
      actions = Game.selfActions(HUMAN)
    }
    if (!G.selfHu && G.players.length && (Game.canStartTing(HUMAN) || Game.canDeclareNow(HUMAN)))
      actions.push({ a: "ting", l: "听牌" })
  }

  function findFourKind(): Tile | null {
    const hand = G.players[HUMAN]?.hand
    if (!hand) return null
    const c: Record<string, number> = {}
    hand.forEach((t) => (c[tid(t)] = (c[tid(t)] || 0) + 1))
    const id = Object.keys(c).find((k) => c[k] >= 4)
    return id ? hand.find((t) => tid(t) === id) || null : null
  }

  // 按钮下方的小预览：吃到后副露的样子（被吃碰的居中染黄）
  function meldPreview(act: Action): Array<{ t: Tile; claimed: boolean }> | null {
    const t = G.lastD
    if ((act.a === "chi" || act.a === "peng" || act.a === "kong") && t) {
      if (act.a === "chi" && Array.isArray(act.d)) {
        return (act.d as number[]).map((n) => {
          const x = n === t.num ? t : { type: t.type, num: n, suit: SN[t.type], id: n + t.type }
          return { t: x, claimed: x === t }
        })
      }
      if (act.a === "peng") {
        const pair = G.players[HUMAN].hand.filter((x) => tid(x) === tid(t)).slice(0, 2)
        return [
          { t: pair[0] || t, claimed: false },
          { t, claimed: true },
          { t: pair[1] || t, claimed: false },
        ]
      }
      if (act.a === "kong") {
        const three = G.players[HUMAN].hand.filter((x) => tid(x) === tid(t)).slice(0, 3)
        while (three.length < 3) three.push(t)
        return [...three.map((x) => ({ t: x, claimed: false })), { t, claimed: true }]
      }
    }
    if (act.a === "buKong" && act.d)
      return [0, 1, 2, 3].map(() => ({ t: act.d as Tile, claimed: false }))
    if (act.a === "selfKong") {
      const tile = findFourKind()
      if (tile) return [0, 1, 2, 3].map(() => ({ t: tile, claimed: false }))
    }
    return null
  }

  function onTingTile(idx: number, wins: Tile[]) {
    if (!isCoarse()) {
      Game.handleDiscard(idx)
      return
    }
    if (tingSel === idx) {
      setTingSel(-1)
      setTingPreview(null)
      Game.handleDiscard(idx)
      return
    }
    setTingSel(idx)
    setTingPop(null)
    setTingPreview({ idx, wins })
  }

  // 手牌：自己（或结算亮牌）正放并标出刚摸的那张，其余人扣着
  function handNodes(p: (typeof G.players)[number], i: number): ReactNode {
    if (!playing) return null
    if (i !== HUMAN && !G.over)
      return p.hand.map((t, k) => <TableTile key={k} tile={t} folded />)

    const isHuman = i === HUMAN
    const out: ReactNode[] = []
    let suit: ReactNode[] = []
    let suitType: string | null = null
    const flush = () => {
      if (!suit.length) return
      out.push(
        <div className="hand-suit" key={"s" + out.length}>
          {suit}
        </div>,
      )
      suit = []
    }

    p.hand.forEach((t, idx) => {
      const isTingTile = !!tingSet && tingSet.has(tid(t))
      const clickable = isHuman && canDiscard && (!tingSet || isTingTile)
      const wins = isTingTile && tingActive ? tingPlanMap[tid(t)] || [] : []
      const node = (
        <TableTile
          key={idx}
          tile={t}
          clickable={clickable}
          tingTarget={isTingTile}
          isNew={isHuman && idx === newIdx}
          armed={isHuman && tingSel === idx}
          onClick={
            clickable
              ? () => (wins.length ? onTingTile(idx, wins) : Game.handleDiscard(idx))
              : undefined
          }
          onMouseEnter={
            isTingTile && tingActive && !isCoarse()
              ? (e) => {
                  if (document.body.classList.contains("land")) return
                  setTingPop({ wins, rect: e.currentTarget.getBoundingClientRect() })
                }
              : undefined
          }
          onMouseLeave={isTingTile && tingActive && !isCoarse() ? () => setTingPop(null) : undefined}
        />
      )
      if (isHuman) {
        if (!suitType || suitType !== t.type) {
          flush()
          suitType = t.type
        }
        suit.push(node)
      } else {
        out.push(node)
      }
    })
    flush()
    if (isHuman && !G.over && p.hand.length % 3 === 1)
      out.push(<div className="tile hand-spacer" key="spacer" aria-hidden="true" />)
    return out
  }

  function seat(i: number) {
    const p = G.players[i]
    const isHuman = i === HUMAN
    const active = !G.over && playing && i === G.curP
    const ting = playing && !G.over && G.ting.has(i)
    const cls = ["seat", "seat-" + POS[i], active ? "active" : "", ting ? "ting" : ""]
      .filter(Boolean)
      .join(" ")
    return (
      <div
        className={cls}
        id={PANELS[i]}
        key={i}
        ref={(el) => {
          seatRefs.current[i] = el
        }}
      >
        {isHuman ? (
          <div className="ext" id="ext">
            <div className={"pa" + (actions.length ? "" : " hide")} id={ACTIONS[0]}>
              {actions.map((a, k) => {
                const prev = meldPreview(a)
                return (
                  <button
                    type="button"
                    className={"ab " + actionCls(a)}
                    key={k}
                    onClick={() => Game.handleAB(HUMAN, a.a, a.d)}
                  >
                    <span className="ab-main">{actionLabel(a)}</span>
                    {prev ? (
                      <span className="ab-sub">
                        {prev.map((q, qi) => (
                          <TableTile key={qi} tile={q.t} claimed={q.claimed} />
                        ))}
                      </span>
                    ) : null}
                    {a.ting && a.a !== "hu" ? <span className="ab-ting">听</span> : null}
                  </button>
                )
              })}
            </div>
            <div className={"ting-preview" + (tingPreview ? "" : " hide")} id="ting-preview">
              {tingPreview ? (
                <>
                  <span className="tp-label">打出后听</span>
                  {tingPreview.wins.map((t, k) => (
                    <TableTile key={k} tile={t} mini />
                  ))}
                  <button
                    type="button"
                    className="tp-btn"
                    onClick={() => {
                      const idx = tingPreview.idx
                      setTingSel(-1)
                      setTingPreview(null)
                      Game.handleDiscard(idx)
                    }}
                  >
                    打出
                  </button>
                </>
              ) : null}
            </div>
            <div className="hints" id="hints">
              {hintTags ? (
                <div className="hint-line">
                  {hintTags.map((l, k) => (
                    <span className="hint no" key={k}>
                      {l}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className="seat-head">
          {p && playing && !G.over && p.isD ? (
            <span className="dealer-die" title="庄家">
              🎲
            </span>
          ) : null}
          <span className="pn" id={NAMES[i]}>
            {p ? p.name + (isHuman ? "(我)" : "") : SEAT_NAME[i]}
          </span>
          {p ? (
            <span className="head-score" style={playing ? { color: posColor(p.score) } : undefined}>
              {p.score}
            </span>
          ) : null}
          <span className="pr" id={RESULTS[i]}>
            {ting ? <span className="ti">听牌</span> : null}
          </span>
        </div>
        <div className="seat-body">
          <div className="pm" id={MELDS[i]}>
            {playing && p ? p.melds.map((m, k) => <MeldGroup key={k} meld={m} />) : null}
          </div>
          <div className="ph" id={HANDS[i]}>
            {p ? handNodes(p, i) : null}
          </div>
        </div>
        {isHuman ? null : <div className="pa hide" id={ACTIONS[i]} />}
      </div>
    )
  }

  function discRow(i: number) {
    const disc = playing && G.players.length ? G.players[i].disc : []
    const lastIdx = disc.length && i === G.lastDB && !G.lastDraw ? disc.length - 1 : -1
    return disc.map((t, idx) => (
      <TableTile
        key={idx}
        tile={t}
        className={[
          idx === lastIdx && !t.claimed ? "latest" : "",
          t.claimed ? "claimed" : "",
          t.tingDiscard ? "ting-discard" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      />
    ))
  }

  const lobbyHas = G.players.length > 0 || Game.hasSave()

  return (
    <>
      <div className="gc">
        <div className="topbar">
          <div className="topbar-left">
            <h1>麻将</h1>
            <button
              type="button"
              className={"log-btn" + (playing ? "" : " hide") + (G.auto ? " active" : "")}
              id="auto-btn"
              onClick={() => Game.setAuto(!Game.getAuto())}
            >
              {G.auto ? "托管中" : "托管"}
            </button>
          </div>
          <div className="gi">
            <span className="wall-top" id="wall-count-top">
              {playing ? wallText : "剩余 0"}
            </span>
            <button type="button" className="log-btn" id="rules-btn" onClick={() => setRulesOpen(true)}>
              📖 规则
            </button>
            <button type="button" className="log-btn" id="log-btn" onClick={() => setLogOpen(true)}>
              📜 日志
            </button>
            <button
              type="button"
              className="log-btn orient-btn"
              id="orient-btn"
              onClick={onCycleOrient}
            >
              {orient === "landscape" ? "切换竖屏" : "切换横屏"}
            </button>
            <button
              type="button"
              className={"log-btn" + (playing ? "" : " hide")}
              id="btn-s"
              onClick={() => Game.toLobby()}
            >
              回主页面
            </button>
          </div>
        </div>

        <div className="table">
          {seat(2)}

          {seat(3)}

          <div className="center">
            <div className={"dora-banner" + (showDora ? " show" : "")} id="dora-banner">
              {showDora && G.baopi ? (
                <>
                  <span className="dora-label">宝牌</span>
                  <span className="dora-tile">
                    <img
                      className="face-img"
                      src={"/mahjong/svg/" + svgName(G.baopi) + ".svg"}
                      alt={tileLabel(G.baopi)}
                      draggable={false}
                    />
                  </span>
                </>
              ) : null}
            </div>
            <div className="disc-row">
              <div className="disc" id="dct">
                {discRow(2)}
              </div>
            </div>
            <div className="center-mid">
              <div className="disc disc-col" id="dcl">
                {discRow(3)}
              </div>
              <div className="wall-wrap">
                <div className="wall-count" id="wall-count">
                  {playing ? wallText : ""}
                </div>
                <div className="wall" id="wd">
                  {Array.from({ length: playing ? Math.min(G.wall, 24) : 0 }, (_, i) => (
                    <div className="wt" key={i} />
                  ))}
                </div>
              </div>
              <div className="disc disc-col" id="dcr">
                {discRow(1)}
              </div>
            </div>
            <div className="disc-row">
              <div className="disc" id="dcb">
                {discRow(0)}
              </div>
            </div>
            <div className={"fen-label" + (fenPhase ? " show" : "")} id="fen-label">
              分章中
            </div>
            <div className={"claim-reminder" + (reminder ? " show" : "")} id="reminder">
              {reminder ? (
                <div className="tile big">
                  <img
                    className="face-img"
                    src={"/mahjong/svg/" + svgName(reminder) + ".svg"}
                    alt={tileLabel(reminder)}
                    draggable={false}
                  />
                </div>
              ) : null}
            </div>
          </div>

          {seat(1)}

          {seat(0)}

          <div className={"lobby" + (playing ? " hide" : "")} id="lobby">
            <div className="lobby-card">
              <h2>麻将</h2>
              <p id="lobby-sub">
                {G.players.length
                  ? G.players.map((p) => `${p.name}${p.isD ? "(庄)" : ""} ${p.score}分`).join("　")
                  : "空牌桌，来开一局吧"}
              </p>
              <div className="diff-picker">
                <span className="diff-label">AI 难度</span>
                <div className="diff-btns" id="diff-btns">
                  {(["easy", "normal", "hard"] as const).map((lv, i) => (
                    <button
                      type="button"
                      className={
                        "diff-btn" + (Game.getAILevel() === lv ? " active" : "")
                      }
                      data-level={lv}
                      key={lv}
                      onClick={() => {
                        Game.setAILevel(lv)
                        force()
                      }}
                    >
                      {["简单", "中等", "困难"][i]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="diff-picker">
                <span className="diff-label">
                  游戏节奏 <b id="pace-val">{PACE_LABEL[pace]}</b>
                </span>
                <input
                  type="range"
                  className="pace-range"
                  id="pace-range"
                  min={0}
                  max={2}
                  step={1}
                  value={pace}
                  aria-label="游戏节奏"
                  onChange={(e) => {
                    Game.setPace(Number(e.target.value))
                    setPace(Game.getPace())
                  }}
                />
                <div className="pace-ticks">
                  <span>快</span>
                  <span>中</span>
                  <span>慢</span>
                </div>
              </div>
              <div className="lobby-btns">
                <button
                  type="button"
                  className={"sb2b sb2b-continue" + (lobbyHas ? "" : " hide")}
                  id="btn-continue"
                  onClick={() => {
                    tryLandscape()
                    Game.resumeGame()
                  }}
                >
                  继续游戏
                </button>
                <button type="button" className="sb2b sb2b-new" id="btn-new" onClick={onNewClick}>
                  新的游戏
                </button>
              </div>
              <button type="button" className="lobby-stats" id="btn-guide" onClick={openTour}>
                📖 新手指引
              </button>
              <button
                type="button"
                className={"lobby-stats" + (G.players.length ? "" : " hide")}
                id="btn-stats"
                onClick={() => Game.showStats()}
              >
                查看战绩
              </button>
            </div>
          </div>
          <RotateTip />
          {acts.map((a) => (
            <div
              className={"act-fx " + a.cls}
              key={a.key}
              style={{ left: a.left + "px", top: a.top + "px" }}
            >
              <span>{a.text}</span>
            </div>
          ))}
        </div>
      </div>

      {fx ? <FxLayer type={fx.kind} seed={fx.seed} /> : null}

      {modal ? (
        <ResultModal
          data={modal}
          onStats={() => Game.showStats()}
          onHome={onModalHome}
          onClose={closeModal}
        />
      ) : null}

      {summary ? <SummaryModal summary={summary} onClose={() => setSummary(null)} /> : null}

      {rulesOpen ? <RulesModal onClose={() => setRulesOpen(false)} /> : null}
      {logOpen ? <LogModal logs={logs} onClose={() => setLogOpen(false)} /> : null}
      {confirmOpen ? (
        <ConfirmModal
          onCancel={() => setConfirmOpen(false)}
          onOk={() => {
            setConfirmOpen(false)
            startNewGame()
          }}
        />
      ) : null}

      {tingPop ? (
        <div id="ting-pop" ref={popRef}>
          {tingPop.wins.map((t, k) => (
            <TableTile key={k} tile={t} mini />
          ))}
        </div>
      ) : null}
    </>
  )
}
