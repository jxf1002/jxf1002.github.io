import GuessGame from "../../../components/guess/GuessGame"
import JsonLd from "../../../components/JsonLd"
import { PAGES, metadataFor } from "../../../lib/site"
import "./style.css"

export const metadata = metadataFor("guess")

export default function Page() {
  return (
    <>
      <JsonLd data={PAGES.guess.jsonLd} />
      <GuessGame />
    </>
  )
}
