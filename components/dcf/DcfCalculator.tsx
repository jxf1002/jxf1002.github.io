"use client"

import Chart from "chart.js/auto"
import type { ChartConfiguration } from "chart.js"
import { useEffect, useMemo, useRef, useState } from "react"
import Page from "../layout/Page"
import PageHeader from "../layout/PageHeader"
import type { DcfInputs, DcfResult } from "../../lib/dcf"
import { computeDcf } from "../../lib/dcf"

const DEFAULTS: DcfInputs = {
  netProfit: "10",
  growthYears: "5",
  growthRate: "15",
  terminalRate: "3",
  discountRate: "10",
}

type ChartColors = {
  primary: string
  primaryFill: string
  accent: string
  accentFill: string
  text: string
  grid: string
}

// 与旧 dcf/app.js 的配色保持一致，跟着主题切换
function chartTheme(): ChartColors {
  const dark = document.documentElement.classList.contains("dark")
  return dark
    ? {
        primary: "#63c5ad",
        primaryFill: "rgba(99, 197, 173, 0.72)",
        accent: "#f09a79",
        accentFill: "rgba(240, 154, 121, 0.14)",
        text: "#a1b8af",
        grid: "rgba(161, 184, 175, 0.16)",
      }
    : {
        primary: "#167c6b",
        primaryFill: "rgba(22, 124, 107, 0.72)",
        accent: "#e57b5d",
        accentFill: "rgba(229, 123, 93, 0.14)",
        text: "#657a72",
        grid: "rgba(101, 122, 114, 0.16)",
      }
}

