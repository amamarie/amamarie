import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Forfaits bêta FinAssuro",
  description: "Offre bêta FinAssuro avec prix réduits garantis 12 mois en échange de retours réguliers.",
}

export default function ForfaitsBetaPage() {
  redirect("/forfaits")
}
