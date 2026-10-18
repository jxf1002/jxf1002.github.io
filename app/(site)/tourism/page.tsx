import JsonLd from "../../../components/JsonLd"
import TourismPage from "../../../components/tourism/TourismPage"
import { PAGES, metadataFor } from "../../../lib/site"

export const metadata = metadataFor("tourism")

export default function Page() {
  return (
    <>
      <JsonLd data={PAGES.tourism.jsonLd} />
      <TourismPage />
    </>
  )
}
