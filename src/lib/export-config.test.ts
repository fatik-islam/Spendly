import { describe, expect, it } from "vitest"

import { DEFAULT_EXPORT_DATASET, isExportDataset } from "@/lib/export-config"

describe("isExportDataset", () => {
  it("accepts each supported dataset and rejects unknown values", () => {
    expect(isExportDataset(DEFAULT_EXPORT_DATASET)).toBe(true)
    expect(isExportDataset("profile")).toBe(true)
    expect(isExportDataset("recurring")).toBe(true)
    expect(isExportDataset("workspace")).toBe(false)
    expect(isExportDataset("")).toBe(false)
  })
})
