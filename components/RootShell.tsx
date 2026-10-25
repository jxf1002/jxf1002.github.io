import type { ReactNode } from "react"
import SiteFooter from "./SiteFooter"
import SiteHeader from "./SiteHeader"
import SiteTabBar from "./SiteTabBar"

// 首屏前就把 dark class 定下来，避免主题闪白（与旧 common.js 同一套约定）
export const THEME_SCRIPT = `try{var t=localStorage.getItem('theme');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}`

// 第三方脚本必须由 React 直接渲染；在 head 里动态 insert 会改掉 hydrate 前的 DOM 顺序
const ANALYTICS_QUEUE = "window._hmt = window._hmt || [];"
const ANALYTICS_SRC =
  "https://hm.baidu.com/hm.js?682c23240d8faa05b0298eb23862358e"

// 两个 root layout 共用的外壳；只有 body 类不同（工具页/游戏页沿用旧的 tool-page）
export default function RootShell({
  bodyClassName,
  children,
}: {
  bodyClassName?: string
  children: ReactNode
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: ANALYTICS_QUEUE }} />
        <script async src={ANALYTICS_SRC} />
      </head>
      <body className={bodyClassName}>
        <SiteHeader />
        {children}
        <SiteFooter />
        <SiteTabBar />
      </body>
    </html>
  )
}
