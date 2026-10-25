import type { MetadataRoute } from "next"
import { PAGES, SITE } from "../lib/site"
import salesIndex from "../public/data/car-sales/index.json"

// 销量页每个月都在变，sitemap 的日期跟着最新月份走；其它页仍是手写日期
const CARS_MONTH = salesIndex.months[salesIndex.months.length - 1]

// sitemap 由路由表生成：新增页面只改 lib/site.ts，不再手抄 XML
// output: export 下 metadata route 需要显式声明静态生成
export const dynamic = "force-static"

export default function sitemap(): MetadataRoute.Sitemap {
  return Object.values(PAGES).map((page) => ({
    url: SITE.url + page.path,
    lastModified: page.path === "/cars/" ? CARS_MONTH + "-01" : page.lastMod,
    priority: page.priority,
  }))
}
