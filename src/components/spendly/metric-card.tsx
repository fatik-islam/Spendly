import { ArrowDownRight, ArrowUpRight, LucideIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency } from "@/lib/format"
import { type CurrencyCode } from "@/lib/types"

export function MetricCard({
  title,
  value,
  currency,
  note,
  tone = "default",
  icon: Icon
}: {
  title: string
  value: number
  currency: CurrencyCode
  note: string
  tone?: "default" | "positive" | "negative"
  icon: LucideIcon
}) {
  const accentClass =
    tone === "positive"
      ? "bg-emerald-500/10 text-emerald-500"
      : tone === "negative"
        ? "bg-rose-500/10 text-rose-500"
        : "bg-primary/10 text-primary"

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="break-words font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              {formatCurrency(value, currency as never)}
            </p>
          </div>
          <div className={`rounded-2xl p-3 ${accentClass}`}>
            <Icon className="size-5" />
          </div>
        </div>
        <div className="mt-5 flex items-center gap-2">
          <Badge variant={tone === "negative" ? "destructive" : "default"} className="max-w-full gap-1 whitespace-normal rounded-full leading-5">
            {tone === "negative" ? <ArrowDownRight className="size-3" /> : <ArrowUpRight className="size-3" />}
            {note}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}
