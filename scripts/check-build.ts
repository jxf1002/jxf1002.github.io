// 构建产物自检：node scripts/check-build.ts（先跑 npm run build）
import { existsSync, readFileSync, readdirSync } from "node:fs"
import type { MonthSales } from "../lib/car-sales.ts"
import { AVAILABLE_YEARS } from "../lib/college.ts"
import { PAGES, SITE } from "../lib/site.ts"

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

function json<T>(path: string): T {
  return JSON.parse(html(path)) as T
}

// 路由事实只认 lib/site.ts，标题/canonical 不再手抄一份
const ROUTES = Object.values(PAGES).map((page) => ({
  file: page.path === "/" ? "index.html" : page.path.slice(1) + "index.html",
  title: page.title,
  canonical: SITE.url + page.path,
  jsonLd: !!page.jsonLd,
}))

console.log("== 静态导出的页面 ==")
for (const { file, title, canonical, jsonLd } of ROUTES) {
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
  if (jsonLd) {
    check(`${file} ld+json`, source.includes('type="application/ld+json"'))
  }
}

console.log("== sitemap ==")
const locs = [...html("sitemap.xml").matchAll(/<loc>([^<]*)<\/loc>/g)].map(
  (match) => match[1],
)
const canonicals = ROUTES.map((route) => route.canonical)
check(
  "sitemap 覆盖全部路由",
  canonicals.every((url) => locs.includes(url)),
)
check(
  "sitemap 没有多余路由",
  locs.every((url) => canonicals.includes(url)),
)
check("sitemap 无重复", new Set(locs).size === locs.length)

console.log("== 首页导航 ==")
// 卡片文案取自 lib/site.ts；这里只保证每个路由在首页都有入口
const home = html("index.html")
for (const page of Object.values(PAGES)) {
  if (page.path === "/") continue
  check(`首页链接 ${page.path}`, home.includes(`href="${page.path}"`))
}

console.log("== 数据页内联 ==")// 数据页首屏必须是构建期渲染出来的，不能退回客户端 fetch（否则爬虫只看到“正在加载”）
for (const [file, text] of [
  ["college/index.html", "清华大学"],
  ["tourism/index.html", "故宫博物院"],
  ["cars/index.html", "比亚迪"],
]) {
  check(`${file} 首屏含数据（${text}）`, html(file).includes(text))
}

console.log("== 静态资源与游戏页 ==")
for (const file of [
  "robots.txt",
  "favicon.svg",
  "images/banner.svg",
  "data/china-cities.json",
  "cards/README.md",
  "cards/LICENSE-faces.txt",
  "cards/LICENSE-back.txt",
  "mahjong/style.css",
  "mahjong/svg/1m.svg",
  "mir2/style.css",
  "mir2/data/levels.json",
]) {
  check(`${file} 存在`, has(file))
}

console.log("== 数据文件 ==")
const collegeDir = new URL("../out/data/college/", import.meta.url)
const collegeFiles = readdirSync(collegeDir)
  .filter((file) => file.endsWith(".json"))
  .sort()
check(
  "college 年份文件与 AVAILABLE_YEARS 一致",
  collegeFiles.join() ===
    AVAILABLE_YEARS.map((year) => `colleges${year}.json`)
      .sort()
      .join(),
)
for (const year of AVAILABLE_YEARS) {
  if (!has(`data/college/colleges${year}.json`)) continue
  const rows = json<Array<{ id?: number; name?: string; avg?: number }>>(
    `data/college/colleges${year}.json`,
  )
  check(`college ${year} 非空`, rows.length > 0)
  check(
    `college ${year} 字段完整`,
    rows.every(
      (row) =>
        typeof row.id === "number" &&
        typeof row.name === "string" &&
        row.name.length > 0 &&
        Number.isFinite(row.avg),
    ),
  )
}

const tourism = json<
  Array<{
    name?: string
    provinceName?: string
    gradesName?: string
    year?: string
  }>
>("data/tourism/tourism.json")
check("tourism 非空", tourism.length > 0)
check(
  "tourism 字段完整",
  tourism.every(
    (row) => !!row.name && !!row.provinceName && !!row.gradesName && !!row.year,
  ),
)

console.log("== 品牌销量数据 ==")
const salesDir = new URL("../out/data/car-sales/", import.meta.url)
const salesIndex = json<{ months: string[] }>("data/car-sales/index.json")
check(
  "car-sales 月份升序",
  salesIndex.months.every((m, i) => i === 0 || m > salesIndex.months[i - 1]),
)
const salesFiles = readdirSync(salesDir)
  .filter((file) => /^\d{4}-\d{2}\.json$/.test(file))
  .map((file) => file.slice(0, -5))
  .sort()
check(
  "car-sales 月文件与 index 一致",
  salesFiles.join() === [...salesIndex.months].sort().join(),
)

const monthly = new Map<string, MonthSales>()
for (const month of salesIndex.months) {
  const data = json<MonthSales>(`data/car-sales/${month}.json`)
  monthly.set(month, data)
  const sum = data.rows.reduce((n, row) => n + row.sales, 0)
  check(
    `${month} 品牌销量合计`,
    data.month === month && data.rows.length > 0 && sum === data.total,
  )
  check(
    `${month} 行字段完整`,
    data.rows.every(
      (row) =>
        typeof row.name === "string" &&
        row.name.length > 0 &&
        Number.isFinite(row.rank) &&
        Number.isFinite(row.sales),
    ),
  )
}

// 年文件由 npm run data:cars 生成；忘了重跑就会在这里失败，避免线上数据停在旧月份
const years = [...new Set(salesIndex.months.map((m) => m.slice(0, 4)))].sort()
const yearFiles = readdirSync(salesDir)
  .filter((file) => /^\d{4}\.json$/.test(file))
  .map((file) => file.slice(0, -5))
  .sort()
check("car-sales 年文件与 index 一致", yearFiles.join() === years.join())
for (const year of years) {
  if (!has(`data/car-sales/${year}.json`)) continue
  const data = json<{ year: string; months: MonthSales[] }>(
    `data/car-sales/${year}.json`,
  )
  const expected = salesIndex.months
    .filter((month) => month.startsWith(year + "-"))
    .map((month) => monthly.get(month))
  check(
    `${year} 年文件与月文件同步（跑 npm run data:cars）`,
    data.year === year && JSON.stringify(data.months) === JSON.stringify(expected),
  )
}

for (const suit of ["s", "h", "d", "c"]) {
  for (let rank = 1; rank <= 13; rank += 1) {
    const file = `cards/webp/${suit}${rank}.webp`
    check(`${file} 存在`, has(file))
  }
}
check("cards/webp/back.webp 存在", has("cards/webp/back.webp"))

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

// footer 只有一种尺寸；markup 全站唯一、内容逐字一致
console.log("== footer 归一化 ==")
const FOOTER = /<footer class="site-footer">[\s\S]*?<\/footer>/
const footers = ROUTES.map(({ file }) => {
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
for (const { file } of ROUTES) {
  check(`${file} 不再使用 data-fullscreen`, !html(file).includes("data-fullscreen"))
}

if (failed) {
  console.log(`\n失败 ${failed} 项`)
  process.exit(1)
}
console.log("\n全部通过")
