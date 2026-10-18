// 列表筛选/排序/分页的共用纯函数：college、tourism、comfort 三个表格都用它
export type SortDirection = "asc" | "desc"

export type SortableRow = Record<string, string | number | null | undefined>

export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number,
): { total: number; totalPages: number; page: number; items: T[] } {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const current = Math.min(Math.max(1, page), totalPages)
  const start = (current - 1) * pageSize
  return {
    total: items.length,
    totalPages,
    page: current,
    items: items.slice(start, start + pageSize),
  }
}

export function sortRows<T extends SortableRow>(
  rows: T[],
  key: string,
  direction: SortDirection,
): T[] {
  if (!key) return rows
  const sign = direction === "asc" ? 1 : -1
  return rows.slice().sort((a, b) => {
    const aValue = a[key]
    const bValue = b[key]
    if (aValue == null) return 1
    if (bValue == null) return -1
    return (Number(aValue) - Number(bValue)) * sign
  })
}
