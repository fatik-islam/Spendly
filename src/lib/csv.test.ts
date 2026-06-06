import { describe, expect, it } from "vitest"

import { stringifyCsv } from "@/lib/csv"

describe("stringifyCsv", () => {
  it("joins simple rows into csv output", () => {
    expect(
      stringifyCsv([
        ["Name", "Amount"],
        ["Salary", 1200]
      ])
    ).toBe("Name,Amount\nSalary,1200")
  })

  it("escapes commas, quotes, and line breaks", () => {
    expect(
      stringifyCsv([
        ["Description", "Notes"],
        ['Dividend "A"', "Line one,\nline two"]
      ])
    ).toBe('Description,Notes\n"Dividend ""A""","Line one,\nline two"')
  })
})
