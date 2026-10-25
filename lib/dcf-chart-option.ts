// DCF 图表配置：纯函数，不 import echarts，组件和测试都能直接引用
import type { DcfResult } from "./dcf.ts"
import type { EChartsCoreOption } from "echarts/core"

export type DcfChartColors = {
  primary: string
  primaryFill: string
  accent: string
  accentFill: string
  text: string
  grid: string
}

export function optionFor(
  shown: DcfResult,
  colors: DcfChartColors,
): EChartsCoreOption {
  const money = (value: unknown) => {
    const n = Number(value)
    return Number.isFinite(n) ? n.toFixed(2) + " 亿元" : "—"
  }
  // 永续期比明示期大一个数量级，同轴会把前几年压成一条线；
  // 永续价值在上方卡片和明细表都有，趋势图只画明示期
  const forecast = <T>(values: T[]) =>
    values.length > 1 ? values.slice(0, -1) : values
  return {
    animation: false,
    grid: { left: 4, right: 12, top: 44, bottom: 4 },
    legend: {
      top: 0,
      left: "center",
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 20,
      textStyle: { color: colors.text, fontSize: 13 },
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      valueFormatter: money,
    },
    xAxis: {
      type: "category",
      data: forecast(shown.chartLabels),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: colors.grid } },
      axisLabel: { color: colors.text, fontSize: 11 },
    },
    yAxis: {
      type: "value",
      axisLabel: {
        color: colors.text,
        fontSize: 11,
        formatter: (value: number) => value.toFixed(0) + " 亿元",
      },
      splitLine: { lineStyle: { color: colors.grid } },
    },
    series: [
      {
        name: "现金流",
        type: "bar",
        data: forecast(shown.chartCF),
        barMaxWidth: 36,
        itemStyle: {
          color: colors.primaryFill,
          borderColor: colors.primary,
          borderWidth: 1.5,
          borderRadius: [4, 4, 0, 0],
        },
      },
      {
        name: "折现值",
        type: "line",
        data: forecast(shown.chartPV),
        smooth: 0.25,
        symbolSize: 7,
        lineStyle: { color: colors.accent, width: 3 },
        itemStyle: {
          color: colors.accent,
          borderColor: colors.text,
          borderWidth: 2,
        },
        areaStyle: { color: colors.accentFill },
      },
    ],
  }
}
