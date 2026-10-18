import type { SortDirection } from "./list.ts"

export const AVAILABLE_YEARS = ["2023", "2024", "2025", "2026"] as const

export type CollegeYear = (typeof AVAILABLE_YEARS)[number]

export const DEFAULT_YEAR: CollegeYear = "2026"

export type CollegeRow = {
  id: number
  name: string
  avg: number
  province_abbr?: string
  chinaxy?: number | null
  ranking?: number | null
  wurank?: number | null
}

// 省份相关的纯函数只用到这几个字段
export type CollegeAvgRow = {
  id: number
  avg: number
  province_abbr?: string
}

export type ProvinceStat = {
  province: string
  count: number
  average: number
  rank: number
}

export function isCollegeYear(value: string | null): value is CollegeYear {
  return value != null && (AVAILABLE_YEARS as readonly string[]).includes(value)
}

const PROVINCE_NAMES: Record<string, string> = {
  京: "北京市",
  津: "天津市",
  沪: "上海市",
  渝: "重庆市",
  冀: "河北省",
  晋: "山西省",
  辽: "辽宁省",
  吉: "吉林省",
  黑: "黑龙江省",
  苏: "江苏省",
  浙: "浙江省",
  皖: "安徽省",
  闽: "福建省",
  赣: "江西省",
  鲁: "山东省",
  豫: "河南省",
  鄂: "湖北省",
  湘: "湖南省",
  粤: "广东省",
  桂: "广西壮族自治区",
  琼: "海南省",
  川: "四川省",
  贵: "贵州省",
  云: "云南省",
  藏: "西藏自治区",
  陕: "陕西省",
  甘: "甘肃省",
  青: "青海省",
  宁: "宁夏回族自治区",
  新: "新疆维吾尔自治区",
  蒙: "内蒙古自治区",
  港: "香港特别行政区",
  澳: "澳门特别行政区",
  台: "台湾省",
}

export function provinceLabel(abbr: string): string {
  return (PROVINCE_NAMES[abbr] || abbr) + "（" + abbr + "）"
}

export function provinceOptions(rows: CollegeAvgRow[]): string[] {
  return Array.from(
    new Set(
      rows
        .map((row) => row.province_abbr)
        .filter((abbr): abbr is string => Boolean(abbr)),
    ),
  ).sort((a, b) => a.localeCompare(b, "zh-CN"))
}

// 省内排名：按数据顺序在每个省里递增
export function provinceRanks(rows: CollegeAvgRow[]): Record<number, number> {
  const counts: Record<string, number> = {}
  const ranks: Record<number, number> = {}
  rows.forEach((row) => {
    if (!row.province_abbr) return
    counts[row.province_abbr] = (counts[row.province_abbr] || 0) + 1
    ranks[row.id] = counts[row.province_abbr]
  })
  return ranks
}

// 平均值并列时名次取最小的 id
export function rankByAverage(rows: CollegeAvgRow[]): Record<number, number> {
  const best: Record<number, number> = {}
  rows.forEach((row) => {
    if (best[row.avg] === undefined || row.id < best[row.avg]) {
      best[row.avg] = row.id
    }
  })
  return best
}

export function provinceStats(
  rows: CollegeAvgRow[],
  sortKey: string,
  direction: SortDirection,
): ProvinceStat[] {
  const groups: Record<string, CollegeAvgRow[]> = {}
  rows.forEach((row) => {
    if (!row.province_abbr) return
    if (!groups[row.province_abbr]) groups[row.province_abbr] = []
    groups[row.province_abbr].push(row)
  })

  const stats = Object.keys(groups).map((province) => {
    const group = groups[province]
    const total = group.reduce((sum, row) => sum + row.avg, 0)
    return {
      province,
      count: group.length,
      average: total / group.length,
      rank: 0,
    }
  })

  const byAverage = (a: ProvinceStat, b: ProvinceStat) =>
    a.average - b.average || a.province.localeCompare(b.province, "zh-CN")

  // 名次按平均分排，之后再按数量排序时名次不变
  stats
    .slice()
    .sort(byAverage)
    .forEach((item, index) => {
      item.rank = index + 1
    })

  if (sortKey !== "count") return stats.sort(byAverage)

  const sign = direction === "asc" ? 1 : -1
  return stats.sort((a, b) => (a.count - b.count) * sign || byAverage(a, b))
}
