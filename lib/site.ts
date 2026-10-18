// 站点级常量与每个路由的 SEO 元信息（内容沿用旧 HTML 里的 head 文案）
import type { Metadata } from "next"

export const SITE = {
  name: "贾师傅的小站",
  url: "https://www.justful.cn",
  github: "https://github.com/jxf1002/jxf1002.github.io",
}

export type PageKey =
  | "home"
  | "college"
  | "tourism"
  | "comfort"
  | "dcf"
  | "photo"
  | "sport"
  | "mahjong"
  | "mir2"

export type JsonLdData = Record<string, unknown>

export type PageMeta = {
  path: string
  title: string
  description: string
  keywords?: string
  ogTitle: string
  ogDescription: string
  ogImage?: string
  twitterCard?: "summary" | "summary_large_image"
  jsonLd?: JsonLdData
}

export const PAGES: Record<PageKey, PageMeta> = {
  home: {
    path: "/",
    title: "贾师傅的小站｜实用数据与工具",
    description: "用代码创造无限可能，分享个人精心整理的实用工具和数据。",
    keywords: "贾师傅,数据,工具",
    ogTitle: "贾师傅的小站｜实用数据与工具",
    ogDescription:
      "整理大学排行榜、旅游景区数据和实用分析工具，帮助你快速获取信息并做出判断。",
    ogImage: "/images/banner.svg",
    twitterCard: "summary_large_image",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "贾师傅的小站",
      url: "https://www.justful.cn/",
      description: "整理实用数据和工具，帮助你快速获取信息并做出判断。",
    },
  },
  college: {
    path: "/college/",
    title: "大学排行榜-数据-贾师傅的小站",
    description: "提供基于校友会、软科、武书连数据的中国大学排行榜。",
    keywords: "贾师傅,大学排行榜,大学排行榜数据",
    ogTitle: "大学排行榜｜贾师傅的小站",
    ogDescription: "查看基于校友会、软科、武书连数据整理的中国大学排行榜。",
    twitterCard: "summary",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: "中国大学排行榜数据",
      description: "基于校友会、软科、武书连数据整理的中国大学排行榜。",
      url: "https://www.justful.cn/college/",
      inLanguage: "zh-CN",
      creator: { "@type": "Organization", name: "贾师傅的小站" },
    },
  },
  tourism: {
    path: "/tourism/",
    title: "5A级旅游景区-数据-贾师傅的小站",
    description: "提供基于2023年数据的5A级旅游景区。",
    keywords: "贾师傅,5A级旅游景区,5A级旅游景区数据",
    ogTitle: "5A级旅游景区数据｜贾师傅的小站",
    ogDescription: "查询基于2023年数据整理的全国5A级旅游景区及所属地区。",
    twitterCard: "summary",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: "全国5A级旅游景区数据",
      description: "基于2023年数据整理的全国5A级旅游景区及所属地区。",
      url: "https://www.justful.cn/tourism/",
      inLanguage: "zh-CN",
      creator: { "@type": "Organization", name: "贾师傅的小站" },
    },
  },
  comfort: {
    path: "/comfort/",
    title: "全国体感温度-数据-贾师傅的小站",
    description:
      "全国地级市体感温度地图：查看每个地级市的实时天气、体感温度与24小时温度范围。",
    keywords: "贾师傅,体感温度,全国气温地图,地级市天气",
    ogTitle: "全国体感温度｜贾师傅的小站",
    ogDescription:
      "按地级市划分的中国地图，查看实时天气、体感温度与24小时温度范围。",
    twitterCard: "summary",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: "全国体感温度数据",
      description: "按地级市划分的全国体感温度、实时天气与24小时温度范围。",
      url: "https://www.justful.cn/comfort/",
      inLanguage: "zh-CN",
      creator: { "@type": "Organization", name: "贾师傅的小站" },
    },
  },
  dcf: {
    path: "/dcf/",
    title: "DCF 企业估值计算器｜贾师傅的小站",
    description: "使用现金流折现模型估算企业价值的在线 DCF 企业估值计算器。",
    ogTitle: "DCF 企业估值计算器｜贾师傅的小站",
    ogDescription: "使用现金流折现模型估算企业价值的在线 DCF 企业估值工具。",
    twitterCard: "summary",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "DCF 企业估值计算器",
      description: "使用现金流折现模型估算企业价值的在线工具。",
      url: "https://www.justful.cn/dcf/",
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web Browser",
      offers: { "@type": "Offer", price: "0", priceCurrency: "CNY" },
    },
  },
  photo: {
    path: "/photo/",
    title: "图片格式转换｜贾师傅的小站",
    description:
      "纯前端批量图片格式转换工具，支持 JPG、PNG、WebP 互转，可打包成 ZIP 下载，图片不会上传到服务器。",
    keywords: "图片格式转换,JPG,PNG,WebP,批量压缩,在线工具",
    ogTitle: "图片格式转换｜贾师傅的小站",
    ogDescription:
      "批量把图片转成 JPG / PNG / WebP，纯浏览器本地处理，一键打包下载。",
  },
  sport: {
    path: "/sport/",
    title: "运动练习｜跑步·骑行·游泳·跳绳",
    description:
      "调整跑步、骑行、游泳、跳绳的运动强度，实时估算距离、配速、卡路里和心率的在线小工具。",
    keywords: "运动,跑步,骑行,游泳,跳绳,卡路里计算,配速",
    ogTitle: "运动练习｜跑步·骑行·游泳·跳绳",
    ogDescription:
      "四种运动的强度调节与实时动画，运动结束生成距离、配速、卡路里、心率报告。",
    twitterCard: "summary",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "运动练习",
      description:
        "跑步、骑行、游泳、跳绳四种运动的强度调节与运动报告在线小工具。",
      url: "https://www.justful.cn/sport/",
      applicationCategory: "健康与健身应用",
      operatingSystem: "Web Browser",
      offers: { "@type": "Offer", price: "0", priceCurrency: "CNY" },
    },
  },
  mahjong: {
    path: "/mahjong/",
    title: "麻将小游戏｜贾师傅的小站",
    description: "在线四人麻将小游戏，支持智能出牌提示、番型计算和对局日志。",
    ogTitle: "麻将小游戏｜贾师傅的小站",
    ogDescription: "在线四人麻将小游戏，支持智能出牌提示和番型计算。",
    twitterCard: "summary",
  },
  mir2: {
    path: "/mir2/",
    title: "传奇挂机小游戏｜贾师傅的小站",
    description:
      "纯前端传奇挂机小游戏：战法道三职业自动打怪、捡装、升级，还能组队挑战首领。",
    ogTitle: "传奇挂机小游戏｜贾师傅的小站",
    ogDescription:
      "纯前端传奇挂机小游戏：战法道三职业自动打怪、捡装、升级，组队挑战首领。",
  },
}

// 两个 root layout 共用的基础 metadata（icons / metadataBase）
export const ROOT_METADATA: Metadata = {
  metadataBase: new URL(SITE.url),
  icons: { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }] },
}

export function metadataFor(key: PageKey): Metadata {
  const page = PAGES[key]
  const url = SITE.url + page.path
  return {
    title: page.title,
    description: page.description,
    ...(page.keywords ? { keywords: page.keywords } : {}),
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: SITE.name,
      title: page.ogTitle,
      description: page.ogDescription,
      url,
      ...(page.ogImage ? { images: [SITE.url + page.ogImage] } : {}),
    },
    ...(page.twitterCard ? { twitter: { card: page.twitterCard } } : {}),
  }
}
