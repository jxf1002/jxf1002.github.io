// 404：两个 root layout 之上没有公共 layout，所以这里返回完整 HTML
// （globalNotFound 见 next.config.ts；站点样式和主题首屏脚本要自己带上）
import type { Metadata } from "next"
import "./globals.css"
import "./site.css"
import SiteHeader from "../components/SiteHeader"
import SiteFooter from "../components/SiteFooter"
import SiteTabBar from "../components/SiteTabBar"
import Page from "../components/layout/Page"
import PageHeader from "../components/layout/PageHeader"
import { THEME_SCRIPT } from "../components/RootShell"

export const metadata: Metadata = {
  title: "页面不存在｜贾师傅的小站",
  description: "这个地址没有对应的内容。",
}

export default function GlobalNotFound() {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <SiteHeader />
        <Page>
          <PageHeader
            title="页面不存在"
            description="这个地址没有对应的内容，可能已经改版或输入有误。"
            actions={
              <a className="button" href="/">
                返回首页
              </a>
            }
          />
        </Page>
        <SiteFooter />
        <SiteTabBar />
      </body>
    </html>
  )
}
