"use client"

import { useEffect, useState } from "react"

// 静态导出的 HTML 里烤的是构建年份，客户端再校正一次，避免长期不重建时年份过期
const BUILD_YEAR = new Date().getFullYear()

export default function SiteFooter() {
  const [year, setYear] = useState<number | null>(null)

  useEffect(() => {
    setYear(new Date().getFullYear())
  }, [])

  return (
    <footer className="site-footer">
      <p className="copyright-line">
        <span>
          Copyright © <span data-year="">{year ?? BUILD_YEAR}</span>
          {" www.justful.cn版权所有"}
        </span>
        <span className="sep" aria-hidden="true">
          ｜
        </span>
        <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">
          京ICP备18007833号-1
        </a>
      </p>
      <p>
        <a
          className="gh-icon"
          href="https://github.com/jxf1002/jxf1002.github.io"
          target="_blank"
          rel="noreferrer"
        >
          GitHub 源码地址
        </a>
        {"｜ 意见反馈请移步 "}
        <a
          href="https://github.com/jxf1002/jxf1002.github.io/issues"
          target="_blank"
          rel="noreferrer"
        >
          Issues
        </a>
      </p>
    </footer>
  )
}
