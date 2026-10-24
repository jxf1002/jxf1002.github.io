"use client"

import { useEffect, useRef, useState } from "react"
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react"
import {
  MODES,
  MODE_META,
  MONTH_NAMES,
  WEEKDAY_NAMES,
  boardOf,
  cellLabel,
  hint,
  isoToday,
  orient,
  parseIsoDate,
  placementNearCenter,
  piecesOf,
  shapeBounds,
  targetIds,
  weekdayOf,
} from "../../lib/calendar"
import type { Mode, Placed, Shape } from "../../lib/calendar"

type Orientation = { rotation: number; mirrored: boolean }
type Drag = {
  source: "tray" | "board"
  piece: number
  /** 棋盘拖动时按下的源格子，仅用于隐藏焦点框 */
  grabCell: string | null
  rotation: number
  mirrored: boolean
  startX: number
  startY: number
  pointerX: number
  pointerY: number
  moved: boolean
  targetCell: string | null
  preview: string[] | null
  pointerType: string
}

function pieceStyle(piece: number): CSSProperties {
  return { "--piece": `var(--calendar-pc-${piece})` } as CSSProperties
}

function PieceShape({ shape }: { shape: Shape }) {
  const { rows, cols } = shapeBounds(shape)
  return (
    <span
      className="calendar-piece-grid"
      style={{
        gridTemplateColumns: `repeat(${cols}, var(--calendar-piece-cell))`,
        gridTemplateRows: `repeat(${rows}, var(--calendar-piece-cell))`,
      }}
    >
      {shape.map(([row, col]) => (
        <span
          key={`${row}-${col}`}
          style={{ gridRow: row + 1, gridColumn: col + 1 }}
        />
      ))}
    </span>
  )
}

function RotateIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  )
}

function FlipIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 3v18" strokeDasharray="2 3" />
      <path d="m8 7-5 5 5 5V7Z" />
      <path d="m16 7 5 5-5 5V7Z" />
    </svg>
  )
}

