/** Empirical CDF over a sample; used to normalize strike rates across eras. */
export class Percentiles {
  private sorted: number[]

  constructor(values: number[]) {
    this.sorted = [...values].sort((a, b) => a - b)
  }

  get size(): number {
    return this.sorted.length
  }

  /** Fraction of the sample strictly below x (0..1). */
  p(x: number): number {
    if (this.sorted.length === 0) return 0.5
    let lo = 0
    let hi = this.sorted.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (this.sorted[mid]! < x) lo = mid + 1
      else hi = mid
    }
    return lo / this.sorted.length
  }
}
