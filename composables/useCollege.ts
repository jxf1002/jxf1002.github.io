import jsonData2023 from "@/assets/data/colleges2023.json"
import jsonData2024 from "@/assets/data/colleges2024.json"

export default function (year: number) {
  type College = {
    id: number
    name: string
    chinaxy: number
    ranking: number
    wurank: number
    avg: number
  }

  type SortableCollege = {
    id: number
    chinaxy: number
    ranking: number
    wurank: number
  }

  const columns = [
    { key: "id", label: "排名", class: "text-center" },
    { key: "name", label: "学校名称", class: "text-center" },
    { key: "chinaxy", label: "校友会", class: "text-center", sortable: true },
    { key: "ranking", label: "软科", class: "text-center", sortable: true },
    { key: "wurank", label: "武书连", class: "text-center", sortable: true },
    { key: "avg", label: "排名平均值", class: "text-center" },
  ]

  const mobileColumns = [
    { key: "id", label: "排名", class: "text-center whitespace-nowrap" },
    { key: "name", label: "学校名称", class: "text-center whitespace-nowrap" },
    { key: "avg", label: "排名平均值", class: "text-center whitespace-nowrap" },
  ]
  // 从json文件中加载数据
  let jsonData: College[] = []
  if (year === 2023) {
    jsonData = jsonData2023 as College[]
  } else if (year === 2024) {
    jsonData = jsonData2024 as College[]
  }
  const rawData = ref(jsonData)
  // 排序功能
  function sort(params: {
    column: keyof SortableCollege
    direction: "asc" | "desc"
  }) {
    let { column, direction } = params
    if (!column) {
      column = "id"
    }
    rawData.value.sort((a, b) => {
      if (direction === "asc") {
        if (a[column] === undefined) return 1
        if (b[column] === undefined) return -1
        return a[column] - b[column]
      } else {
        if (a[column] === undefined) return -1
        if (b[column] === undefined) return 1
        return b[column] - a[column]
      }
    })
  }
  // 搜索功能
  const q = ref("")
  watch(q, () => {
    page.value = 1
  })
  const colleges = computed(() => {
    return rawData.value.filter((college) => {
      return college.name.includes(q.value)
    })
  })
  // 分页功能
  const page = ref(1)
  const pageCount = ref(10)
  const rows = computed(() => {
    return colleges.value.slice(
      (page.value - 1) * pageCount.value,
      page.value * pageCount.value
    )
  })
  const total = computed(() => {
    return colleges.value.length
  })

  return { q, columns, mobileColumns, rows, page, pageCount, total, sort }
}
