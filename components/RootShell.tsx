import type { ReactNode } from "react"
import SiteFooter from "./SiteFooter"
import SiteHeader from "./SiteHeader"

// 首屏前就把 dark class 定下来，避免主题闪白（与旧 common.js 同一套约定）
const THEME_SCRIPT = `try{var t=localStorage.getItem('theme');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}`

const ANALYTICS_SCRIPT = `var _hmt = _hmt || [];
(function () {
  var hm = document.createElement('script')
  hm.src = 'https://hm.baidu.com/hm.js?682c23240d8faa05b0298eb23862358e'
  var s = document.getElementsByTagName('script')[0]
  s.parentNode.insertBefore(hm, s)
})()`

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
        <link rel="stylesheet" href="/assets/css/site.css?v=11" />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: ANALYTICS_SCRIPT }} />
      </head>
      <body className={bodyClassName}>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  )
}
