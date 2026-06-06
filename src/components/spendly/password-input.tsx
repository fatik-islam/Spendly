"use client"

import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export const PasswordInput = React.forwardRef<HTMLInputElement, React.ComponentProps<typeof Input>>(function PasswordInput(
  {
    className,
    ...props
  },
  ref
) {
  const [revealed, setRevealed] = React.useState(false)

  return (
    <div className="relative">
      <Input
        {...props}
        ref={ref}
        type={revealed ? "text" : "password"}
        className={cn("pr-12", className)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-1 top-1/2 size-9 -translate-y-1/2 rounded-lg text-muted-foreground hover:text-foreground"
        aria-label={revealed ? "Hide password" : "Show password"}
        aria-pressed={revealed}
        disabled={props.disabled}
        onClick={() => setRevealed((value) => !value)}
      >
        {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </Button>
    </div>
  )
})
