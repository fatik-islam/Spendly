import Link from "next/link"

import { BrandMark } from "@/components/spendly/brand-mark"
import { SiteFooter } from "@/components/spendly/site-footer"
import { Button } from "@/components/ui/button"

export function LegalPage({
  eyebrow,
  title,
  introduction,
  children
}: {
  eyebrow: string
  title: string
  introduction: string
  children: React.ReactNode
}) {
  return (
    <main className="min-h-screen px-4 py-4 sm:px-6 lg:px-8">
      <header className="mx-auto flex max-w-4xl items-center justify-between gap-4 py-4">
        <Link href="/" aria-label="Spendly home">
          <BrandMark />
        </Link>
        <Button asChild variant="outline">
          <Link href="/">Back to Spendly</Link>
        </Button>
      </header>

      <article className="mx-auto mt-8 max-w-4xl rounded-[32px] border border-border/60 bg-card/75 p-6 shadow-xl backdrop-blur sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-5 max-w-3xl text-base leading-8 text-muted-foreground">{introduction}</p>
        <div className="mt-10 space-y-9 text-sm leading-7 text-muted-foreground [&_a]:font-semibold [&_a]:text-primary [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_p+p]:mt-3 [&_ul]:mt-3">
          {children}
        </div>
      </article>

      <div className="mx-auto max-w-4xl">
        <SiteFooter className="pb-10" />
      </div>
    </main>
  )
}
