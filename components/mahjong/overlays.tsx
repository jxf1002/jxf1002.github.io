"use client"

import type { CSSProperties } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import type { Meld, Tile } from "../../lib/mahjong/types"
import { statOf } from "../../lib/mahjong/stats"
import * as Game from "../../lib/mahjong/game"
import { MeldGroup, TableTile } from "./tiles"

export type BreakdownRow = {
  name: string
  me: boolean
  isD: boolean
  delta: number
  total: number
  fan: number | string
}

export type WinData = {
  name: string
  title: string
  isZimo: boolean
  isBaopi: boolean
  hand: Tile[]
  melds: Meld[]
  winTile: Tile | null
}

export type ModalData = {
  title: string
  result: string
  score: string
  detail: string
  btnText: string
  cb: (() => void) | null
  breakdown: BreakdownRow[] | null
  win: WinData | null
  dealer: boolean
  baopi: Tile | null
  auto: boolean
}

export type SummaryStat = {
  zimo?: number
  ron?: number
  heipao?: number
  baopi?: number
  dianpao?: number
  dianhei?: number
}

export type SummaryData = {
  hands: number
  rotations: number
  draw: number
  hu: number
  scores: Array<{
    name: string
    me: boolean
    isD: boolean
    score: number
    stat: SummaryStat
  }>
}

export type LogEntry = { t: string; m: string }

export function posColor(v: number): string {
  return v > 0 ? "#5fd39a" : v < 0 ? "#ff7b6b" : "#fff"
}

// 手牌按连续花色分组，折行时整组一起折（与牌桌手牌一致）
function groupBySuit(tiles: Tile[]): Tile[][] {
  const groups: Tile[][] = []
  let current: Tile[] = []
  let type: string | null = null
  tiles.forEach((t) => {
    if (!type || type !== t.type) {
      current = []
      groups.push(current)
      type = t.type
    }
    current.push(t)
  })
  return groups
}

