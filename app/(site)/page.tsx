import JsonLd from "../../components/JsonLd"
import { PAGES, metadataFor } from "../../lib/site"

export const metadata = metadataFor("home")

const GROUPS = [
  {
    title: "数据",
    slogan: "整理公开信息，让查找和比较更高效。",
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
      {
        href: "/comfort/",
        title: "全国体感温度",
        description: "地级市天气、体感温度与24小时温度范围地图。",
        type: "数据浏览",
      },
    ],
  },
  {
    title: "工具",
    slogan: "用代码解决实际问题，纯浏览器端运行，数据不上传。",
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
    ],
  },
  {
    title: "游戏",
    slogan: "用于验证 AI 编码能力的实验性项目，交互粗糙，不适合长期游玩。",
    items: [
      {
        href: "/mahjong/",
        title: "麻将小游戏",
        description: "在线四人麻将，支持智能出牌提示和番型计算。",
        type: "麻将",
      },
      {
        href: "/mir2/",
        title: "传奇挂机小游戏",
        description: "战法道三人小队自动打怪升级，金币买倍速、刷首领凑橙装。",
        type: "挂机",
      },
      {
        href: "/sport/",
        title: "赛博运动",
        description: "调整跑步速度，生成赛博跑步报告。",
        type: "跑步",
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
          <section className="block" key={group.title}>
            <h2 className="block-title">{group.title}</h2>
            {group.slogan ? (
              <p className="block-slogan">{group.slogan}</p>
            ) : null}
            <div className="card-grid">
              {group.items.map((item) => (
                <a className="link-card" href={item.href} key={item.href}>
                  <div className="link-card-meta">
                    <span>{item.type}</span>
                    <span className="link-card-arrow" aria-hidden="true">
                      →
                    </span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </a>
              ))}
            </div>
          </section>
        ))}
      </main>
    </>
  )
}
