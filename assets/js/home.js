document.addEventListener("DOMContentLoaded", function () {
  var groups = [
    {
      title: "数据",
      items: [
        {
          href: "/college/",
          title: "大学排行榜",
          description: "软科、校友会、武书连大学排行数据汇总。",
          type: "数据浏览",
        },
        {
          href: "/tourism/",
          title: "5A级旅游景区",
          description: "全国5A景区汇总。",
          type: "数据浏览",
        },
      ],
    },
    {
      title: "工具",
      items: [
        {
          href: "/photo/",
          title: "图片格式转换工具",
          description: "批量把图片转成 JPG / PNG / WebP，可打包成 ZIP 下载。",
          type: "转换工具",
        },
        {
          href: "/dcf/",
          title: "DCF 计算器",
          description: "使用 DCF 模型对企业进行估值。",
          type: "分析工具",
        },
        {
          href: "/rent/",
          title: "租金计算器",
          description: "计算投资房屋出租收益。",
          type: "分析工具",
        },
        {
          href: "/sport/",
          title: "赛博运动",
          description: "调整跑步速度，生成赛博跑步报告。",
          type: "实验工具",
        },
      ],
    },
  ]
  var container = document.querySelector("[data-home-blocks]")
  groups.forEach(function (group) {
    var section = document.createElement("section")
    section.className = "block"
    section.innerHTML =
      '<h2 class="block-title">' +
      group.title +
      '</h2><div class="card-grid">' +
      group.items
        .map(function (item) {
          return (
            '<a class="link-card" href="' +
            item.href +
            '"><div class="link-card-meta"><span>' +
            item.type +
            '</span><span class="link-card-arrow" aria-hidden="true">→</span></div><h3>' +
            item.title +
            "</h3><p>" +
            item.description +
            "</p></a>"
          )
        })
        .join("") +
      "</div>"
    container.appendChild(section)
  })
})
