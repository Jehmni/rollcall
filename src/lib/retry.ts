/**
 * Client-side retry with exponential backoff.
 *
 * Only retries on transient errors (network failures, HTTP 429 / 5xx).
 * Application-level errors (4xx, RPC logic errors) are thrown immediately.
 */

export interface RetryOptions {
  /** Maximum number of attempts including the first. Default: 3 */
  maxAttempts?: number
  /** Base delay in ms for exponential backoff. Default: 500 */
  baseDelayMs?: number
  /** Return true if the error is transient and should be retried. */
  isRetryable?: (err: unknown) => boolean
}

function defaultIsRetryable(err: unknown): boolean {
  if (err instanceof TypeError && err.message.toLowerCase().includes('fetch')) return true
  if (err instanceof DOMException && err.name === 'AbortError') return true
  const status = (err as { status?: number; code?: string })?.status
  if (typeof status === 'number') return status === 429 || status >= 500
  const code = (err as { code?: string })?.code
  if (code === 'PGRST' || code === '40001') return true // Supabase serialization failure
  return false
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3
  const baseDelayMs = options.baseDelayMs ?? 500
  const isRetryable = options.isRetryable ?? defaultIsRetryable

  let lastError: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, baseDelayMs * Math.pow(2, attempt - 1)))
    }
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (!isRetryable(err)) throw err
    }
  }
  throw lastError
}


