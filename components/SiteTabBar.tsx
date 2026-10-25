"use client"

import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

// 移动端底部导航；桌面用 SiteHeader 里的文字导航
const TABS = [
  { href: "/", label: "首页", icon: "home", match: [] as string[] },
  {
    href: "/#data",
    label: "数据",
    icon: "data",
    match: ["/college", "/tourism", "/cars", "/comfort"],
  },
  { href: "/#tools", label: "工具", icon: "tools", match: ["/photo", "/dcf"] },
  {
    href: "/#games",
    label: "游戏",
    icon: "games",
    match: [
      "/mahjong",
      "/mir2",
      "/sport",
      "/guess",
      "/five-cards",
      "/calendar",
    ],
  },
]

const ICONS: Record<string, ReactNode> = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </>
  ),
  data: (
    <>
      <path d="M4 20V11" />
      <path d="M10 20V4" />
      <path d="M16 20v-6" />
      <path d="M2 20h20" />
    </>
  ),
  tools: (
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  ),
  games: (
    <>
      <rect x="2" y="7" width="20" height="10" rx="5" />
      <path d="M7 10v4M5 12h4" />
      <path d="M16 11h.01M18 13h.01" />
    </>
  ),
}

export default function SiteTabBar() {
  const pathname = usePathname()
  const path = (pathname || "").replace(/\/$/, "") || "/"

  return (
    <>
      <div className="site-tabbar-space" aria-hidden="true" />
      <nav className="site-tabbar" aria-label="站点导航">
        {TABS.map((tab) => (
          <a
            href={tab.href}
            key={tab.label}
            aria-current={
              path === tab.href || tab.match.includes(path)
                ? "page"
                : undefined
            }
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {ICONS[tab.icon]}
            </svg>
            {tab.label}
          </a>
        ))}
      </nav>
    </>
  )
}
