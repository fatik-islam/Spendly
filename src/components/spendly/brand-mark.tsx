import Image from "next/image"

import { cn } from "@/lib/utils"

export function BrandMark({
  className,
  mobileCompact = false
}: {
  className?: string
  mobileCompact?: boolean
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <Image
        src="/brand/spendly-icon.png"
        alt="Spendly logo"
        width={44}
        height={44}
        className="size-11 rounded-2xl object-cover ring-1 ring-black/5 shadow-md dark:ring-white/10"
        priority
      />
      <p className={cn("truncate font-display text-lg font-semibold tracking-tight", mobileCompact && "hidden sm:block")}>
        Spendly
      </p>
    </div>
  )
}
