// 构建产物自检：node scripts/check-build.ts（先跑 npm run build）
import { existsSync, readFileSync } from "node:fs"

let failed = 0

function check(name: string, condition: boolean): void {
  if (condition) return
  failed += 1
  console.log("  ✗", name)
}

function html(path: string): string {
  return readFileSync(new URL("../out/" + path, import.meta.url), "utf8")
}

function has(path: string): boolean {
  return existsSync(new URL("../out/" + path, import.meta.url))
}

// 每个路由的 title / canonical / 统计脚本
const ROUTES: Array<[string, string, string, boolean]> = [
  [
    "index.html",
    "贾师傅的小站｜实用数据与工具",
    "https://www.justful.cn/",
    true,
  ],
  [
    "college/index.html",
    "大学排行榜-数据-贾师傅的小站",
    "https://www.justful.cn/college/",
    true,
  ],
  [
    "tourism/index.html",
    "5A级旅游景区-数据-贾师傅的小站",
    "https://www.justful.cn/tourism/",
    true,
  ],
  [
    "cars/index.html",
    "汽车品牌销量-数据-贾师傅的小站",
    "https://www.justful.cn/cars/",
    true,
  ],
  [
    "comfort/index.html",
    "全国体感温度-数据-贾师傅的小站",
    "https://www.justful.cn/comfort/",
    true,
  ],
  [
    "dcf/index.html",
    "DCF 企业估值计算器｜贾师傅的小站",
    "https://www.justful.cn/dcf/",
    true,
  ],
  [
    "photo/index.html",
    "图片格式转换｜贾师傅的小站",
    "https://www.justful.cn/photo/",
    false,
  ],
  [
    "sport/index.html",
    "运动练习｜跑步·骑行·游泳·跳绳",
    "https://www.justful.cn/sport/",
    true,
  ],
  [
    "mahjong/index.html",
    "麻将小游戏｜贾师傅的小站",
    "https://www.justful.cn/mahjong/",
    false,
  ],
  [
    "mir2/index.html",
    "传奇挂机小游戏｜贾师傅的小站",
    "https://www.justful.cn/mir2/",
    false,
  ],
  [
    "guess/index.html",
    "猜数字小游戏｜贾师傅的小站",
    "https://www.justful.cn/guess/",
    true,
  ],
  [
    "five-cards/index.html",
    "五张牌魔术小游戏｜贾师傅的小站",
    "https://www.justful.cn/five-cards/",
    true,
  ],
  [
    "calendar/index.html",
    "日历拼图小游戏｜贾师傅的小站",
    "https://www.justful.cn/calendar/",
    true,
  ],
]

console.log("== 静态导出的页面 ==")
for (const [file, title, canonical, hasJsonLd] of ROUTES) {
  check(`${file} 存在`, has(file))
  if (!has(file)) continue
  const source = html(file)
  check(`${file} title`, source.includes(`<title>${title}</title>`))
  check(
    `${file} canonical`,
    source.includes(`rel="canonical" href="${canonical}"`),
  )
  check(
    `${file} og:url`,
    source.includes(`property="og:url" content="${canonical}"`),
  )
  check(
    `${file} 百度统计`,
    source.includes("hm.baidu.com/hm.js?682c23240d8faa05b0298eb23862358e"),
  )
  check(`${file} viewport`, source.includes('name="viewport"'))
  if (hasJsonLd) {
    check(`${file} ld+json`, source.includes('type="application/ld+json"'))
  }
}

console.log("== 静态资源与游戏页 ==")
for (const file of [
  "sitemap.xml",
  "robots.txt",
  "favicon.svg",
  "data/college/colleges2026.json",
  "data/tourism/tourism.json",
  "data/car-sales/index.json",
  "data/car-sales/2026-09.json",
  "images/banner.svg",
  "mahjong/style.css",
  "mahjong/svg/1m.svg",
  "mir2/style.css",
  "mir2/data/levels.json",
]) {
  check(`${file} 存在`, has(file))
}

