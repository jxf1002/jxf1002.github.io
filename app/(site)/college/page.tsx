import CollegePage from "../../../components/college/CollegePage"
import JsonLd from "../../../components/JsonLd"
import { PAGES, metadataFor } from "../../../lib/site"

export const metadata = metadataFor("college")

export default function Page() {
  return (
    <>
      <JsonLd data={PAGES.college.jsonLd} />
      <CollegePage />
    </>
  )
}
