import { cn } from "@/lib/utils"

const COPYRIGHT_YEAR = new Date().getFullYear()

export function SiteFooter({
  className,
  compact = false
}: {
  className?: string
  compact?: boolean
}) {
  return (
    <footer
      className={cn(
        "flex flex-col gap-3 border-t border-border/60 text-sm text-muted-foreground",
        compact ? "pt-5" : "mt-10 pt-6",
        className
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="leading-6">© {COPYRIGHT_YEAR} Spendly.</p>
        <p className="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground">
          <span>Built by</span>
          <a
            href="https://www.linkedin.com/in/faatik"
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-fit items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-primary transition-colors hover:border-primary/40 hover:bg-primary/10"
          >
            Syed Fatik Islam
          </a>
        </p>
      </div>
    </footer>
  )
}
