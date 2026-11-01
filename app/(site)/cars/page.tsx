import CarSalesPage from "../../../components/cars/CarSalesPage"
import JsonLd from "../../../components/JsonLd"
import type { BrandPrice, MonthSales } from "../../../lib/car-sales"
import { PAGES, metadataFor } from "../../../lib/site"
import brandPrice from "../../../public/data/car-sales/brand-price.json"
import sales2025 from "../../../public/data/car-sales/2025.json"
import sales2026 from "../../../public/data/car-sales/2026.json"
import "./style.css"

export const metadata = metadataFor("cars")

// 同比要用上年同期，两年数据都内联；页面不再发数据请求
const MONTHS: MonthSales[] = [...sales2025.months, ...sales2026.months]
const PRICES: BrandPrice[] = brandPrice.rows

export default function Page() {
  return (
    <>
      <JsonLd data={PAGES.cars.jsonLd} />
      <CarSalesPage months={MONTHS} prices={PRICES} />
    </>
  )
}
