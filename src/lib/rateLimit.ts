/**
 * Simple in-memory rate limiter for API routes.
 * Tracks requests per IP with a sliding window.
 */

const requests = new Map<string, { count: number; resetAt: number }>()

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, val] of requests) {
    if (now > val.resetAt) requests.delete(key)
  }
}, 5 * 60 * 1000)

/**
 * Check if a request should be rate-limited.
 * @param identifier - Unique ID (typically IP address or user ID)
 * @param maxRequests - Maximum allowed requests in the window
 * @param windowMs - Time window in milliseconds (default: 60s)
 * @returns `true` if the request is allowed, `false` if rate-limited
 */
export function rateLimit(
  identifier: string,
  maxRequests: number = 30,
  windowMs: number = 60_000
): boolean {
  const now = Date.now()
  const entry = requests.get(identifier)

  if (!entry || now > entry.resetAt) {
    requests.set(identifier, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= maxRequests) {
    return false
  }

  entry.count++
  return true
}