console.log("== 品牌销量数据 ==")
const salesDir = new URL("../out/data/car-sales/", import.meta.url)
const salesIndex: { months: string[] } = JSON.parse(
  readFileSync(new URL("index.json", salesDir), "utf8"),
)
check(
  "car-sales 月份升序",
  salesIndex.months.every((m, i) => i === 0 || m > salesIndex.months[i - 1]),
)
for (const month of salesIndex.months) {
  const data = JSON.parse(
    readFileSync(new URL(`${month}.json`, salesDir), "utf8"),
  )
  const sum = data.rows.reduce(
    (n: number, row: { sales: number }) => n + row.sales,
    0,
  )
  check(`${month} 品牌销量合计`, data.month === month && sum === data.total)
}

for (const suit of ["s", "h", "d", "c"]) {
  for (let rank = 1; rank <= 13; rank += 1) {
    const file = `cards/${suit}${rank}.svg`
    check(`${file} 存在`, has(file))
  }
}
check("cards/back.svg 存在", has("cards/back.svg"))

// site.css 由两个 root layout 引入，已经打进 Next 的 CSS chunk；两个游戏的样式仍手写 <link>，
// 必须排在所有 Next CSS 之后，浅色主题下牌桌的 :root 变量才能压过站点变量
function cssHrefs(file: string): string[] {
  return [...html(file).matchAll(/<link[^>]*>/g)]
    .map((m) => m[0])
    .filter((tag) => tag.includes('rel="stylesheet"'))
    .map((tag) => /href="([^"]+)"/.exec(tag)?.[1] ?? "")
}

// site.css 没有独立 URL，按内容里的 .site-page 找到它所在的 chunk
function siteCssIndex(hrefs: string[]): number {
  return hrefs.findIndex((href) => {
    if (!href.startsWith("/_next/")) return false
    return readFileSync(new URL("../out" + href, import.meta.url), "utf8").includes(
      ".site-page",
    )
  })
}

function styleOrder(file: string, afterSite: string[]): boolean {
  const hrefs = cssHrefs(file)
  const site = siteCssIndex(hrefs)
  if (site < 0) return false
  // 游戏 link 带 ?v=N，按前缀匹配
  const rest = afterSite.map((url) =>
    hrefs.findIndex((href) => href === url || href.startsWith(url + "?")),
  )
  return rest.every((at, i) => at > site && (i === 0 || at > rest[i - 1]))
}
check("首页加载 site.css", siteCssIndex(cssHrefs("index.html")) >= 0)
check(
  "麻将页样式顺序 site.css → driver.css → style.css",
  styleOrder("mahjong/index.html", [
    "/mahjong/vendor/driver.css",
    "/mahjong/style.css",
  ]),
)
check(
  "mir2 页样式顺序 site.css → style.css",
  styleOrder("mir2/index.html", ["/mir2/style.css"]),
)
for (const file of ["mahjong/index.html", "mir2/index.html"]) {
  check(
    `${file} 保留百度统计`,
    html(file).includes("hm.baidu.com/hm.js?682c23240d8faa05b0298eb23862358e"),
  )
}

// footer 只有一种尺寸；markup 全站唯一、内容逐字一致
console.log("== footer 归一化 ==")
const FOOTER = /<footer class="site-footer">[\s\S]*?<\/footer>/
const footers = ROUTES.map(([file]) => {
  const source = html(file)
  const match = source.match(FOOTER)
  const count = source.match(/<footer class="site-footer">/g)?.length ?? 0
  check(`${file} 有且只有一个 footer`, count === 1 && !!match)
  return match?.[0] ?? ""
})
check("各页 footer 内容完全一致", new Set(footers).size === 1)
for (const text of [
  "京ICP备18007833号-1",
  "www.justful.cn",
  "github.com/jxf1002/jxf1002.github.io",
]) {
  check(`footer 含 ${text}`, footers[0].includes(text))
}
for (const [file] of ROUTES) {
  check(`${file} 不再使用 data-fullscreen`, !html(file).includes("data-fullscreen"))
}

if (failed) {
  console.log(`\n失败 ${failed} 项`)
  process.exit(1)
}
console.log("\n全部通过")
