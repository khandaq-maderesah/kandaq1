/**
 * Asynchronous utilities for offline-first resilience.
 */

/**
 * Wraps a promise with a strict timeout limit.
 * If the promise does not settle within `timeoutMs`, it rejects with a timeout error
 * (or resolves with `fallback` if provided).
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 2500,
  fallback?: T
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeoutPromise = new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => {
      if (fallback !== undefined) {
        resolve(fallback)
      } else {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`))
      }
    }, timeoutMs)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    clearTimeout(timer!)
  }
}
