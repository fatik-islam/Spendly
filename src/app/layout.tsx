import type { Metadata } from "next"
import { Manrope, Space_Grotesk } from "next/font/google"

import { Providers } from "@/components/providers"
import "@/app/globals.css"

const fontSans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans"
})

const fontDisplay = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display"
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: "Spendly",
  description: "A premium personal finance tracker powered by Next.js and InsForge.",
  openGraph: {
    title: "Spendly",
    description: "A premium personal finance tracker powered by Next.js and InsForge.",
    images: ["/brand/spendly-logo-full.png"]
  },
  twitter: {
    card: "summary_large_image",
    title: "Spendly",
    description: "A premium personal finance tracker powered by Next.js and InsForge.",
    images: ["/brand/spendly-logo-full.png"]
  }
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${fontSans.variable} ${fontDisplay.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
