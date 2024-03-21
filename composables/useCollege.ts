import collegesJson from "@/assets/data/colleges.json"

export default function () {
  type College = {
    id: number
    name: string
    chinaxy: number
    ranking: number
    wurank: number
    avg: number
  }

  const columns = [
    { key: "id", label: "总排名", class: "text-center", sortable: true },
    { key: "name", label: "学校名称", class: "text-center", sortable: true },
    { key: "chinaxy", label: "校友会", class: "text-center", sortable: true },
    { key: "ranking", label: "软科", class: "text-center", sortable: true },
    { key: "wurank", label: "武书连", class: "text-center", sortable: true },
    { key: "avg", label: "排名平均值", class: "text-center", sortable: true },
  ]
  // 从json文件中加载数据
  const allColleges = collegesJson as College[]
  // 搜索功能
  const q = ref("")
  const colleges = computed(() => {
    return allColleges.filter((college) => {
      return college.name.includes(q.value)
    })
  })

  return { columns, colleges, q }
}
