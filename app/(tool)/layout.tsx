import type { ReactNode } from "react"
import RootShell from "../../components/RootShell"
import { ROOT_METADATA } from "../../lib/site"

export const metadata = ROOT_METADATA

// 工具页/游戏页的样式靠 body.tool-page 生效，与旧 HTML 一致
export default function ToolLayout({ children }: { children: ReactNode }) {
  return <RootShell bodyClassName="tool-page">{children}</RootShell>
}
