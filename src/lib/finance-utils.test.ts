import { describe, expect, it } from "vitest"

import { summarizeBudgetState } from "@/lib/finance-utils"

describe("summarizeBudgetState", () => {
  it("keeps budgets under 80 percent in the healthy state", () => {
    expect(summarizeBudgetState(0)).toBe("Healthy")
    expect(summarizeBudgetState(79.9)).toBe("Healthy")
  })

  it("flags budgets at or above 80 percent as warning until they are exceeded", () => {
    expect(summarizeBudgetState(80)).toBe("Warning")
    expect(summarizeBudgetState(99.99)).toBe("Warning")
  })

  it("marks budgets at or above 100 percent as exceeded", () => {
    expect(summarizeBudgetState(100)).toBe("Exceeded")
    expect(summarizeBudgetState(132)).toBe("Exceeded")
  })
})
