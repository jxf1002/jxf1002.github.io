import type { ReactNode } from "react"
import "../globals.css"
import RootShell from "../../components/RootShell"
import { ROOT_METADATA } from "../../lib/site"

export const metadata = ROOT_METADATA

export default function SiteLayout({ children }: { children: ReactNode }) {
  return <RootShell>{children}</RootShell>
}
