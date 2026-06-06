import { CircleDollarSign } from "lucide-react"

import { CATEGORY_ICON_MAP } from "@/lib/constants"

export function CategoryIcon({
  icon,
  className
}: {
  icon?: string | null
  className?: string
}) {
  const Icon = (icon ? CATEGORY_ICON_MAP[icon] : null) ?? CircleDollarSign
  return <Icon className={className} />
}
