/**
 * In-memory rate limiter with automatic cleanup.
 * No external dependencies (no Redis needed).
 */

class RateLimiter {
  /**
   * @param {number} maxAttempts - Max attempts in the time window
   * @param {number} windowMs - Time window in milliseconds
   */
  constructor(maxAttempts, windowMs) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    this.attempts = new Map(); // key → [timestamps]

    // Auto-cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    // Prevent the interval from keeping Node.js alive
    if (this.cleanupInterval.unref) this.cleanupInterval.unref();
  }

  /**
   * Check if a key is rate limited.
   * @param {string} key - Identifier (IP, session ID, etc.)
   * @returns {{ limited: boolean, remaining: number, retryAfterMs: number }}
   */
  check(key) {
    const now = Date.now();
    const timestamps = this.attempts.get(key) || [];

    // Filter to only recent attempts within the window
    const recent = timestamps.filter((t) => now - t < this.windowMs);

    if (recent.length >= this.maxAttempts) {
      const oldestInWindow = recent[0];
      const retryAfterMs = this.windowMs - (now - oldestInWindow);
      return { limited: true, remaining: 0, retryAfterMs };
    }

    return { limited: false, remaining: this.maxAttempts - recent.length, retryAfterMs: 0 };
  }

  /**
   * Record an attempt for a key.
   * @param {string} key
   */
  hit(key) {
    const now = Date.now();
    const timestamps = this.attempts.get(key) || [];
    timestamps.push(now);

    // Keep only recent timestamps
    const recent = timestamps.filter((t) => now - t < this.windowMs);
    this.attempts.set(key, recent);
  }

  /**
   * Express middleware factory.
   * @param {function} keyFn - Function to extract key from request (default: IP)
   * @returns {function} Express middleware
   */
  middleware(keyFn) {
    return (req, res, next) => {
      const key = keyFn ? keyFn(req) : getClientIp(req);
      const { limited, retryAfterMs } = this.check(key);

      if (limited) {
        const retryAfterSec = Math.ceil(retryAfterMs / 1000);
        res.set("Retry-After", String(retryAfterSec));
        return res.status(429).json({
          error: "Too many requests",
          retryAfterSeconds: retryAfterSec,
        });
      }

      this.hit(key);
      next();
    };
  }

  /**
   * Remove expired entries.
   */
  cleanup() {
    const now = Date.now();
    for (const [key, timestamps] of this.attempts) {
      const recent = timestamps.filter((t) => now - t < this.windowMs);
      if (recent.length === 0) {
        this.attempts.delete(key);
      } else {
        this.attempts.set(key, recent);
      }
    }
  }
}

/**
 * Extract client IP from request, respecting proxies (Railway uses X-Forwarded-For).
 */
function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || "unknown";
}

// Pre-configured rate limiters for critical endpoints
const loginLimiter = new RateLimiter(5, 15 * 60 * 1000);     // 5 attempts / 15 min
const claimLimiter = new RateLimiter(10, 15 * 60 * 1000);    // 10 attempts / 15 min
const messageLimiter = new RateLimiter(10, 5 * 60 * 1000);   // 10 attempts / 5 min
const announcementLimiter = new RateLimiter(5, 5 * 60 * 1000); // 5 attempts / 5 min

module.exports = {
  RateLimiter,
  getClientIp,
  loginLimiter,
  claimLimiter,
  messageLimiter,
  announcementLimiter,
};
