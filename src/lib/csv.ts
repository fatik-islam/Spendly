export type CsvValue = string | number | boolean | null | undefined

export function stringifyCsv(rows: CsvValue[][]) {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const serialized = String(value ?? "")
          if (serialized.includes(",") || serialized.includes('"') || serialized.includes("\n")) {
            return `"${serialized.replaceAll('"', '""')}"`
          }

          return serialized
        })
        .join(",")
    )
    .join("\n")
}
