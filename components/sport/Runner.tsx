"use client"

import type { CSSProperties } from "react"
import { useEffect, useRef, useState } from "react"
import type { SportId, SportReport } from "../../lib/sport"
import {
  SPORT_IDS,
  buildReport,
  cycleFor,
  formatTime,
  progressFor,
  sportDef,
} from "../../lib/sport"
import SportFigure from "./Figures"

export default function Runner() {
  const startedAt = useRef(0)
  const interval = useRef<ReturnType<typeof setInterval> | null>(null)
  const [sport, setSport] = useState<SportId>("run")
  const [speed, setSpeed] = useState(sportDef("run").defaultSpeed)
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [report, setReport] = useState<SportReport | null>(null)

  const def = sportDef(sport)

  useEffect(
    () => () => {
      if (interval.current) clearInterval(interval.current)
    },
    [],
  )

  function stop() {
    if (interval.current) clearInterval(interval.current)
    interval.current = null
  }

  function start() {
    startedAt.current = Date.now()
    interval.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.current) / 1000))
    }, 1000)
    setElapsed(0)
    setRunning(true)
    setReport(null)
  }

  function finish() {
    stop()
    const next = buildReport(sport, speed, (Date.now() - startedAt.current) / 1000)
    setElapsed(next.elapsedSeconds)
    setRunning(false)
    setReport(next)
  }

  function pick(id: SportId) {
    stop()
    setSport(id)
    setSpeed(sportDef(id).defaultSpeed)
    setRunning(false)
    setElapsed(0)
    setReport(null)
  }

  const progress = progressFor(sport, speed)

  return (
    <main
      className="sport"
      data-fullscreen
      style={{ "--cycle": cycleFor(sport, speed) } as CSSProperties}
    >
      <header className="sport-bar">
        <div>
          <p className="eyebrow">CYBER SPORT / 04</p>
          <h1>今天动起来</h1>
        </div>
        <div className="sport-tabs" role="tablist" aria-label="选择运动项目">
          {SPORT_IDS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={id === sport}
              className={id === sport ? "on" : ""}
              onClick={() => pick(id)}
            >
              {sportDef(id).name}
            </button>
          ))}
        </div>
      </header>

      <section
        className={running ? "stage" : "stage is-paused"}
        data-sport={sport}
        aria-label={def.name + "动画"}
      >
        <div className="backdrop" aria-hidden="true">
          <i className="sky" />
          <i className="clouds" />
          <i className="far" />
          <i className="near" />
        </div>
        <div className="figure-wrap">
          <SportFigure sport={sport} />
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>{def.name}强度</h2>
          <span className="speed-read">
            <strong>{speed}</strong>
            {def.unit}
          </span>
        </div>
        <input
          type="range"
          min={def.min}
          max={def.max}
          step={def.step}
          value={speed}
          aria-label={"调整" + def.name + "强度"}
          style={{
            background:
              "linear-gradient(90deg, var(--accent) 0 " +
              progress +
              "%, var(--track) " +
              progress +
              "% 100%)",
          }}
          onChange={(event) => setSpeed(Number(event.target.value))}
        />
        <div className="range-labels">
          <span>{def.labels[0]}</span>
          <span>{def.labels[1]}</span>
        </div>
        <div className="action-row">
          <button type="button" disabled={running} onClick={start}>
            开始运动
          </button>
          <button
            className="secondary"
            type="button"
            disabled={!running}
            onClick={finish}
          >
            结束运动
          </button>
          <p className="timer">
            <span>计时</span>
            <strong>{formatTime(elapsed)}</strong>
          </p>
        </div>
      </section>

      {report && (
        <div className="report-overlay">
          <section
            className="report"
            role="dialog"
            aria-modal="true"
            aria-label="运动报告"
          >
            <h2>SPORT REPORT // 训练完成</h2>
            <div className="report-grid">
              {report.metrics.map((metric) => (
                <div className="report-item" key={metric.label}>
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                </div>
              ))}
            </div>
            <p className="report-note">{report.note}</p>
            <button type="button" onClick={() => setReport(null)}>
              继续运动
            </button>
          </section>
        </div>
      )}
    </main>
  )
}
