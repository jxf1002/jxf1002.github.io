export default function () {
  type College = {
    chinaxy: number
    ranking: number
    wurank: number
    avg: number
  }

  const columns = [
    // { key: "id", label: "ID", class: "text-center" },
    { key: "name", label: "学校名称", class: "text-center" },
    { key: "chinaxy", label: "校友会", class: "text-center", sortable: true },
    { key: "ranking", label: "软科", class: "text-center", sortable: true },
    { key: "wurank", label: "武书连", class: "text-center", sortable: true },
    { key: "avg", label: "平均排名", class: "text-center", sortable: true },
  ]
  const allColleges = [
    {
      id: 1,
      name: "清华大学",
      chinaxy: 1,
      ranking: 1,
      wurank: 1,
      avg: 1,
    },
    {
      id: 2,
      name: "北京大学",
      chinaxy: 2,
      ranking: 2,
      wurank: 2,
      avg: 2,
    },
  ]
  // 搜索功能
  const q = ref("")
  const colleges = computed(() => {
    return allColleges.filter((college) => {
      return college.name.includes(q.value)
    })
  })
  // 排序
  function sort(column: keyof College, direction: "asc" | "desc") {
    allColleges.sort((a, b) => {
      if (direction === "asc") {
        return a[column] - b[column]
      } else {
        return b[column] - a[column]
      }
    })
  }

  return { columns, colleges, q, sort }
}
