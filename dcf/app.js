;(function () {
  "use strict"

  // ================================================================
  //  1. DOM 引用
  // ================================================================
  const $ = (id) => document.getElementById(id)

  const netProfitInput = $("netProfit")
  const growthYearsInput = $("growthYears")
  const growthRateInput = $("growthRate")
  const terminalRateInput = $("terminalRate")
  const discountRateInput = $("discountRate")

  const totalValueEl = $("totalValue")
  const totalValueSub = $("totalValueSub")
  const highGrowthValueEl = $("highGrowthValue")
  const highGrowthPctEl = $("highGrowthPct")
  const terminalValueEl = $("terminalValue")
  const terminalPctEl = $("terminalPct")

  const detailYearsEl = $("detailYears")
  const detailGrowthRateEl = $("detailGrowthRate")
  const detailTerminalRateEl = $("detailTerminalRate")

  const tableBody = $("tableBody")
  const tableCount = $("tableCount")

  // ================================================================
  //  2. Chart.js 初始化
  // ================================================================
  const ctx = document.getElementById("dcfChart").getContext("2d")
  let chart = null

  function chartTheme() {
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

  function applyChartTheme() {
    if (!chart) return
    const colors = chartTheme()
    chart.data.datasets[0].backgroundColor = colors.primaryFill
    chart.data.datasets[0].borderColor = colors.primary
    chart.data.datasets[1].borderColor = colors.accent
    chart.data.datasets[1].backgroundColor = colors.accentFill
    chart.data.datasets[1].pointBackgroundColor = colors.accent
    chart.data.datasets[1].pointBorderColor = colors.text
    chart.options.plugins.legend.labels.color = colors.text
    chart.options.scales.y.grid.color = colors.grid
    chart.options.scales.y.ticks.color = colors.text
    chart.options.scales.x.ticks.color = colors.text
    chart.update()
  }

  function initChart() {
    const colors = chartTheme()
    chart = new Chart(ctx, {
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
        interaction: {
          mode: "index",
          intersect: false,
        },
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
              label: function (context) {
                let label = context.dataset.label || ""
                let val = context.parsed.y
                if (val === undefined || !isFinite(val))
                  return label + ": —"
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
              callback: function (value) {
                return value.toFixed(0) + " 亿元"
              },
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
        elements: {
          bar: {
            backgroundColor: colors.primaryFill,
          },
        },
      },
    })
  }

  window.addEventListener("themechange", applyChartTheme)

  // ================================================================
  //  3. 核心计算逻辑
  // ================================================================
  function computeDCF() {
    const netProfit = parseFloat(netProfitInput.value)
    const growthYears = parseInt(growthYearsInput.value, 10)
    const growthRate = parseFloat(growthRateInput.value) / 100
    const terminalRate = parseFloat(terminalRateInput.value) / 100
    const discountRate = parseFloat(discountRateInput.value) / 100

    if (isNaN(netProfit) || netProfit <= 0) return
    if (isNaN(growthYears) || growthYears < 0) return
    if (isNaN(growthRate) || growthRate < 0) return
    if (isNaN(terminalRate) || terminalRate < 0) return
    if (isNaN(discountRate) || discountRate <= 0) return

    const years = growthYears
    const cashFlows = []
    const discountFactors = []
    const presentValues = []
    let cumulativePV = 0

    for (let i = 1; i <= years; i++) {
      const cf = netProfit * Math.pow(1 + growthRate, i)
      const df = 1 / Math.pow(1 + discountRate, i)
      const pv = cf * df
      cashFlows.push(cf)
      discountFactors.push(df)
      presentValues.push(pv)
      cumulativePV += pv
    }

    const lastCF = years > 0 ? cashFlows[cashFlows.length - 1] : netProfit
    const terminalDiscountFactor =
      years > 0 ? discountFactors[discountFactors.length - 1] : 1
    let terminalValue = 0
    let terminalPV = 0
    let terminalValid = true

    if (discountRate > terminalRate) {
      terminalValue =
        (lastCF * (1 + terminalRate)) / (discountRate - terminalRate)
      terminalPV = terminalValue * terminalDiscountFactor
    } else {
      terminalValid = false
      terminalValue = Infinity
      terminalPV = Infinity
    }

    const totalPV = cumulativePV + (terminalValid ? terminalPV : 0)

    const tableData = []
    for (let i = 0; i < years; i++) {
      tableData.push({
        year: i + 1,
        cf: cashFlows[i],
        df: discountFactors[i],
        pv: presentValues[i],
        cumPV: presentValues.slice(0, i + 1).reduce((a, b) => a + b, 0),
        isTerminal: false,
      })
    }

    tableData.push({
      year: "♾️ 永续期",
      cf: terminalValid ? terminalValue : Infinity,
      df: terminalDiscountFactor,
      pv: terminalValid ? terminalPV : Infinity,
      cumPV: terminalValid ? totalPV : Infinity,
      isTerminal: true,
    })

    if (isFinite(totalPV) && totalPV > 0) {
      totalValueEl.innerHTML =
        totalPV.toFixed(2) + ' <span class="currency">亿元</span>'
      totalValueSub.textContent =
        "折现率 " + (discountRate * 100).toFixed(1) + "%"
    } else {
      totalValueEl.innerHTML = '∞ <span class="currency">亿元</span>'
      totalValueSub.textContent = "⚠️ 折现率 ≤ 永续增长率，模型发散"
    }

    const highGrowthPV = cumulativePV
    const terminalPVdisplay = terminalValid ? terminalPV : Infinity

    if (isFinite(highGrowthPV)) {
      highGrowthValueEl.innerHTML =
        highGrowthPV.toFixed(2) + ' <span class="currency">亿元</span>'
    } else {
      highGrowthValueEl.innerHTML = '— <span class="currency">亿元</span>'
    }

    if (isFinite(terminalPVdisplay) && terminalPVdisplay > 0) {
      terminalValueEl.innerHTML =
        terminalPVdisplay.toFixed(2) + ' <span class="currency">亿元</span>'
    } else {
      terminalValueEl.innerHTML = '∞ <span class="currency">亿元</span>'
    }

    if (isFinite(totalPV) && totalPV > 0) {
      const pct1 = (highGrowthPV / totalPV) * 100
      const pct2 = (terminalPVdisplay / totalPV) * 100
      highGrowthPctEl.textContent = "占比 " + pct1.toFixed(1) + "%"
      terminalPctEl.textContent = "占比 " + pct2.toFixed(1) + "%"
    } else {
      highGrowthPctEl.textContent = "占比 —%"
      terminalPctEl.textContent = "占比 —%"
    }

    detailYearsEl.textContent = years + " 年"
    detailGrowthRateEl.textContent = (growthRate * 100).toFixed(1) + "%"
    detailTerminalRateEl.textContent = (terminalRate * 100).toFixed(1) + "%"

    const chartLabels = []
    const chartCF = []
    const chartPV = []

    for (let i = 0; i < years; i++) {
      chartLabels.push("第" + (i + 1) + "年")
      chartCF.push(cashFlows[i])
      chartPV.push(presentValues[i])
    }
    chartLabels.push("♾️ 永续期")
    chartCF.push(terminalValid ? terminalValue : 0)
    chartPV.push(terminalValid ? terminalPV : 0)

    if (chart) {
      chart.data.labels = chartLabels
      chart.data.datasets[0].data = chartCF
      chart.data.datasets[1].data = chartPV
      chart.update()
    }

    renderTable(tableData, totalPV)
    tableCount.textContent = "共 " + tableData.length + " 期"
  }

  // ================================================================
  //  4. 表格渲染
  // ================================================================
  function renderTable(data, totalPV) {
    let html = ""
    for (const row of data) {
      const isTerminal = row.isTerminal
      const yearLabel = isTerminal ? "♾️ 永续期" : "第" + row.year + "年"
      const cfVal = isFinite(row.cf) ? row.cf : Infinity
      const pvVal = isFinite(row.pv) ? row.pv : Infinity
      const cumVal = isFinite(row.cumPV) ? row.cumPV : Infinity

      const cfStr = isFinite(cfVal) ? cfVal.toFixed(2) : "∞"
      const dfStr = isFinite(row.df) ? row.df.toFixed(4) : "—"
      const pvStr = isFinite(pvVal) ? pvVal.toFixed(2) : "∞"
      const cumStr = isFinite(cumVal) ? cumVal.toFixed(2) : "∞"

      const cls = isTerminal ? ' class="highlight-row"' : ""
      html +=
        "<tr" +
        cls +
        "><td>" +
        yearLabel +
        "</td><td>" +
        cfStr +
        "</td><td>" +
        dfStr +
        "</td><td>" +
        pvStr +
        "</td><td>" +
        cumStr +
        "</td></tr>"
    }
    tableBody.innerHTML = html
  }

  // ================================================================
  //  5. 事件绑定 & 初始化
  // ================================================================
  const inputs = [
    netProfitInput,
    growthYearsInput,
    growthRateInput,
    terminalRateInput,
    discountRateInput,
  ]

  inputs.forEach(function (el) {
    el.addEventListener("input", computeDCF)
    el.addEventListener("change", computeDCF)
  })

  initChart()
  computeDCF()

  let resizeTimer
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(function () {
      if (chart) chart.resize()
    }, 200)
  })
})()
