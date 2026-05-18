import type { Metadata } from "next"
import { ClerkProvider } from "@clerk/nextjs"

import "./globals.css"
import { isClerkAuthEnabled } from "@/lib/auth-config"

export const metadata: Metadata = {
  title: "FinAssuro CRM",
  description:
    "CRM professionnel pour conseillers en assurance et produits financiers.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const appShell = (
    <html lang="fr" className="h-full scroll-smooth antialiased" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className="min-h-full bg-slate-50 font-sans" suppressHydrationWarning>{children}</body>
    </html>
  )

  return isClerkAuthEnabled() ? <ClerkProvider>{appShell}</ClerkProvider> : appShell
}
