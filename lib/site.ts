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
  | "cars"
  | "comfort"
  | "dcf"
  | "photo"
  | "sport"
  | "mahjong"
  | "mir2"
  | "guess"
  | "fiveCards"
  | "calendar"

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
  cars: {
    path: "/cars/",
    title: "汽车品牌销量-数据-贾师傅的小站",
    description:
      "按月采集的汽车品牌销量数据，按年度汇总排行，并对比上年同期同比变化。",
    keywords: "贾师傅,汽车销量,汽车品牌销量排行榜,汽车销量数据",
    ogTitle: "汽车品牌销量｜贾师傅的小站",
    ogDescription: "各汽车品牌月销量按年度汇总排行，对比上年同期变化。",
    twitterCard: "summary",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: "中国汽车品牌销量数据",
      description: "按月汇总的汽车品牌销量，含年度排行与同比变化。",
      url: "https://www.justful.cn/cars/",
      inLanguage: "zh-CN",
      temporalCoverage: "2025-01/2026-09",
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
  guess: {
    path: "/guess/",
    title: "猜数字小游戏｜贾师傅的小站",
    description:
      "10 次机会猜出 4 位不重复数字的在线小游戏，带最佳提示、猜测记录和本地战绩。",
    keywords: "猜数字,1A2B,Bulls and Cows,推理小游戏",
    ogTitle: "猜数字小游戏｜贾师傅的小站",
    ogDescription: "10 次机会猜出 4 位不重复数字，带最佳提示与本地战绩。",
    twitterCard: "summary",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "猜数字小游戏",
      description: "10 次机会猜出 4 位不重复数字的在线推理小游戏。",
      url: "https://www.justful.cn/guess/",
      applicationCategory: "GameApplication",
      operatingSystem: "Web Browser",
      offers: { "@type": "Offer", price: "0", priceCurrency: "CNY" },
    },
  },
  fiveCards: {
    path: "/five-cards/",
    title: "五张牌魔术小游戏｜贾师傅的小站",
    description:
      "五张牌读心魔术：一张扣牌、四张明牌，根据花色和后三张的排列算出扣牌是哪一张。",
    keywords: "五张牌魔术,读心魔术,扑克牌,推理小游戏",
    ogTitle: "五张牌魔术小游戏｜贾师傅的小站",
    ogDescription: "读懂四张明牌的排列，猜出扣住的第五张牌。",
    twitterCard: "summary",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "五张牌魔术",
      description: "一张扣牌、四张明牌的五张牌读心魔术小游戏。",
      url: "https://www.justful.cn/five-cards/",
      applicationCategory: "GameApplication",
      operatingSystem: "Web Browser",
      offers: { "@type": "Offer", price: "0", priceCurrency: "CNY" },
    },
  },
  calendar: {
    path: "/calendar/",
    title: "日历拼图小游戏｜贾师傅的小站",
    description:
      "经典日历拼图在线版：把拼块铺满日历，只留下当天的月份和日期；高级模式还要留下星期。支持电脑和手机。",
    keywords: "日历拼图,拼图游戏,多边形拼图,每日一题",
    ogTitle: "日历拼图小游戏｜贾师傅的小站",
    ogDescription: "铺满日历，只留今天的月、日、星期。",
    twitterCard: "summary",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "日历拼图",
      description: "把拼块铺满日历、只留下目标月份/日期/星期的在线拼图游戏。",
      url: "https://www.justful.cn/calendar/",
      applicationCategory: "GameApplication",
      operatingSystem: "Web Browser",
      offers: { "@type": "Offer", price: "0", priceCurrency: "CNY" },
    },
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
