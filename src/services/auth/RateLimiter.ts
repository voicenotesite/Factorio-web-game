export class RateLimiter {
  private tokens: number
  private readonly maxTokens: number
  private readonly refillRate: number
  private lastRefill: number

  constructor(maxTokens: number, refillIntervalMs: number) {
    this.tokens = maxTokens
    this.maxTokens = maxTokens
    this.refillRate = maxTokens / refillIntervalMs
    this.lastRefill = performance.now()
  }

  private refill(): void {
    const now = performance.now()
    const elapsed = now - this.lastRefill
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate)
    this.lastRefill = now
  }

  tryConsume(count = 1): boolean {
    this.refill()
    if (this.tokens >= count) {
      this.tokens -= count
      return true
    }
    return false
  }

  get remaining(): number {
    this.refill()
    return this.tokens
  }
}