// ===== 结算卡：和牌手牌 + 每人计番 + 继续倒计时 =====
export function ResultModal({
  data,
  onStats,
  onHome,
  onClose,
}: {
  data: ModalData
  onStats: () => void
  onHome: () => void
  onClose: () => void
}) {
  const label = data.btnText || "继续"
  const autoLabel = data.auto ? "自动继续" : label
  const leftRef = useRef(data.cb ? (data.auto ? 3 : 15) : 0)
  const [left, setLeft] = useState(leftRef.current)
  const [counting, setCounting] = useState(!!data.cb)
  const close = useRef(onClose)
  close.current = onClose

  // 托管 3 秒、普通 15 秒；点页面任意处即中止（点击按钮的 pointerdown 也会先中止）
  useEffect(() => {
    if (!data.cb) return
    const autoMode = data.auto
    const timer = setInterval(() => {
      if (autoMode && !Game.getAuto()) {
        clearInterval(timer)
        setCounting(false)
        return
      }
      leftRef.current -= 1
      if (leftRef.current <= 0) {
        clearInterval(timer)
        close.current()
        return
      }
      setLeft(leftRef.current)
    }, 1000)
    const abort = () => {
      clearInterval(timer)
      setCounting(false)
    }
    document.addEventListener("pointerdown", abort, true)
    return () => {
      clearInterval(timer)
      document.removeEventListener("pointerdown", abort, true)
    }
  }, [data])

  const win = data.win
  const tiles = win ? [...win.hand] : []
  if (win && !win.isZimo && win.winTile) tiles.push(win.winTile)

  return (
    <div className="mo show" id="mo">
      <div className="mdl">
        <h2 id="m-title">
          {win ? (
            <>
              <span>
                {(data.dealer ? "🎲 " : "") + win.name + " " + data.title.replace(/^庄家/, "")}
              </span>
              {data.baopi ? (
                <>
                  <span className="m-title-sep" />
                  <span className="m-dora-label">宝牌</span>
                  <TableTile tile={data.baopi} />
                </>
              ) : null}
            </>
          ) : (
            <span>{data.title}</span>
          )}
        </h2>
        <div className={"m-hand" + (win ? "" : " hide")} id="m-hand">
          {win ? (
            <div className="m-tiles">
              {win.melds.map((m, i) => (
                <MeldGroup key={i} meld={m} />
              ))}
              {win.melds.length ? <div className="m-sep" /> : null}
              {groupBySuit(tiles).map((group, gi) => (
                <div className="hand-suit" key={gi}>
                  {group.map((t, i) => (
                    <TableTile
                      key={i}
                      tile={t}
                      className={t === win.winTile ? "wb-win" : ""}
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="rt" id="m-result" />
        <div className={"st" + (win ? " hide" : "")} id="m-score">
          {win ? "" : data.result + (data.score ? "，" + data.score : "")}
        </div>
        <div className="dt" id="m-detail">
          {win ? "" : data.detail}
        </div>
        {data.breakdown && data.breakdown.length ? (
          <div className="m-breakdown show" id="m-breakdown">
            <div className="bd-head">
              <span>玩家</span>
              <span>计番</span>
              <span>本局</span>
              <span>总分</span>
            </div>
            {data.breakdown.map((b, i) => (
              <div className={"bd-row" + (b.me ? " me" : "")} key={i}>
                <span className="bd-name">
                  {b.name}
                  {b.isD ? " 🎲" : ""}
                  {b.me ? "(我)" : ""}
                </span>
                <span className="bd-fan">{b.fan || "—"}</span>
                <span
                  className="bd-delta"
                  style={{ color: b.delta > 0 ? "#5fd39a" : b.delta < 0 ? "#ff7b6b" : "#c9d3cd" }}
                >
                  {b.delta > 0 ? "+" + b.delta : b.delta}
                </span>
                <span className="bd-total">{b.total}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="m-breakdown" id="m-breakdown" />
        )}
        <button type="button" id="m-btn" onClick={onClose}>
          {counting ? `${autoLabel} (${left})` : label}
        </button>
        <div className="m-links">
          <button type="button" className="m-link" id="m-stats" onClick={onStats}>
            查看战绩
          </button>
          <button type="button" className="m-link" id="m-home" onClick={onHome}>
            回到主页
          </button>
        </div>
      </div>
    </div>
  )
}

// ===== 整局战绩 =====
export function SummaryModal({
  summary,
  onClose,
}: {
  summary: SummaryData
  onClose: () => void
}) {
  return (
    <div className="summary show" id="summary">
      <div className="sum-card">
        <h2>麻将战绩</h2>
        <div className="sum-meta">
          <div>
            <b>{summary.rotations}</b>
            <span>圈数</span>
          </div>
          <div>
            <b>{summary.hands}</b>
            <span>把数</span>
          </div>
          <div>
            <b>{summary.hu}</b>
            <span>和牌</span>
          </div>
          <div>
            <b>{summary.draw}</b>
            <span>流局</span>
          </div>
        </div>
        <div className="sum-scores">
          <div className="sum-head">
            <span>玩家</span>
            <span>点黑炮</span>
            <span>点炮和</span>
            <span>黑炮和</span>
            <span>自摸和</span>
            <span>宝牌和</span>
            <span>总和牌</span>
            <span>积分</span>
          </div>
          {summary.scores.map((s, i) => {
            const st = statOf(s)
            return (
              <div className={"sum-row" + (s.me ? " me" : "")} key={i}>
                <span className="sum-name">
                  {s.name}
                  {s.isD ? " 🎲" : ""}
                  {s.me ? "(我)" : ""}
                </span>
                <span>{st.dianhei}</span>
                <span>{st.dianpao}</span>
                <span>{st.heipaoHu}</span>
                <span>{st.zimo}</span>
                <span>{st.baopi}</span>
                <span>{st.zong}</span>
                <span className="sum-score" style={{ color: posColor(s.score) }}>
                  {s.score}
                </span>
              </div>
            )
          })}
        </div>
        <div className="sum-actions">
          <button type="button" id="sum-download" onClick={() => downloadSummary(summary)}>
            下载图片
          </button>
          <button type="button" id="sum-close" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

function downloadSummary(summary: SummaryData): void {
  const W = 720
  const H = 760
  const cv = document.createElement("canvas")
  cv.width = W
  cv.height = H
  const ctx = cv.getContext("2d")
  if (!ctx) return
  ctx.fillStyle = "#101a15"
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = "#e8c15a"
  ctx.lineWidth = 4
  ctx.strokeRect(16, 16, W - 32, H - 32)

  ctx.textAlign = "center"
  ctx.fillStyle = "#e8c15a"
  ctx.font = 'bold 42px "PingFang SC","Microsoft YaHei",sans-serif'
  ctx.fillText("麻将战绩", W / 2, 96)

  const meta: Array<[number, string]> = [
    [summary.rotations, "圈数"],
    [summary.hands, "把数"],
    [summary.hu, "和牌"],
    [summary.draw, "流局"],
  ]
  const bw = 120
  const gap = 16
  const startX = (W - (bw * 4 + gap * 3)) / 2
  meta.forEach((m, i) => {
    const x = startX + i * (bw + gap)
    const y = 140
    ctx.fillStyle = "rgba(255,255,255,.06)"
    ctx.fillRect(x, y, bw, 84)
    ctx.fillStyle = "#fff"
    ctx.font = 'bold 32px "PingFang SC",sans-serif'
    ctx.fillText(String(m[0]), x + bw / 2, y + 44)
    ctx.fillStyle = "#9db3a8"
    ctx.font = '15px "PingFang SC",sans-serif'
    ctx.fillText(m[1], x + bw / 2, y + 70)
  })

  const tableX = 30
  const tableW = W - 60
  const colW = [0.22, 0.11, 0.11, 0.11, 0.11, 0.11, 0.11, 0.12].map((r) => r * tableW)
  const colX: number[] = []
  colX[0] = tableX
  for (let i = 1; i < colW.length; i++) colX[i] = colX[i - 1] + colW[i - 1]
  const center = (i: number) => colX[i] + colW[i] / 2

  ctx.textAlign = "left"
  ctx.fillStyle = "#e8c15a"
  ctx.font = 'bold 22px "PingFang SC",sans-serif'
  ctx.fillText("每人战绩", tableX, 280)

  let y = 296
  ctx.fillStyle = "rgba(255,255,255,.06)"
  ctx.fillRect(tableX, y, tableW, 38)
  ctx.fillStyle = "#9db3a8"
  ctx.font = 'bold 14px "PingFang SC",sans-serif'
  ctx.textAlign = "left"
  ctx.fillText("玩家", colX[0] + 8, y + 25)
  ctx.textAlign = "center"
  ;["点黑炮", "点炮和", "黑炮和", "自摸", "宝牌", "总和牌"].forEach((h, i) =>
    ctx.fillText(h, center(i + 1), y + 25),
  )
  ctx.fillText("积分", center(7), y + 25)
  y += 42

  summary.scores.forEach((s) => {
    const st = statOf(s)
    ctx.fillStyle = s.me ? "rgba(232,193,90,.15)" : "rgba(255,255,255,.05)"
    ctx.fillRect(tableX, y, tableW, 52)
    ctx.textAlign = "left"
    ctx.fillStyle = s.me ? "#e8c15a" : "#eef2ef"
    ctx.font = 'bold 18px "PingFang SC",sans-serif'
    ctx.fillText(s.name + (s.isD ? " 🎲" : "") + (s.me ? " (我)" : ""), colX[0] + 8, y + 34)
    ctx.textAlign = "center"
    ctx.fillStyle = "#eef2ef"
    ctx.font = 'bold 18px "PingFang SC",sans-serif'
    ;[st.dianhei, st.dianpao, st.heipaoHu, st.zimo, st.baopi, st.zong].forEach((v, i) =>
      ctx.fillText(String(v), center(i + 1), y + 34),
    )
    ctx.fillStyle = posColor(s.score)
    ctx.fillText((s.score > 0 ? "+" : "") + s.score, center(7), y + 34)
    y += 62
  })

  ctx.textAlign = "center"
  ctx.fillStyle = "#6b7d74"
  ctx.font = '14px "PingFang SC",sans-serif'
  ctx.fillText("麻将小游戏", W / 2, H - 34)

  const a = document.createElement("a")
  a.download = "麻将战绩.png"
  a.href = cv.toDataURL("image/png")
  a.click()
}

export function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="mo show" id="rules-modal">
      <div className="mdl rules-mdl">
        <h2>📖 游戏规则</h2>
        <div className="rules-content">
          <h3>基本规则</h3>
          <p>
            四人麻将，你为<b>东</b>家（下方），其余三家为 AI 对手。共 <b>112 张</b>，每人起手 13 张、庄家 14 张，发牌后牌墙剩 <b>59 张</b>。其中牌尾 <b>8 张</b>为<b>死墙</b>，不参与正常摸牌，专供杠补牌和宝牌使用；死墙之前的 <b>4 张</b>为<b>分章</b>。
          </p>
          <p>
            牌型必须同时包含<b>顺子</b>（三张连续同花色）和<b>刻子</b>（三张相同），或红中做将时可纯顺子。<b>禁止清一色</b>，手牌至少需要两种花色（红中不算花色）。
          </p>

          <h3>摸牌与出牌</h3>
          <p>
            每回合从<b>活牌墙</b>摸一张牌，然后选择一张打出。点击手牌中要打出的牌即可。
          </p>

          <h3>死墙与分章</h3>
          <p>
            活牌墙摸完后进入<b>分章</b>：屏幕中间显示“分章中”，从当前轮到的一家起，四家依次各摸一张牌、<b>不打出</b>；摸到的牌若能自摸和牌（须已听牌）就和，否则轮到下一家。四家各摸完仍无人和牌即流局。
          </p>

          <h3>碰、杠</h3>
          <ul>
            <li>
              <b>碰</b>：别人打出的牌与手中两张相同时，系统会提示"碰"。碰后需打出一张牌。
            </li>
            <li>
              <b>杠</b>：手中有三张相同牌时可杠，从<b>死墙</b>补一张牌（死墙取完则从活牌墙补）。
            </li>
            <li>
              <b>吃</b>：本游戏<b>不支持吃牌</b>。
            </li>
          </ul>

          <h3>听牌与和牌</h3>
          <p>当只差一张牌就能和牌时，系统会提示"听"。点击"和"按钮即可和牌。</p>
          <div className="rules-hint">💡 听牌条件：手牌（含副露）中必须已有幺九牌（1/9/字牌），否则无法听牌。</div>

          <h3>计分规则</h3>
          <p>
            和牌后根据<b>番数</b>计算得分，每份分数 = 2<sup>番数</sup>。番数由以下条件累加：
          </p>
          <table className="rules-table">
            <tbody>
              <tr>
                <th>条件</th>
                <th>番数</th>
                <th>说明</th>
              </tr>
              <tr>
                <td>庄家</td>
                <td>+1</td>
                <td>和牌者是庄家</td>
              </tr>
              <tr>
                <td>自摸</td>
                <td>+1</td>
                <td>自己摸到和牌，三家各付一份</td>
              </tr>
              <tr>
                <td>宝牌</td>
                <td>+1</td>
                <td>自摸和的牌恰好是宝牌</td>
              </tr>
              <tr>
                <td>黑炮</td>
                <td>+2</td>
                <td>放炮者未听牌，由放炮者独付（不分三家）</td>
              </tr>
            </tbody>
          </table>

          <h3>付款方式</h3>
          <ul>
            <li>
              <b>自摸</b>：其余三家各付一份，庄家（非赢家时）付双份
            </li>
            <li>
              <b>听牌点炮</b>：放炮者已听牌，其余三家各付一份，庄家付双份
            </li>
            <li>
              <b>黑炮</b>：放炮者未听牌，由放炮者独付一份（庄家放炮则付双份）
            </li>
          </ul>

          <h3>宝牌（宝）</h3>
          <p>
            有任意一家听牌后，从<b>死墙牌尾取走一张</b>翻开作为宝牌（该张不再能被摸到或杠走）。若宝牌在牌池与已营业副露中已见三张，则再从牌尾取一张换宝。宝牌按<b>牌张种类</b>计：自摸到与宝牌同种的牌（须已听牌）即视为自摸和，并额外 +1 番。听牌后宝牌信息会显示。
          </p>

          <h3>流局</h3>
          <p>活牌墙摸完并进入分章、四家各摸一张后仍无人和牌，则本局流局，庄家继续坐庄。</p>

          <h3>操作说明</h3>
          <ul>
            <li>点击手牌中的牌打出</li>
            <li>出现"碰""杠""和"按钮时，点击执行操作</li>
            <li>点击"过"跳过本次机会</li>
            <li>左上角显示剩余牌数（分章时显示分章进度）和宝牌信息</li>
          </ul>
        </div>
        <button type="button" id="rules-close" onClick={onClose}>
          关闭
        </button>
      </div>
    </div>
  )
}

export function LogModal({ logs, onClose }: { logs: LogEntry[]; onClose: () => void }) {
  return (
    <div className="mo show" id="log-modal">
      <div className="mdl log-mdl">
        <h2>📜 出牌日志</h2>
        <div className="lp" id="lp">
          {logs.map((e, i) => (
            <div className="le" key={i}>
              <span className="hl">[{e.t}]</span> {e.m}
            </div>
          ))}
        </div>
        <button type="button" id="log-close" onClick={onClose}>
          关闭
        </button>
      </div>
    </div>
  )
}

export function ConfirmModal({
  onCancel,
  onOk,
}: {
  onCancel: () => void
  onOk: () => void
}) {
  return (
    <div className="mo show" id="confirm-modal">
      <div className="mdl">
        <h2>开始新的游戏？</h2>
        <p className="confirm-tip">已有游戏存档，开始新游戏将覆盖当前进度。</p>
        <div className="confirm-actions">
          <button type="button" id="confirm-cancel" onClick={onCancel}>
            取消
          </button>
          <button type="button" id="confirm-ok" onClick={onOk}>
            确认开始
          </button>
        </div>
      </div>
    </div>
  )
}

// ===== 和牌特效：粒子 / 宝牌金色圆环 =====
export function FxLayer({ type, seed }: { type: string; seed: number }) {
  const particles = useMemo(() => {
    const baopi = type === "baopi"
    const n = baopi ? 44 : 18
    return Array.from({ length: n }, (_, i) => {
      const angle = (Math.PI * 2 * i) / n + Math.random() * 0.4
      const dist = (baopi ? 190 : 100) + Math.random() * 90
      return {
        dx: (Math.cos(angle) * dist).toFixed(1) + "px",
        dy: (Math.sin(angle) * dist).toFixed(1) + "px",
        delay: (Math.random() * 0.12).toFixed(2) + "s",
      }
    })
  }, [type, seed])

  return (
    <div className={"fx-layer show " + (type === "baopi" ? "gold" : "normal")} id="fx">
      {particles.map((p, i) => (
        <i
          className={"fx-particle" + (type === "baopi" ? " gold" : "")}
          key={i}
          style={
            {
              "--dx": p.dx,
              "--dy": p.dy,
              animationDelay: p.delay,
            } as CSSProperties
          }
        />
      ))}
      {type === "baopi" ? (
        <>
          <div className="fx-ring" />
          <div className="fx-label">宝牌和！</div>
        </>
      ) : null}
    </div>
  )
}

export function RotateTip() {
  return (
    <div className="rotate-tip" id="rotate-tip" aria-hidden="true">
      <div className="rotate-card">
        <div className="rotate-icon">🔄</div>
        <p>请横屏游玩</p>
        <span>将手机横过来，获得完整牌桌视野</span>
      </div>
    </div>
  )
}
