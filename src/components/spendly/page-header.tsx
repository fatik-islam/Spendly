import { ReactNode } from "react"

export function PageHeader({
  title,
  description,
  action
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-0.5 sm:space-y-1">
        <h1 className="font-display text-[1.75rem] font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description ? <p className="hidden max-w-xl text-sm leading-6 text-muted-foreground sm:block">{description}</p> : null}
      </div>
      {action ? (
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-end [&_a]:w-full sm:[&_a]:w-auto [&_button]:w-full sm:[&_button]:w-auto">
          {action}
        </div>
      ) : null}
    </div>
  )
}
