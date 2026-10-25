import CollegePage from "../../../components/college/CollegePage"
import JsonLd from "../../../components/JsonLd"
import type { CollegeRow, CollegeYear } from "../../../lib/college"
import { DEFAULT_YEAR } from "../../../lib/college"
import { PAGES, metadataFor } from "../../../lib/site"
import colleges2023 from "../../../public/data/college/colleges2023.json"
import colleges2024 from "../../../public/data/college/colleges2024.json"
import colleges2025 from "../../../public/data/college/colleges2025.json"
import colleges2026 from "../../../public/data/college/colleges2026.json"

export const metadata = metadataFor("college")

// 默认年份的数据在构建期内联进 HTML，首屏就有内容，爬虫也看得到；其它年份由客户端按需加载
const ROWS: Record<CollegeYear, CollegeRow[]> = {
  2023: colleges2023,
  2024: colleges2024,
  2025: colleges2025,
  2026: colleges2026,
}

export default function Page() {
  return (
    <>
      <JsonLd data={PAGES.college.jsonLd} />
      <CollegePage initialRows={ROWS[DEFAULT_YEAR]} />
    </>
  )
}
