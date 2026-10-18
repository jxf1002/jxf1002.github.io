import DcfCalculator from "../../../components/dcf/DcfCalculator"
import JsonLd from "../../../components/JsonLd"
import { PAGES, metadataFor } from "../../../lib/site"
import "./style.css"

export const metadata = metadataFor("dcf")

export default function Page() {
  return (
    <>
      <JsonLd data={PAGES.dcf.jsonLd} />
      <DcfCalculator />
    </>
  )
}
