document.addEventListener("DOMContentLoaded", function () {
  var groups = [
    {
      title: "数据",
      items: [
        {
          href: "/college/2024/",
          title: "大学排行榜",
          description: "2023年软科、校友会、武书连大学排行数据汇总。",
        },
        {
          href: "/tourism/",
          title: "5A级旅游景区",
          description: "全国5A景区汇总。",
        },
      ],
    },
    {
      title: "工具",
      items: [
        {
          href: "/dcf.html",
          title: "DCF 计算器",
          description: "使用 DCF 模型对企业进行估值。",
        },
        {
          href: "/rent.html",
          title: "租金计算器",
          description: "计算投资房屋出租收益。",
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
            '"><h3>' +
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
