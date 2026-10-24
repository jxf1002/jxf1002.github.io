// 汽车品牌销量：把按月 JSON 累加成年榜，同比对比上年同区间

export type BrandSalesRow = {
  rank: number
  id: number
  name: string
  country: string
  sales: number
  share: number | null
}

export type MonthSales = {
  month: string
  total: number
  source: string
  fetchedAt: string
  rows: BrandSalesRow[]
}

export type BrandTotal = {
  name: string
  country: string
  sales: number
  yoy: number | null
}

export type CarSalesYear = "2025" | "2026"

export const YEARS: CarSalesYear[] = ["2026", "2025"]

export const DEFAULT_YEAR: CarSalesYear = "2026"

export function isCarSalesYear(value: string | null): value is CarSalesYear {
  return value != null && (YEARS as string[]).includes(value)
}

// 该年已发布的最后一个月（1-12），没有数据返回 0
export function lastMonth(months: MonthSales[], year: string): number {
  const found = months
    .filter((item) => item.month.startsWith(year + "-"))
    .map((item) => Number(item.month.slice(5)))
  return found.length ? Math.max(...found) : 0
}

function sumBrands(months: MonthSales[], year: string, through: number) {
  const totals = new Map<string, { country: string; sales: number }>()
  for (const item of months) {
    if (!item.month.startsWith(year + "-")) continue
    if (Number(item.month.slice(5)) > through) continue
    for (const row of item.rows) {
      const current = totals.get(row.name)
      totals.set(row.name, {
        country: row.country,
        sales: (current?.sales ?? 0) + row.sales,
      })
    }
  }
  return totals
}

// year 年 1..through 月品牌合计降序；compareYear 没有同期数据时同比为 null
export function rankBrands(
  months: MonthSales[],
  year: string,
  through: number,
  compareYear?: string,
): BrandTotal[] {
  const current = sumBrands(months, year, through)
  const previous = compareYear ? sumBrands(months, compareYear, through) : null
  return [...current.entries()]
    .map(([name, { country, sales }]) => {
      const base = previous?.get(name)?.sales ?? 0
      return {
        name,
        country,
        sales,
        yoy: base > 0 ? ((sales - base) / base) * 100 : null,
      }
    })
    .sort((a, b) => b.sales - a.sales || a.name.localeCompare(b.name, "zh-CN"))
}

export function formatYoy(yoy: number | null): string {
  if (yoy == null) return "-"
  return `${yoy >= 0 ? "+" : ""}${yoy.toFixed(1)}%`
}
