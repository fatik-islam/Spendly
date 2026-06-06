import { NextRequest, NextResponse } from "next/server"

import { exportWorkspaceCsv } from "@/lib/data"
import { getErrorMessage } from "@/lib/errors"
import { DEFAULT_EXPORT_DATASET, EXPORT_DATASETS, isExportDataset } from "@/lib/export-config"
import { getCurrentUser } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const requestedDataset = request.nextUrl.searchParams.get("dataset") ?? DEFAULT_EXPORT_DATASET

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        {
          error: "AUTH_REQUIRED",
          message: "Sign in to export workspace data."
        },
        { status: 401 }
      )
    }

    if (!isExportDataset(requestedDataset)) {
      return NextResponse.json(
        {
          error: "INVALID_EXPORT_DATASET",
          message: `Choose one of: ${EXPORT_DATASETS.map((dataset) => dataset.value).join(", ")}.`
        },
        { status: 400 }
      )
    }

    const { csv, filename } = await exportWorkspaceCsv(requestedDataset)

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "EXPORT_FAILED",
        message: getErrorMessage(error, "Failed to export workspace data.")
      },
      { status: 500 }
    )
  }
}
