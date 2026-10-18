import JsonLd from "../../../components/JsonLd"
import Runner from "../../../components/sport/Runner"
import { PAGES, metadataFor } from "../../../lib/site"
import "./style.css"

export const metadata = metadataFor("sport")

export default function Page() {
  return (
    <>
      <JsonLd data={PAGES.sport.jsonLd} />
      <Runner />
    </>
  )
}
