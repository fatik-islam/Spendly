import { LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction
}: {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-4 p-5 text-center sm:p-10">
        <div className="rounded-3xl bg-primary/10 p-4 text-primary">
          <Icon className="size-7" />
        </div>
        <div className="space-y-2">
          <h3 className="font-display text-xl font-semibold">{title}</h3>
          <p className="max-w-md text-sm text-muted-foreground sm:max-w-md">{description}</p>
        </div>
        {actionLabel && onAction ? (
          <Button onClick={onAction}>{actionLabel}</Button>
        ) : null}
      </CardContent>
    </Card>
  )
}
