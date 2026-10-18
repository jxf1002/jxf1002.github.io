import ComfortPage from "../../../components/comfort/ComfortPage"
import JsonLd from "../../../components/JsonLd"
import { PAGES, metadataFor } from "../../../lib/site"

export const metadata = metadataFor("comfort")

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function Page() {
  return (
    <>
      <JsonLd data={PAGES.comfort.jsonLd} />
      <ComfortPage />
    </>
  )
}
