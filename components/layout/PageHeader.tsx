import type { ReactNode } from "react"
import { cn } from "../../lib/utils"

// 所有可滚动页面的统一页头：标题 + 一行小字描述，右侧放操作
export default function PageHeader({
  title,
  description,
  actions,
  className,
  children,
}: {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
  children?: ReactNode
}) {
  return (
    <header className={cn("page-header", className)}>
      <div className="page-header-text">
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
        {children}
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </header>
  )
}
