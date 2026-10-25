"use client"

import { useEffect, useState } from "react"
import Page from "../layout/Page"
import PageHeader from "../layout/PageHeader"
import {
  DECK,
  cardId,
  cardName,
  isCard,
  isPuzzle,
  randomPuzzle,
  sameCard,
} from "../../lib/five-cards"
import type { Card, Puzzle } from "../../lib/five-cards"

type Game = { puzzle: Puzzle; guess: Card | null }

const SAVE_KEY = "five-cards-save-v1"
const SLOT_LABELS = ["扣牌", "P", "①", "②", "③"]

function loadGame(): Game | null {
  try {
    const data = JSON.parse(
      localStorage.getItem(SAVE_KEY) || "null",
    ) as { puzzle?: unknown; guess?: unknown } | null
    if (!data || !isPuzzle(data.puzzle)) return null
    return {
      puzzle: data.puzzle,
      guess: isCard(data.guess) ? data.guess : null,
    }
  } catch {
    return null
  }
}

function saveGame(game: Game) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(game))
  } catch {
    // 无痕模式存不了就跳过，游戏照常玩
  }
}

export default function FiveCardsGame() {
  const [game, setGame] = useState<Game | null>(null)

  // 静态导出时没有 localStorage，存档只能在挂载后读，避免 hydration 不一致
  useEffect(() => {
    const saved = loadGame()
    if (saved) {
      setGame(saved)
      return
    }
    const fresh = { puzzle: randomPuzzle(), guess: null }
    setGame(fresh)
    saveGame(fresh)
  }, [])

  if (!game) {
    return (
      <Page className="five-cards-page">
        <p className="text-sm text-fg-muted">加载中…</p>
      </Page>
    )
  }

  const { puzzle, guess } = game
  const revealed = guess !== null
  const correct = revealed && sameCard(guess, puzzle.hidden)
  const usedIds = new Set([puzzle.key, ...puzzle.order].map(cardId))

  function pick(card: Card) {
    if (!game || game.guess) return
    const next = { ...game, guess: card }
    setGame(next)
    saveGame(next)
  }

  function nextRound() {
    const fresh = { puzzle: randomPuzzle(), guess: null }
    setGame(fresh)
    saveGame(fresh)
  }

  return (
    <Page className="five-cards-page">
      <PageHeader
        title="五张牌魔术"
        description="一张扣牌、四张明牌。读懂后三张的排列，就能算出扣住的那张。"
      />

      <details className="mb-4 rounded-xl border border-solid border-line bg-surface-muted px-4 py-3 text-sm">
        <summary className="cursor-pointer font-semibold">怎么看牌</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-fg-muted">
          <li>扣牌与第 1 张明牌 P 同花色。</li>
          <li>
            后 3 张按点数从小到大排好（同点数按 梅花 &lt; 方块 &lt; 红桃
            &lt; 黑桃），六种顺序依次表示 d = 1–6：123、132、213、231、312、321。
          </li>
          <li>
            扣牌点数 = P 的点数 + d（A=1、J=11、Q=12、K=13，超过 K 从 A
            继续数）。
          </li>
        </ol>
      </details>

      <section className="rounded-2xl border border-solid border-line bg-surface p-4 shadow-card sm:p-5">
        <div className="five-cards-spread">
          <figure>
            <img
              src={
                revealed
                  ? `/cards/webp/${cardId(puzzle.hidden)}.webp`
                  : "/cards/webp/back.webp"
              }
              alt={revealed ? cardName(puzzle.hidden) : "扣牌（背面）"}
            />
            <figcaption>{SLOT_LABELS[0]}</figcaption>
          </figure>
          {[puzzle.key, ...puzzle.order].map((card, i) => (
            <figure key={cardId(card)}>
              <img
                src={`/cards/webp/${cardId(card)}.webp`}
                alt={cardName(card)}
              />
              <figcaption>{SLOT_LABELS[i + 1]}</figcaption>
            </figure>
          ))}
        </div>

        <div className="mt-3 flex min-h-11 flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <p
            role="status"
            aria-live="polite"
            className={`text-sm ${
              revealed
                ? correct
                  ? "font-semibold text-primary"
                  : "font-semibold text-accent-strong"
                : "text-fg-muted"
            }`}
          >
            {guess === null
              ? "从下面 52 张牌里点一张，猜猜扣牌是哪张（只有一次机会）。"
              : correct
                ? `猜对了！扣牌是 ${cardName(puzzle.hidden)}。`
                : `猜错了。扣牌是 ${cardName(puzzle.hidden)}。`}
          </p>
          {revealed && (
            <button
              type="button"
              onClick={nextRound}
              className="cursor-pointer rounded-xl border-0 bg-primary px-4 py-2 font-semibold! text-bg transition-opacity hover:opacity-90"
            >
              开始下一局
            </button>
          )}
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-solid border-line bg-surface p-3 shadow-card sm:p-4">
        <div className="five-cards-board-wrap">
          <div className="five-cards-board">
            {DECK.map((card) => {
              const id = cardId(card)
              const used = usedIds.has(id)
              const answer = revealed && sameCard(card, puzzle.hidden)
              const wrong
                = revealed && guess !== null && !correct && sameCard(card, guess)
              return (
                <button
                  key={id}
                  type="button"
                  data-card={id}
                  aria-label={cardName(card)}
                  disabled={revealed || used}
                  onClick={() => pick(card)}
                  className={
                    used ? "is-used" : answer ? "is-answer" : wrong ? "is-wrong" : ""
                  }
                >
                  <img
                    src={`/cards/webp/${id}.webp`}
                    alt=""
                    draggable={false}
                    loading="lazy"
                    decoding="async"
                  />
                </button>
              )
            })}
          </div>
        </div>
      </section>
    </Page>
  )
}
