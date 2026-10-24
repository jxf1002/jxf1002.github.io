"use client"

import { useEffect, useRef, useState } from "react"
import type { ClipboardEvent, KeyboardEvent } from "react"
import Page from "../layout/Page"
import PageHeader from "../layout/PageHeader"
import {
  LENGTH,
  MAX_TRIES,
  hint,
  isPlayable,
  randomCode,
  score,
} from "../../lib/guess"
import type { Round } from "../../lib/guess"

type Status = "playing" | "win" | "lose" | "abandon"
type Game = { answer: string; rounds: Round[]; status: Status }
type PastGame = { at: number; result: Status; tries: number }

const SAVE_KEY = "guess-save-v1"
const RECORD_KEY = "guess-records-v1"
const MAX_RECORDS = 100
const EMPTY_DIGITS = ["", "", "", ""]
const STATUS_TEXT: Record<Status, string> = {
  playing: "",
  win: "本局猜中",
  lose: "本局失败",
  abandon: "本局已放弃",
}

function fresh(): Game {
  return { answer: randomCode(), rounds: [], status: "playing" }
}

function loadGame(): Game | null {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY) || "null") as Game | null
    if (!d || !isPlayable(d.answer) || !Array.isArray(d.rounds)) return null
    if (!(d.status in STATUS_TEXT)) return null
    return d
  } catch {
    return null
  }
}

function loadRecords(): PastGame[] {
  try {
    const d = JSON.parse(localStorage.getItem(RECORD_KEY) || "[]") as PastGame[]
    return Array.isArray(d) ? d : []
  } catch {
    return []
  }
}