function chartConfig(colors: ChartColors) {
  return {
    type: "bar",
    data: {
      labels: [],
      datasets: [
        {
          label: "现金流",
          data: [],
          backgroundColor: colors.primaryFill,
          borderColor: colors.primary,
          borderWidth: 1.5,
          borderRadius: 4,
          yAxisID: "y",
          order: 2,
        },
        {
          label: "折现值",
          data: [],
          type: "line",
          borderColor: colors.accent,
          backgroundColor: colors.accentFill,
          pointBackgroundColor: colors.accent,
          pointBorderColor: colors.text,
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
          borderWidth: 3,
          fill: true,
          tension: 0.25,
          yAxisID: "y",
          order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          display: true,
          labels: {
            usePointStyle: true,
            pointStyle: "circle",
            padding: 20,
            font: { size: 13, weight: "500" },
            color: colors.text,
          },
        },
        tooltip: {
          callbacks: {
            label: (context: { dataset: { label?: string }; parsed: { y?: number } }) => {
              const label = context.dataset.label || ""
              const val = context.parsed.y
              if (val === undefined || !isFinite(val)) return label + ": —"
              return label + ": " + val.toFixed(2) + " 亿元"
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: colors.grid },
          ticks: {
            callback: (value: number) => value.toFixed(0) + " 亿元",
            font: { size: 11 },
            color: colors.text,
          },
        },
        x: {
          grid: { display: false },
          ticks: {
            font: { size: 11, weight: "500" },
            color: colors.text,
            maxRotation: 30,
            autoSkip: true,
          },
        },
      },
      elements: { bar: { backgroundColor: colors.primaryFill } },
    },
  }
}

const fmt2 = (value: number) => (isFinite(value) ? value.toFixed(2) : "∞")
const fmt4 = (value: number) => (isFinite(value) ? value.toFixed(4) : "—")

export default function DcfCalculator() {
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const chart = useRef<Chart | null>(null)
  const [inputs, setInputs] = useState<DcfInputs>(DEFAULTS)
  const signature = Object.values(inputs).join("|")
  const result = useMemo(() => computeDcf(inputs), [signature])

  // 输入非法时保持上一次的结果，与旧实现一致（初值 DEFAULTS 一定合法）
  const [shown, setShown] = useState<DcfResult>(() => computeDcf(DEFAULTS) as DcfResult)
  useEffect(() => {
    if (result) setShown(result)
  }, [result])

  useEffect(() => {
    if (!canvas.current) return
    chart.current = new Chart(
      canvas.current,
      chartConfig(chartTheme()) as ChartConfiguration,
    )
    function onThemeChange() {
      const instance = chart.current as any
      if (!instance) return
      const colors = chartTheme()
      instance.data.datasets[0].backgroundColor = colors.primaryFill
      instance.data.datasets[0].borderColor = colors.primary
      instance.data.datasets[1].borderColor = colors.accent
      instance.data.datasets[1].backgroundColor = colors.accentFill
      instance.data.datasets[1].pointBackgroundColor = colors.accent
      instance.data.datasets[1].pointBorderColor = colors.text
      instance.options.plugins.legend.labels.color = colors.text
      instance.options.scales.y.grid.color = colors.grid
      instance.options.scales.y.ticks.color = colors.text
      instance.options.scales.x.ticks.color = colors.text
      instance.update()
    }
    window.addEventListener("themechange", onThemeChange)
    return () => {
      window.removeEventListener("themechange", onThemeChange)
      chart.current?.destroy()
      chart.current = null
    }
  }, [])

  useEffect(() => {
    const instance = chart.current
    if (!instance || !shown) return
    instance.data.labels = shown.chartLabels
    const datasets = instance.data.datasets as Array<{ data: number[] }>
    datasets[0].data = shown.chartCF
    datasets[1].data = shown.chartPV
    instance.update()
  }, [shown])

  const totalValid = isFinite(shown.totalPV) && shown.totalPV > 0
  const highGrowthPct = totalValid
    ? (shown.cumulativePV / shown.totalPV) * 100
    : null
  const terminalPct = totalValid
    ? (shown.terminalPV / shown.totalPV) * 100
    : null

  function set(name: keyof DcfInputs, value: string) {
    setInputs((prev) => ({ ...prev, [name]: value }))
  }

  const fields = [
    {
      name: "netProfit",
      label: "最近一期净利润",
      unit: "亿元",
      step: "0.1",
      min: "0.01",
      hint: "作为基期现金流",
    },
    {
      name: "growthYears",
      label: "高速增长年度",
      unit: "年",
      step: "1",
      min: "0",
      max: "30",
    },
    {
      name: "growthRate",
      label: "高速增长率",
      unit: "%",
      step: "1",
      min: "0.1",
      max: "100",
    },
    {
      name: "terminalRate",
      label: "永续增长率",
      unit: "%",
      step: "1",
      min: "0",
      max: "10",
      hint: "通常 < 折现率",
    },
    {
      name: "discountRate",
      label: "折现率",
      unit: "%",
      step: "1",
      min: "1",
      max: "30",
      hint: "WACC 或 必要收益率",
    },
  ]

  const input = (name: keyof DcfInputs) => {
    const field = fields.find((item) => item.name === name)
    if (!field) return null
    return (
      <div className="input-group" key={name}>
        <label>
          {field.label}
          <span className="unit">{field.unit}</span>
        </label>
        <input
          type="number"
          id={name}
          value={inputs[name]}
          step={field.step}
          min={field.min}
          max={field.max}
          onChange={(event) => set(name, event.target.value)}
        />
        {field.hint ? <div className="hint">{field.hint}</div> : null}
      </div>
    )
  }

  return (
    <Page>
      <PageHeader
        title="DCF 企业估值计算器"
        description="用现金流折现模型估算企业内在价值，所有参数都在浏览器本地计算。"
        actions={<span className="badge">现金流折现法</span>}
      />
      <div className="app-container dcf-app">

          <div className="main-grid">
            <section className="input-panel">
              <h2>
                <span>⚙️</span> 参数设置
              </h2>
              {input("netProfit")}
              <div className="input-row-duo">
                {input("growthYears")}
                {input("growthRate")}
              </div>
              <div className="input-row-duo">
                {input("terminalRate")}
                {input("discountRate")}
              </div>
              <div
                style={{
                  marginTop: "6px",
                  fontSize: "12px",
                  color: "#94a3b8",
                  textAlign: "right",
                }}
              >
                💡 调整参数后自动更新
              </div>
            </section>

            <section className="result-panel">
              <div className="result-cards">
                <div className="result-card highlight">
                  <div className="label">🏢 企业估值</div>
                  <div className="value" id="totalValue">
                    {totalValid ? `${shown.totalPV.toFixed(2)} ` : "∞ "}
                    <span className="currency">亿元</span>
                  </div>
                  <div className="sub" id="totalValueSub">
                    {totalValid
                      ? "折现率 " + (shown.discountRate * 100).toFixed(1) + "%"
                      : "⚠️ 折现率 ≤ 永续增长率，模型发散"}
                  </div>
                </div>
                <div className="result-card">
                  <div className="label">📈 高速增长期价值</div>
                  <div className="value" id="highGrowthValue">
                    {isFinite(shown.cumulativePV)
                      ? `${shown.cumulativePV.toFixed(2)} `
                      : "— "}
                    <span className="currency">亿元</span>
                  </div>
                  <div className="sub" id="highGrowthPct">
                    {highGrowthPct == null
                      ? "占比 —%"
                      : `占比 ${highGrowthPct.toFixed(1)}%`}
                  </div>
                </div>
                <div className="result-card">
                  <div className="label">♾️ 永续期价值</div>
                  <div className="value" id="terminalValue">
                    {isFinite(shown.terminalPV) && shown.terminalPV > 0
                      ? `${shown.terminalPV.toFixed(2)} `
                      : "∞ "}
                    <span className="currency">亿元</span>
                  </div>
                  <div className="sub" id="terminalPct">
                    {terminalPct == null
                      ? "占比 —%"
                      : `占比 ${terminalPct.toFixed(1)}%`}
                  </div>
                </div>
              </div>

              <div className="result-detail-row">
                <div className="result-detail-item">
                  <span className="label">📅 高速增长期</span>
                  <span className="value" id="detailYears">
                    {shown.years} 年
                  </span>
                </div>
                <div className="result-detail-item">
                  <span className="label">📈 高速增长率</span>
                  <span className="value" id="detailGrowthRate">
                    {(shown.growthRate * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="result-detail-item">
                  <span className="label">♾️ 永续增长率</span>
                  <span className="value" id="detailTerminalRate">
                    {(shown.terminalRate * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </section>
          </div>

          <section className="chart-section">
            <div className="chart-header">
              <h3>📉 现金流 &amp; 折现值趋势</h3>
              <span className="legend-tip">
                柱状图 · 现金流 &nbsp;|&nbsp; 折线图 · 折现值
              </span>
            </div>
            <div className="chart-wrapper">
              <canvas ref={canvas} id="dcfChart" />
            </div>
          </section>

          <section className="table-section">
            <div className="table-header">
              <h3>📋 逐年明细数据</h3>
              <span className="count" id="tableCount">
                共 {shown.tableData.length} 期
              </span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>年份</th>
                    <th>现金流 (亿元)</th>
                    <th>折现因子</th>
                    <th>折现值 (亿元)</th>
                    <th>累计折现值 (亿元)</th>
                  </tr>
                </thead>
                <tbody id="tableBody">
                  {shown.tableData.map((row) => (
                    <tr
                      className={row.isTerminal ? "highlight-row" : undefined}
                      key={String(row.year)}
                    >
                      <td>
                        {row.isTerminal ? "♾️ 永续期" : "第" + row.year + "年"}
                      </td>
                      <td>{fmt2(row.cf)}</td>
                      <td>{fmt4(row.df)}</td>
                      <td>{fmt2(row.pv)}</td>
                      <td>{fmt2(row.cumPV)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
    </Page>
  )
}
