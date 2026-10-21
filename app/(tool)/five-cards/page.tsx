import FiveCardsGame from "../../../components/five-cards/FiveCardsGame"
import JsonLd from "../../../components/JsonLd"
import { PAGES, metadataFor } from "../../../lib/site"
import "./style.css"

export const metadata = metadataFor("fiveCards")

export default function Page() {
  return (
    <>
      <JsonLd data={PAGES.fiveCards.jsonLd} />
      <FiveCardsGame />
    </>
  )
}
