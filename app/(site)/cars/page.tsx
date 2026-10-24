import CarSalesPage from "../../../components/cars/CarSalesPage"
import JsonLd from "../../../components/JsonLd"
import { PAGES, metadataFor } from "../../../lib/site"
import "./style.css"

export const metadata = metadataFor("cars")

export default function Page() {
  return (
    <>
      <JsonLd data={PAGES.cars.jsonLd} />
      <CarSalesPage />
    </>
  )
}
