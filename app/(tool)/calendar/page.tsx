import CalendarGame from "../../../components/calendar/CalendarGame"
import JsonLd from "../../../components/JsonLd"
import { PAGES, metadataFor } from "../../../lib/site"
import "./style.css"

export const metadata = metadataFor("calendar")

export default function Page() {
  return (
    <>
      <JsonLd data={PAGES.calendar.jsonLd} />
      <CalendarGame />
    </>
  )
}
