import JsonLd from "../../components/JsonLd"
import { Badge } from "../../components/ui/badge"
import { Card } from "../../components/ui/card"
import type { PageKey } from "../../lib/site"
import { PAGES, metadataFor } from "../../lib/site"

export const metadata = metadataFor("home")

type HomeItem = {
  key: PageKey
  type: string
  description: string
}

const GROUPS: {
  id: string
  title: string
  slogan: string
  items: HomeItem[]
}[] = [
  {
    id: "data",
    title: "数据",
    slogan: "整理公开信息，让查找和比较更高效。",
    items: [
      {
        key: "college",
        description: "软科、校友会、武书连大学排行数据汇总。",
        type: "数据浏览",
      },
      {
        key: "tourism",
        description: "全国5A景区汇总。",
        type: "数据浏览",
      },
      {
        key: "cars",
        description: "2025 年至今各汽车品牌月销量，按年度排行并对比同比。",
        type: "数据浏览",
      },
      {
        key: "comfort",
        description: "地级市天气、体感温度与24小时温度范围地图。",
        type: "数据浏览",
      },
    ],
  },
  {
    id: "tools",
    title: "工具",
    slogan: "用代码解决实际问题，纯浏览器端运行，数据不上传。",
    items: [
      {
        key: "photo",
        description: "批量把图片转成 JPG / PNG / WebP，可打包成 ZIP 下载。",
        type: "转换工具",
      },
      {
        key: "dcf",
        description: "使用 DCF 模型对企业进行估值。",
        type: "分析工具",
      },
    ],
  },
  {
    id: "games",
    title: "游戏",
    slogan: "用于验证 AI 编码能力的实验性项目，交互粗糙，不适合长期游玩。",
    items: [
      {
        key: "mahjong",
        description: "在线四人麻将，支持智能出牌提示和番型计算。",
        type: "麻将",
      },
      {
        key: "mir2",
        description: "战法道三人小队自动打怪升级，金币买倍速、刷首领凑橙装。",
        type: "挂机",
      },
      {
        key: "sport",
        description: "调整跑步速度，生成赛博跑步报告。",
        type: "跑步",
      },
      {
        key: "guess",
        description: "10 次机会猜出 4 位不重复数字，带最佳提示与本地战绩。",
        type: "推理",
      },
      {
        key: "fiveCards",
        description: "读懂四张明牌的排列，猜出扣住的第五张牌。",
        type: "魔术",
      },
      {
        key: "calendar",
        description: "铺满日历，只留下今天的月份、日期和星期。",
        type: "拼图",
      },
    ],
  },
]

export default function HomePage() {
  return (
    <>
      <JsonLd data={PAGES.home.jsonLd} />
      <main>
        <section className="hero">
          <div className="hero-inner">
            <div>
              <p className="hero-kicker">JUSTFUL · 实用数据与工具</p>
              <h1>用代码创造无限可能</h1>
              <p className="hero-description">
                把复杂的信息整理成清晰、好用的工具，陪你做出更好的判断。
              </p>
            </div>
            <img
              className="hero-image"
              src="/images/banner.svg"
              alt="数据与工具面板插画"
            />
          </div>
        </section>
        {GROUPS.map((group) => (
          <section className="home-block" id={group.id} key={group.title}>
            <h2 className="block-title">{group.title}</h2>
            {group.slogan ? (
              <p className="block-slogan">{group.slogan}</p>
            ) : null}
            <div className="card-grid">
              {group.items.map((item) => {
                const page = PAGES[item.key]
                return (
                  <a
                    className="group h-full rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
                    href={page.path}
                    key={page.path}
                  >
                    <Card className="h-full transition duration-200 group-hover:-translate-y-[3px] group-hover:border-primary group-hover:shadow-[0_16px_34px_rgb(25_50_43/12%)]">
                      <div className="flex min-h-[22px] items-center justify-between">
                        <Badge
                          className="text-[0.78rem] font-bold"
                          variant="secondary"
                        >
                          {item.type}
                        </Badge>
                        <span
                          className="text-[1.2rem] text-accent transition-transform group-hover:translate-x-1"
                          aria-hidden="true"
                        >
                          →
                        </span>
                      </div>
                      <h3 className="mt-0 mb-0 text-[1.15rem] font-bold">
                        {page.shortTitle}
                      </h3>
                      <p className="mt-0 mb-0 min-h-[3.2em] text-[0.95rem] text-muted-foreground">
                        {item.description}
                      </p>
                    </Card>
                  </a>
                )
              })}
            </div>
          </section>
        ))}
      </main>
    </>
  )
}
