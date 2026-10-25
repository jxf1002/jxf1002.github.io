import type { MetadataRoute } from "next"
import { PAGES, SITE } from "../lib/site"

// sitemap 由路由表生成：新增页面只改 lib/site.ts，不再手抄 XML
// output: export 下 metadata route 需要显式声明静态生成
export const dynamic = "force-static"

export default function sitemap(): MetadataRoute.Sitemap {
  return Object.values(PAGES).map((page) => ({
    url: SITE.url + page.path,
    lastModified: page.lastMod,
    priority: page.priority,
  }))
}
