import jsonData from "@/assets/data/tourism.json"

export default function () {
  type Tourism = {
    id: number
    name: string
    provinceCode: string
    provinceName: string
    gradesName: string
    year: string
  }

  const columns = [
    { key: "name", label: "景区名称", class: "text-center" },
    { key: "provinceName", label: "地区", class: "text-center" },
    { key: "gradesName", label: "级别", class: "text-center" },
    { key: "year", label: "评定年份", class: "text-center" },
  ]

  const mobileColumns = [
    { key: "name", label: "景区名称", class: "text-center" },
    { key: "provinceName", label: "地区", class: "text-center" },
  ]
  // 从json文件中加载数据
  const rawData = jsonData as Tourism[]
  // 生成省级列表
  const provinces = Array.from(
    new Set(rawData.map((item) => item.provinceName))
  )
  provinces.unshift("全部")
  // 搜索功能
  const q = ref("")
  const p = ref("")
  const data = computed(() => {
    return rawData.filter((item) => {
      const p2 = p.value === "全部" ? "" : p.value
      return item.name.includes(q.value) && item.provinceName.includes(p2)
    })
  })
  // p,q变化时，重置分页
  watch([q, p], () => {
    page.value = 1
  })
  // 分页功能
  const page = ref(1)
  const pageCount = ref(10)
  const rows = computed(() => {
    return data.value.slice(
      (page.value - 1) * pageCount.value,
      page.value * pageCount.value
    )
  })
  const total = computed(() => {
    return data.value.length
  })

  return {
    columns,
    mobileColumns,
    rows,
    q,
    p,
    provinces,
    page,
    pageCount,
    total,
  }
}
