import JsonLd from "../../../components/JsonLd"
import PhotoConverter from "../../../components/photo/PhotoConverter"
import { PAGES, metadataFor } from "../../../lib/site"
import "./style.css"

export const metadata = metadataFor("photo")

export default function Page() {
  return (
    <>
      <JsonLd data={PAGES.photo.jsonLd} />
      <PhotoConverter />
    </>
  )
}
