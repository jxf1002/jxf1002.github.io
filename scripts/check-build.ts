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
  "assets/css/site.css",
  "assets/data/colleges2026.json",
  "assets/data/tourism.json",
  "images/banner.svg",
  "mahjong/style.css",
  "mahjong/svg/1m.svg",
  "mir2/style.css",
  "mir2/data/levels.json",
]) {
  check(`${file} 存在`, has(file))
}

// 两个游戏页的样式都手写在页面里：必须排在 site.css 之后，浅色主题下牌桌的 :root 变量才能压过站点变量
function styleOrder(file: string, urls: string[]): boolean {
  const source = html(file)
  const at = urls.map((u) => source.indexOf(u))
  return at.every((v, i) => v >= 0 && (i === 0 || v > at[i - 1]))
}
check(
  "麻将页样式顺序 site.css → driver.css → style.css",
  styleOrder("mahjong/index.html", [
    "/assets/css/site.css",
    "/mahjong/vendor/driver.css",
    "/mahjong/style.css",
  ]),
)
check(
  "mir2 页样式顺序 site.css → style.css",
  styleOrder("mir2/index.html", ["/assets/css/site.css", "/mir2/style.css"]),
)
for (const file of ["mahjong/index.html", "mir2/index.html"]) {
  check(
    `${file} 保留百度统计`,
    html(file).includes("hm.baidu.com/hm.js?682c23240d8faa05b0298eb23862358e"),
  )
}

if (failed) {
  console.log(`\n失败 ${failed} 项`)
  process.exit(1)
}
console.log("\n全部通过")