export default function CalendarGame() {
  // 静态导出时没有“今天”，挂载后再取，避免 hydration 不一致
  const [date, setDate] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>("basic")
  const [placed, setPlaced] = useState<Placed[]>([])
  const [orientations, setOrientations] = useState<Record<number, Orientation>>(
    {},
  )
  const [drag, setDrag] = useState<Drag | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [message, setMessage] = useState("")
  const [won, setWon] = useState(false)
  const suppressClick = useRef(false)
  const draggingRef = useRef(false)
  const dragging = drag !== null

  useEffect(() => {
    setDate(isoToday())
  }, [])

  // 拖动期间空格/ R 旋转，Tab / F 翻转；平时不拦截这些键
  useEffect(() => {
    if (!dragging) return
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.key === " "
        || event.code === "Space"
        || event.key === "r"
        || event.key === "R"
      ) {
        event.preventDefault()
        rotateDrag()
      } else if (
        event.key === "Tab"
        || event.key === "f"
        || event.key === "F"
      ) {
        event.preventDefault()
        flipDrag()
      } else if (event.key === "Escape") {
        event.preventDefault()
        cancelDrag()
      }
    }
    function onKeyUp(event: KeyboardEvent) {
      if (event.key === " " || event.code === "Space" || event.key === "Tab") {
        event.preventDefault()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
    }
  }, [dragging])

  // 托盘拖动时把当前方向实时同步到选择栏，松手前就能看到旋转/翻转结果
  useEffect(() => {
    if (drag?.source !== "tray") return
    setOrientations(current => {
      const previous = current[drag.piece]
      if (
        previous?.rotation === drag.rotation
        && previous.mirrored === drag.mirrored
      ) {
        return current
      }
      return {
        ...current,
        [drag.piece]: {
          rotation: drag.rotation,
          mirrored: drag.mirrored,
        },
      }
    })
  }, [drag])

  if (!date) {
    return (
      <main
        className="calendar-page mx-auto w-full max-w-6xl px-4 py-10"
        data-fullscreen
      >
        <p className="text-sm text-fg-muted">加载中…</p>
      </main>
    )
  }

  const parts = parseIsoDate(date)
  if (!parts) {
    return (
      <main
        className="calendar-page mx-auto w-full max-w-6xl px-4 py-10"
        data-fullscreen
      >
        <p className="text-sm text-fg-muted">日期无效，请重新选择。</p>
      </main>
    )
  }

  const board = boardOf(mode)
  const pieces = piecesOf(mode)
  const weekday = weekdayOf(parts.year, parts.month, parts.day)
  const target = targetIds(mode, {
    month: parts.month - 1,
    day: parts.day,
    weekday,
  })
  const targetSet = new Set(target)
  const owner = new Map<string, number>()
  for (const item of placed) {
    for (const id of item.cells) owner.set(id, item.piece)
  }
  const placedSet = new Set(placed.map(item => item.piece))
  const displayPlaced = drag?.moved && drag.source === "board"
    ? placed.filter(item => item.piece !== drag.piece)
    : placed
  const displayOwner = new Map<string, number>()
  for (const item of displayPlaced) {
    for (const id of item.cells) displayOwner.set(id, item.piece)
  }
  const dragPreview = drag?.moved ? drag.preview : null
  const dragPreviewSet = new Set(dragPreview ?? [])

  const dateText = `${parts.year}年${parts.month}月${parts.day}日 ${WEEKDAY_NAMES[weekday]}`
  const targetText = mode === "advanced"
    ? `${MONTH_NAMES[parts.month - 1]} ${parts.day}日 ${WEEKDAY_NAMES[weekday]}`
    : `${MONTH_NAMES[parts.month - 1]} ${parts.day}日`
  const statusText = drag?.moved
    ? drag.pointerType === "touch"
      ? "松开放下 · 用下方按钮旋转/翻转"
      : "松开放下 · 空格旋转 · Tab 翻转"
    : message
      || (selected !== null
        ? `已选中第 ${selected + 1} 块，可旋转/翻转或拖到棋盘`
        : "拖动拼块到棋盘")

  function remember(piece: number, rotation: number, mirrored: boolean) {
    setOrientations(current => {
      const previous = current[piece]
      if (previous?.rotation === rotation && previous.mirrored === mirrored) {
        return current
      }
      return { ...current, [piece]: { rotation, mirrored } }
    })
  }

  function resetBoard() {
    setPlaced([])
    setOrientations({})
    setDrag(null)
    setSelected(null)
    setMessage("")
    setWon(false)
    suppressClick.current = false
    draggingRef.current = false
  }

  function blurDragSource() {
    const active = document.activeElement
    if (
      active instanceof HTMLElement
      && active.closest(".calendar-board, .calendar-tray")
    ) {
      active.blur()
    }
  }

  function changeMode(next: Mode) {
    if (next === mode) return
    setMode(next)
    resetBoard()
  }

  function changeDate(next: string) {
    setDate(next)
    resetBoard()
  }

  function selectPiece(piece: number) {
    setSelected(current => current === piece ? null : piece)
    setMessage("")
  }

  function removePiece(piece: number) {
    const item = placed.find(entry => entry.piece === piece)
    if (item) remember(piece, item.rotation ?? 0, item.mirrored ?? false)
    setPlaced(current => current.filter(entry => entry.piece !== piece))
    setWon(false)
    setMessage("")
  }

  function consumeSuppressedClick(): boolean {
    if (!suppressClick.current) return false
    suppressClick.current = false
    return true
  }

  function clickCell(id: string) {
    if (draggingRef.current) return
    if (consumeSuppressedClick()) return
    const owned = owner.get(id)
    if (owned !== undefined) removePiece(owned)
  }

  function takeHint() {
    const next = hint(mode, target, placed)
    if (!next) {
      setMessage("当前摆法走不通，先取回几块再试")
      return
    }
    remember(next.piece, next.rotation ?? 0, next.mirrored ?? false)
    const updated = [...placed, next]
    setPlaced(updated)
    setMessage("")
    if (updated.length === pieces.length) setWon(true)
  }

  function cellAt(x: number, y: number): string | null {
    const element = document
      .elementFromPoint(x, y)
      ?.closest<HTMLElement>("[data-cell]")
    return element?.dataset.cell ?? null
  }

  function computePreview(
    current: Drag,
    rotation: number,
    mirrored: boolean,
    targetCell = current.targetCell,
  ): string[] | null {
    if (!targetCell) return null
    const blocked = new Set(targetSet)
    for (const item of placed) {
      if (current.source === "board" && item.piece === current.piece) continue
      for (const id of item.cells) blocked.add(id)
    }
    if (blocked.has(targetCell)) return null
    return placementNearCenter(
      mode,
      current.piece,
      rotation,
      mirrored,
      targetCell,
      blocked,
    )
  }

  function startTrayDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    piece: number,
  ) {
    if (drag || !event.isPrimary || event.button !== 0) return
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // 没有指针捕获也能继续，移动事件会落到棋盘格子上
    }
    const saved = orientations[piece] ?? { rotation: 0, mirrored: false }
    draggingRef.current = true
    setMessage("")
    setDrag({
      source: "tray",
      piece,
      grabCell: null,
      rotation: saved.rotation,
      mirrored: saved.mirrored,
      startX: event.clientX,
      startY: event.clientY,
      pointerX: event.clientX,
      pointerY: event.clientY,
      moved: false,
      targetCell: null,
      preview: null,
      pointerType: event.pointerType,
    })
  }

  function startBoardDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    id: string,
  ) {
    if (drag || !event.isPrimary || event.button !== 0) return
    const piece = owner.get(id)
    if (piece === undefined) return
    const item = placed.find(entry => entry.piece === piece)
    if (!item) return
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // 同上
    }
    draggingRef.current = true
    setSelected(null)
    setMessage("")
    setDrag({
      source: "board",
      piece,
      grabCell: id,
      rotation: item.rotation ?? 0,
      mirrored: item.mirrored ?? false,
      startX: event.clientX,
      startY: event.clientY,
      pointerX: event.clientX,
      pointerY: event.clientY,
      moved: false,
      targetCell: null,
      preview: null,
      pointerType: event.pointerType,
    })
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!drag || !event.isPrimary) return
    const threshold = event.pointerType === "touch" ? 10 : 4
    const moved = drag.moved
      || Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY)
        > threshold
    if (!moved) return
    event.preventDefault()
    if (!drag.moved) setSelected(null)
    const targetCell = cellAt(event.clientX, event.clientY)
    setDrag({
      ...drag,
      moved: true,
      targetCell,
      preview: computePreview(drag, drag.rotation, drag.mirrored, targetCell),
      pointerX: event.clientX,
      pointerY: event.clientY,
    })
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!drag || !event.isPrimary) return
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // jsdom / 旧浏览器没有指针捕获
    }
    draggingRef.current = false
    blurDragSource()
    if (!drag.moved) {
      if (drag.source === "tray" && drag.pointerType === "touch") {
        selectPiece(drag.piece)
      }
      setDrag(null)
      return
    }
    setSelected(null)
    suppressClick.current = true
    setTimeout(() => {
      suppressClick.current = false
    }, 0)
    // 松手用最后显示出来的预览，避免手指轻微漂移导致“看着能放、松手失败”
    if (drag.preview) {
      const cells = drag.preview
      remember(drag.piece, drag.rotation, drag.mirrored)
      if (drag.source === "tray") {
        const next = [
          ...placed,
          {
            piece: drag.piece,
            cells,
            rotation: drag.rotation,
            mirrored: drag.mirrored,
          },
        ]
        setPlaced(next)
        if (next.length === pieces.length) setWon(true)
      } else {
        setPlaced(current => current.map(item => item.piece === drag.piece
          ? {
              ...item,
              cells,
              rotation: drag.rotation,
              mirrored: drag.mirrored,
            }
          : item))
      }
      setMessage("")
    } else {
      setMessage("这里放不下，拼块回到原处")
    }
    setDrag(null)
  }

  function handlePointerCancel() {
    if (!drag) return
    draggingRef.current = false
    blurDragSource()
    setDrag(null)
    setMessage("")
  }

  function rotateDrag() {
    setDrag(current => {
      if (!current) return current
      const rotation = (current.rotation + 1) % 4
      return {
        ...current,
        rotation,
        preview: computePreview(current, rotation, current.mirrored),
      }
    })
  }

  function flipDrag() {
    setDrag(current => {
      if (!current) return current
      const mirrored = !current.mirrored
      return {
        ...current,
        mirrored,
        preview: computePreview(current, current.rotation, mirrored),
      }
    })
  }

  function rotateAction() {
    if (drag) {
      rotateDrag()
      return
    }
    if (selected === null) return
    const saved = orientations[selected] ?? { rotation: 0, mirrored: false }
    remember(selected, (saved.rotation + 1) % 4, saved.mirrored)
    setMessage("")
  }

  function flipAction() {
    if (drag) {
      flipDrag()
      return
    }
    if (selected === null) return
    const saved = orientations[selected] ?? { rotation: 0, mirrored: false }
    remember(selected, saved.rotation, !saved.mirrored)
    setMessage("")
  }

  function cancelDrag() {
    draggingRef.current = false
    blurDragSource()
    setDrag(null)
    setMessage("")
  }

  return (
    <main
      className="calendar-page mx-auto w-full max-w-6xl px-4 py-6"
      data-fullscreen
    >
      <header className="calendar-header">
        <h1>日历拼图</h1>
        <p className="calendar-subtitle">
          拖动拼块完成拼图，空格旋转，Tab 键翻转。
        </p>
      </header>

      <section className="calendar-toolbar" aria-label="难度和日期">
        <div className="calendar-modes" role="group" aria-label="难度">
          {MODES.map(item => (
            <button
              key={item}
              type="button"
              data-mode={item}
              aria-pressed={mode === item}
              onClick={() => changeMode(item)}
            >
              <span>{MODE_META[item].name}</span>
            </button>
          ))}
        </div>

        <div className="calendar-date-row">
          <label className="calendar-date">
            <input
              type="date"
              aria-label="日期"
              value={date}
              onChange={(event) => {
                if (parseIsoDate(event.target.value)) {
                  changeDate(event.target.value)
                }
              }}
            />
          </label>
          <button
            type="button"
            className="calendar-today"
            data-action="today"
            onClick={() => changeDate(isoToday())}
          >
            今天
          </button>
          <span className="calendar-date-text">{dateText}</span>
        </div>
      </section>

      <div className="calendar-layout">
        <section className="calendar-board-panel" aria-label="棋盘">
          <div className="calendar-board-wrap">
            <div
              className="calendar-board"
              role="group"
              aria-label="日历棋盘"
            >
              {board.grid.map((row, rowIndex) => row.map((id, colIndex) => {
                if (!id) {
                  return (
                    <div
                      key={`block-${rowIndex}-${colIndex}`}
                      className="calendar-cell is-block"
                      aria-hidden="true"
                    />
                  )
                }
                const isTarget = targetSet.has(id)
                const owned = displayOwner.get(id)
                const classes = ["calendar-cell"]
                if (isTarget) classes.push("is-target")
                if (owned !== undefined) classes.push("is-covered")
                if (dragPreviewSet.has(id)) classes.push("is-preview")
                if (drag?.source === "board" && drag.grabCell === id) {
                  classes.push("is-drag-source")
                }
                const spoken = id[0] === "d"
                  ? `${cellLabel(id)} 日`
                  : cellLabel(id)
                const ariaLabel = owned !== undefined
                  ? `第 ${owned + 1} 块拼图，拖动移动，单击取回`
                  : isTarget
                    ? `${spoken}，目标格`
                    : spoken
                const previewPiece = dragPreviewSet.has(id)
                  ? drag?.piece
                  : undefined
                return (
                  <button
                    key={id}
                    type="button"
                    data-cell={id}
                    className={classes.join(" ")}
                    style={owned !== undefined
                      ? pieceStyle(owned)
                      : previewPiece !== undefined
                        ? pieceStyle(previewPiece)
                        : undefined}
                    aria-label={ariaLabel}
                    onPointerDown={event => startBoardDrag(event, id)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerCancel}
                    onClick={() => clickCell(id)}
                  >
                    <span className="calendar-cell-label">
                      {owned === undefined ? cellLabel(id) : ""}
                    </span>
                  </button>
                )
              }))}
            </div>
          </div>

          {won
            ? (
                <div className="calendar-win" role="status">
                  <strong>拼好了！</strong>
                </div>
              )
            : (
                <p className="calendar-status" role="status" aria-live="polite">
                  {statusText}
                </p>
              )}
        </section>

        <aside className="calendar-side" aria-label="操作">
          <div className="calendar-side-card">
            <h2>目标</h2>
            <p className="calendar-target">{targetText}</p>
            <p className="calendar-progress">
              已放 {placed.length} / {pieces.length} 块
            </p>
          </div>

          <div className="calendar-controls">
            <button
              type="button"
              data-action="hint"
              onClick={takeHint}
              disabled={won || drag !== null}
            >
              提示一块
            </button>
            <button
              type="button"
              data-action="reset"
              onClick={resetBoard}
              disabled={placed.length === 0 && !won}
            >
              全部重来
            </button>
          </div>

          <section
            className="calendar-tray"
            role="group"
            aria-label="未放置的拼块"
          >
            {pieces.every((_, piece) => placedSet.has(piece))
              ? <p className="calendar-tray-empty">拼块都用完了</p>
              : pieces.map((shape, piece) => {
                  if (placedSet.has(piece)) return null
                  const saved = orientations[piece]
                    ?? { rotation: 0, mirrored: false }
                  const shown = orient(shape, saved.rotation, saved.mirrored)
                  const isDragging = drag?.source === "tray"
                    && drag.piece === piece
                    && drag.moved
                  const isDragSource = drag?.source === "tray"
                    && drag.piece === piece
                  return (
                    <button
                      key={piece}
                      type="button"
                      className={`calendar-piece${isDragging ? " is-dragging" : ""}${isDragSource ? " is-drag-source" : ""}`}
                      data-piece={piece}
                      data-rotation={saved.rotation}
                      data-mirrored={saved.mirrored}
                      style={pieceStyle(piece)}
                      aria-label={`第 ${piece + 1} 块拼图，按住拖到棋盘`}
                      aria-pressed={selected === piece}
                      onPointerDown={event => startTrayDrag(event, piece)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerCancel}
                    >
                      <PieceShape shape={shown} />
                    </button>
                  )
                })}
          </section>

          <details className="calendar-help">
            <summary>怎么玩</summary>
            <ol>
              <li>从右侧（手机上在棋盘下方）按住拼块拖到棋盘，松手放下。</li>
              <li>
                桌面拖动时按空格旋转、Tab 翻转；手机上点一下拼块选中，或用手指拖着拼块时，都可以用屏幕下方的旋转/翻转按钮。
              </li>
              <li>落点不允许时，拼块会回到拖动前的位置。</li>
              <li>单击已经放下的拼块可以取回，方向和旋转保持不变。</li>
            </ol>
          </details>
        </aside>
      </div>

      {(selected !== null || (drag?.moved && drag.pointerType === "touch")) && (
        <div className="calendar-drag-actions" role="group" aria-label="拼块操作">
          <button
            type="button"
            data-drag-action="rotate"
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
              rotateAction()
            }}
          >
            <RotateIcon />
            旋转
          </button>
          <button
            type="button"
            data-drag-action="flip"
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
              flipAction()
            }}
          >
            <FlipIcon />
            翻转
          </button>
        </div>
      )}

      {drag?.moved && (
        <div
          className={`calendar-drag-ghost${drag.pointerType === "touch" ? " is-touch" : ""}`}
          aria-hidden="true"
          style={{
            left: drag.pointerX,
            top: drag.pointerY,
            "--piece": `var(--calendar-pc-${drag.piece})`,
          } as CSSProperties}
        >
          <PieceShape
            shape={orient(pieces[drag.piece], drag.rotation, drag.mirrored)}
          />
        </div>
      )}
    </main>
  )
}
