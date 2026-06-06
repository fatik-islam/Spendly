"use client"

import { useEffect, useState } from "react"
import { ChevronDown, LaptopMinimal, Moon, SunMedium } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: SunMedium },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: LaptopMinimal }
] as const

type ThemeMode = (typeof THEME_OPTIONS)[number]["value"]

function isThemeMode(value: string | undefined): value is ThemeMode {
  return THEME_OPTIONS.some((option) => option.value === value)
}

export function ThemeToggle({
  variant = "icon",
  className
}: {
  variant?: "icon" | "default"
  className?: string
}) {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const selectedTheme: ThemeMode = mounted && isThemeMode(theme) ? theme : "system"
  const resolvedThemeMode: ThemeMode = mounted && resolvedTheme === "dark" ? "dark" : "light"
  const activeTheme = selectedTheme === "system" ? resolvedThemeMode : selectedTheme
  const selectedOption = THEME_OPTIONS.find((option) => option.value === selectedTheme) ?? THEME_OPTIONS[2]
  const ActiveIcon = THEME_OPTIONS.find((option) => option.value === activeTheme)?.icon ?? LaptopMinimal
  const TriggerIcon = mounted ? ActiveIcon : LaptopMinimal

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={variant === "icon" ? "icon" : "default"}
          className={cn(variant === "default" && "min-w-[10rem] justify-between rounded-2xl", className)}
          aria-label="Choose theme"
          disabled={!mounted}
        >
          <span className="flex items-center gap-2">
            <TriggerIcon />
            {variant === "default" ? <span>{selectedOption.label}</span> : <span className="sr-only">{selectedOption.label}</span>}
          </span>
          {variant === "default" ? <ChevronDown /> : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={selectedTheme} onValueChange={(value) => setTheme(value)}>
          {THEME_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              <option.icon />
              <span>{option.label}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
