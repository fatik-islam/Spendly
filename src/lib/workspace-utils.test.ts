import { randomUUID } from "node:crypto"
import { describe, expect, it } from "vitest"

import { calculateFinancialHealthScore, canLoadDemoWorkspace } from "@/lib/workspace-utils"
import { type Account } from "@/lib/types"

function makeAccount(balance: number): Account {
  return {
    id: randomUUID(),
    user_id: randomUUID(),
    name: "Test",
    type: "bank",
    balance,
    currency: "USD",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
}

describe("calculateFinancialHealthScore", () => {
  it("scores a healthy workspace using the weighted finance formula", () => {
    expect(
      calculateFinancialHealthScore({
        totalBalance: 24000,
        savingsRate: 24,
        monthlyExpenses: 3000,
        budgetEfficiency: 15
      })
    ).toBe(73)
  })

  it("clamps extreme inputs so the score stays between 0 and 100", () => {
    expect(
      calculateFinancialHealthScore({
        totalBalance: -200,
        savingsRate: 80,
        monthlyExpenses: 0,
        budgetEfficiency: 40
      })
    ).toBe(78)
  })
})

describe("canLoadDemoWorkspace", () => {
  it("allows the demo workspace only when all finance collections are empty and balances are zero", () => {
    expect(
      canLoadDemoWorkspace({
        accounts: [makeAccount(0), makeAccount(0)],
        transactionsCount: 0,
        budgetsCount: 0,
        goalsCount: 0,
        recurringCount: 0
      })
    ).toBe(true)
  })

  it("blocks the demo workspace when any account already has a non-zero balance", () => {
    expect(
      canLoadDemoWorkspace({
        accounts: [makeAccount(0), makeAccount(125)],
        transactionsCount: 0,
        budgetsCount: 0,
        goalsCount: 0,
        recurringCount: 0
      })
    ).toBe(false)
  })

  it("blocks the demo workspace when real finance data already exists", () => {
    expect(
      canLoadDemoWorkspace({
        accounts: [makeAccount(0)],
        transactionsCount: 1,
        budgetsCount: 0,
        goalsCount: 0,
        recurringCount: 0
      })
    ).toBe(false)
  })
})
