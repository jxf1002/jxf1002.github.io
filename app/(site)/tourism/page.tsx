import JsonLd from "../../../components/JsonLd"
import TourismPage from "../../../components/tourism/TourismPage"
import type { TourismRow } from "../../../components/tourism/TourismPage"
import { PAGES, metadataFor } from "../../../lib/site"
import tourismData from "../../../public/data/tourism/tourism.json"

export const metadata = metadataFor("tourism")

// 数据只有 340 行，直接内联进静态 HTML，省掉一次请求和加载态
const ROWS: TourismRow[] = tourismData

export default function Page() {
  return (
    <>
      <JsonLd data={PAGES.tourism.jsonLd} />
      <TourismPage rows={ROWS} />
    </>
  )
}
