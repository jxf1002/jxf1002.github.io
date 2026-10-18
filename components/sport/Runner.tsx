"use client"

import { useEffect, useRef, useState } from "react"
import type { SportReport } from "../../lib/sport"
import {
  MAX_SPEED,
  MIN_SPEED,
  buildReport,
  formatTime,
  runnerDuration,
  speedProgress,
} from "../../lib/sport"

export default function Runner() {
  const startedAt = useRef(0)
  const interval = useRef<ReturnType<typeof setInterval> | null>(null)
  const [speed, setSpeed] = useState(8)
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [report, setReport] = useState<SportReport | null>(null)

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--runner-duration",
      runnerDuration(speed),
    )
  }, [speed])

  useEffect(
    () => () => {
      if (interval.current) clearInterval(interval.current)
    },
    [],
  )

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
    if (interval.current) clearInterval(interval.current)
    interval.current = null
    const next = buildReport(speed, (Date.now() - startedAt.current) / 1000)
    setElapsed(next.elapsedSeconds)
    setRunning(false)
    setReport(next)
  }

  const progress = speedProgress(speed)
  const rangeBackground =
    "linear-gradient(90deg, var(--blue) 0 " +
    progress +
    "%, #dbe6e7 " +
    progress +
    "% 100%)"

  return (
    <div className="tool-page">
      <main className="page">
        <section
          className={running ? "app" : "app is-paused"}
          aria-label="跑步速度控制器"
        >
          <header className="topbar">
            <div>
              <p className="eyebrow">RUN CLUB / 01</p>
              <h1>今天也要跑起来</h1>
            </div>
            <div className="pace-badge">
              <strong>{speed}</strong>公里 / 小时
            </div>
          </header>

          <section className="scene" aria-label="卡通学生跑步动画">
            <div className="cloud one"></div>
            <div className="cloud two"></div>
            <div className="tree-line"></div>
            <div className="runner">
              <div className="runner-shadow"></div>
              <div className="head">
                <div className="hair"></div>
                <i className="eye left"></i>
                <i className="eye right"></i>
                <i className="smile"></i>
              </div>
              <div className="neck"></div>
              <div className="arm back">
                <div className="hand"></div>
              </div>
              <div className="shirt"></div>
              <div className="shorts"></div>
              <div className="arm front">
                <div className="hand"></div>
              </div>
              <div className="leg back">
                <div className="shoe"></div>
              </div>
              <div className="leg front">
                <div className="shoe"></div>
              </div>
            </div>
            <div className="track"></div>
          </section>

          <section className="controls">
            <div className="control-head">
              <h2>跑步速度</h2>
              <span className="speed-value">
                <span>{speed}</span> km/h
              </span>
            </div>
            <input
              type="range"
              min={MIN_SPEED}
              max={MAX_SPEED}
              value={speed}
              step="1"
              aria-label="调整跑步速度"
              style={{ background: rangeBackground }}
              onChange={(event) => setSpeed(Number(event.target.value))}
            />
            <div className="range-labels">
              <span>慢跑</span>
              <span>冲刺</span>
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
            </div>
            <p className="timer">
              运动时间{" "}
              <strong>
                <span>{formatTime(elapsed)}</span>
              </strong>
            </p>
            <section
              className={report ? "report visible" : "report"}
              aria-live="polite"
            >
              <h2>CYBER RUN REPORT // 训练完成</h2>
              <div className="report-grid">
                <div className="report-item">
                  <span>运动时长</span>
                  <strong>{report ? report.time : "0 分钟"}</strong>
                </div>
                <div className="report-item">
                  <span>平均速度</span>
                  <strong>{report ? report.speed : "0 km/h"}</strong>
                </div>
                <div className="report-item">
                  <span>估算距离</span>
                  <strong>{report ? report.distance : "0 km"}</strong>
                </div>
                <div className="report-item">
                  <span>卡路里消耗</span>
                  <strong>{report ? report.calories : "0 kcal"}</strong>
                </div>
                <div className="report-item">
                  <span>平均心率</span>
                  <strong>{report ? report.heartRate : "0 bpm"}</strong>
                </div>
                <div className="report-item">
                  <span>平均配速</span>
                  <strong>{report ? report.pace : "0:00 /km"}</strong>
                </div>
              </div>
              <p className="report-note">
                {report
                  ? report.note
                  : "等待下一次任务上传。数据为运动模型估算。"}
              </p>
            </section>
          </section>
        </section>
      </main>
    </div>
  )
}
