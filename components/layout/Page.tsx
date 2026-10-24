import type { CSSProperties, ReactNode } from "react"
import { cn } from "../../lib/utils"

// 全站唯一的页面容器：固定 1200px + px 内边距，尺寸只在 site.css 里调
export default function Page({
  className,
  style,
  children,
}: {
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <main className={cn("site-page", className)} style={style}>
      {children}
    </main>
  )
}
