export function summarizeBudgetState(progress: number) {
  if (progress >= 100) {
    return "Exceeded"
  }
  if (progress >= 80) {
    return "Warning"
  }
  return "Healthy"
}