export default function GuessGame() {
  const [game, setGame] = useState<Game | null>(null)
  const [records, setRecords] = useState<PastGame[]>([])
  const [digits, setDigits] = useState<string[]>(EMPTY_DIGITS)
  const [error, setError] = useState("")
  const inputs = useRef<Array<HTMLInputElement | null>>([])

  // 静态导出时没有 localStorage，存档只能在挂载后读，避免 hydration 不一致
  useEffect(() => {
    setRecords(loadRecords())
    setGame(loadGame() ?? fresh())
  }, [])

  const ended = game ? game.status !== "playing" : true
  const left = game ? MAX_TRIES - game.rounds.length : MAX_TRIES

  function commit(next: Game) {
    setGame(next)
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(next))
    } catch {
      // ponytail: 无痕模式存不了就跳过，游戏照常玩
    }
    if (next.status === "playing") return
    const record: PastGame = {
      at: Date.now(),
      result: next.status,
      tries: next.rounds.length,
    }
    const list = [record, ...records].slice(0, MAX_RECORDS)
    setRecords(list)
    try {
      localStorage.setItem(RECORD_KEY, JSON.stringify(list))
    } catch {
      // 同上
    }
  }

  function reset() {
    commit(fresh())
    setDigits(EMPTY_DIGITS)
    setError("")
    inputs.current[0]?.focus()
  }

  function submit() {
    if (!game || game.status !== "playing") return
    const code = digits.join("")
    if (!isPlayable(code)) {
      setError("请先填满 4 个不重复的数字，再点确认")
      return
    }
    if (game.rounds.some((r) => r.guess === code)) {
      setError("这组数字已经猜过了")
      return
    }
    const feedback = score(game.answer, code)
    const rounds = [...game.rounds, { guess: code, ...feedback }]
    const status: Status = feedback.bulls === LENGTH
      ? "win"
      : rounds.length >= MAX_TRIES
        ? "lose"
        : "playing"
    setDigits(EMPTY_DIGITS)
    setError("")
    commit({ ...game, rounds, status })
    inputs.current[0]?.focus()
  }

  function showHint() {
    if (!game || game.status !== "playing") return
    setDigits(hint(game.rounds).split(""))
    setError("")
    inputs.current[0]?.focus()
  }

  function abandon() {
    if (!game || game.status !== "playing") return
    commit({ ...game, status: "abandon" })
    setDigits(EMPTY_DIGITS)
  }

  function setDigit(index: number, raw: string) {
    const digit = raw.replace(/\D/g, "").slice(-1)
    const next = [...digits]
    next[index] = digit
    setDigits(next)
    setError("")
    if (digit && index < LENGTH - 1) inputs.current[index + 1]?.focus()
  }

  function onKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      submit()
      return
    }
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      e.preventDefault()
      const next = [...digits]
      next[index - 1] = ""
      setDigits(next)
      inputs.current[index - 1]?.focus()
      return
    }
    if (e.key === "ArrowLeft" && index > 0) inputs.current[index - 1]?.focus()
    if (e.key === "ArrowRight" && index < LENGTH - 1) {
      inputs.current[index + 1]?.focus()
    }
  }

  function onPaste(e: ClipboardEvent<HTMLDivElement>) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, LENGTH)
    if (text.length < LENGTH) return
    e.preventDefault()
    setDigits(text.split(""))
    setError("")
    inputs.current[LENGTH - 1]?.focus()
  }

  if (!game) {
    return (
      <Page className="guess-page">
        <p className="text-sm text-fg-muted">加载中…</p>
      </Page>
    )
  }

  return (
    <Page className="guess-page">
      <PageHeader
        title="猜数字"
        description={`0-9 里选 4 个不重复的数字，${MAX_TRIES} 次机会猜中；数字对但位置错会单独统计。`}
      />

      {/* 手机上按 玩 → 猜测记录 → 战绩 排列，桌面摆成 记录 / 玩 / 战绩 三栏；
          桌面端高度由 guess/style.css 锁成一屏，卡片内部各自滚动 */}
      <div className="guess-grid grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)_18rem]">
        <section className="order-2 flex flex-col rounded-2xl border border-solid border-line bg-surface p-4 shadow-card lg:order-1 lg:min-h-0 lg:overflow-y-auto">
          <div className="flex flex-wrap items-baseline justify-between gap-1">
            <h2 className="text-sm font-semibold">猜测记录</h2>
            <span className="text-xs text-fg-muted">最新在上</span>
          </div>
          {/* 表格沿用 site.css 的全局 th/td 样式（无 layer，会压过工具类），这里只补颜色与字距 */}
          <table className="mt-2 w-full table-fixed text-sm leading-tight">
            <thead>
              <tr>
                <th className="whitespace-nowrap py-1!">猜测</th>
                <th className="whitespace-nowrap py-1!">完全正确</th>
                <th className="whitespace-nowrap py-1!">数字正确</th>
              </tr>
            </thead>
            <tbody>
              {[...game.rounds].reverse().map((round) => (
                <tr key={round.guess}>
                  <td className="py-1! font-mono tracking-[0.3em] text-fg">{round.guess}</td>
                  <td className="py-1! font-semibold text-primary">{round.bulls}</td>
                  <td className="py-1! text-fg-muted">{round.cows}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {game.rounds.length === 0 && (
            <p className="mt-2 rounded-xl border border-dashed border-line px-3 py-6 text-center text-sm text-fg-muted">
              还没有猜过，输入一组数字开始吧
            </p>
          )}
          <p className="mt-auto pt-3 text-xs leading-relaxed text-fg-muted">
            完全正确：数字和位置都对 · 数字正确：数字对但位置错
          </p>
        </section>

        <section className="order-1 flex flex-col justify-center rounded-2xl border border-solid border-line bg-surface p-4 shadow-card sm:p-5 lg:order-2 lg:min-h-0 lg:overflow-y-auto lg:[justify-content:safe_center]">
          {/* 答案位：未结束时只露问号，结束后揭晓 */}
          <div className="flex justify-center gap-2 sm:gap-3">
            {Array.from(game.answer).map((digit, i) => (
              <span
                key={i}
                className={`flex h-[clamp(3.25rem,11dvh,5rem)] w-[clamp(2.5rem,8.5dvh,4rem)] items-center justify-center rounded-xl border-2 border-solid text-[clamp(1.75rem,5dvh,2.5rem)] font-bold transition-colors ${
                  ended
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-dashed border-line bg-surface-muted text-fg-muted"
                }`}
              >
                {ended ? digit : "?"}
              </span>
            ))}
          </div>

          <p className="mt-2 text-center text-sm text-fg-muted">
            {ended
              ? `答案 ${game.answer}`
              : `还剩 ${left} 次机会`}
          </p>

          {ended
            ? (
                <div className="mt-4 flex flex-col items-center gap-3 rounded-xl bg-surface-muted px-4 py-3 text-center sm:flex-row sm:justify-between sm:text-left">
                  <p className="text-sm font-semibold">
                    {STATUS_TEXT[game.status]}
                    <span className="ml-1 font-normal text-fg-muted">
                      {game.status === "win"
                        ? `，用了 ${game.rounds.length} 次`
                        : game.status === "lose"
                          ? `，${MAX_TRIES} 次机会用完了`
                          : ""}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={reset}
                    className="cursor-pointer rounded-xl border-0 bg-primary px-4 py-2 font-semibold! text-bg transition-opacity hover:opacity-90"
                  >
                    再来一局
                  </button>
                </div>
              )
            : (
                <>
                  <div
                    className="mt-4 flex justify-center gap-2 sm:gap-3"
                    onPaste={onPaste}
                  >
                    {digits.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => {
                          inputs.current[i] = el
                        }}
                        value={digit}
                        onChange={(e) => setDigit(i, e.target.value)}
                        onKeyDown={(e) => onKeyDown(i, e)}
                        onFocus={(e) => e.target.select()}
                        inputMode="numeric"
                        autoComplete="off"
                        aria-label={`第 ${i + 1} 位数字`}
                        className="h-[clamp(3.25rem,11dvh,5rem)] w-[clamp(2.5rem,8.5dvh,4rem)] appearance-none rounded-xl border-2 border-solid border-line bg-surface p-0 text-center text-[clamp(1.5rem,4.5dvh,2.25rem)]! font-bold! text-fg outline-none transition-colors focus:border-primary"
                      />
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={submit}
                      className="cursor-pointer rounded-xl border-0 bg-primary px-6 py-2.5 font-semibold! text-bg transition-opacity hover:opacity-90"
                    >
                      确认
                    </button>
                    <button
                      type="button"
                      onClick={showHint}
                      className="cursor-pointer rounded-xl border border-solid border-line bg-surface-muted px-5 py-2.5 font-semibold! text-fg transition-colors hover:border-primary hover:text-primary"
                    >
                      提示
                    </button>
                    <button
                      type="button"
                      onClick={abandon}
                      className="cursor-pointer rounded-xl border-0 bg-transparent px-4 py-2.5 font-semibold! text-fg-muted transition-colors hover:text-accent"
                    >
                      放弃
                    </button>
                  </div>

                  <p role="alert" className="mt-2 h-5 text-center text-sm text-accent">
                    {error}
                  </p>
                </>
              )}
        </section>

        <aside className="order-3 flex flex-col rounded-2xl border border-solid border-line bg-surface p-4 shadow-card lg:min-h-0">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">战绩</h2>
            <span className="text-xs text-fg-muted">{records.length} 局</span>
          </div>
          {records.length === 0
            ? <p className="mt-3 text-sm text-fg-muted">还没有记录，玩一局就会出现在这里。</p>
            : (
                <ul className="mt-2 max-h-[22rem] min-h-0 flex-1 divide-y divide-line overflow-y-auto lg:max-h-none">
                  {records.map((record, i) => (
                    <li
                      key={`${record.at}-${i}`}
                      className="flex items-center justify-between gap-2 py-2 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <span aria-hidden="true">
                          {record.result === "win" ? "✅" : record.result === "lose" ? "❌" : "🏳️"}
                        </span>
                        {record.result === "win" ? "猜中" : record.result === "lose" ? "失败" : "放弃"}
                      </span>
                      <span className="text-fg-muted">{record.tries} 次</span>
                    </li>
                  ))}
                </ul>
              )}
        </aside>
      </div>
    </Page>
  )
}
