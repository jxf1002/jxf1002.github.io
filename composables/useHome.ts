export default function () {
  const dataTypes = [
    {
      id: 1,
      route: "/college/2024/",
      title: "大学排行榜",
      description: "2023年软科、校友会、武书连大学排行数据汇总。",
    },
    {
      id: 2,
      route: "/tourism/",
      title: "5A级旅游景区",
      description: "全国5A景区汇总。",
    },
  ]
  const toolTypes = [
    {
      id: 1,
      route: "/dcf.html",
      title: "DCF 计算器",
      description: "使用 DCF 模型对企业进行估值。",
    },
    {
      id: 2,
      route: "/rent.html",
      title: "租金计算器",
      description: "计算投资房屋出租收益。",
    },
  ]

  return { dataTypes, toolTypes }
}
