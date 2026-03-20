import type { ErrorCode } from "@/lib/errors";

export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string; code: ErrorCode; fieldErrors?: Record<string, string[]> };

export function ok<T>(data: T): Result<T> {
  return { success: true, data };
}

export function err<T = never>(
  code: ErrorCode,
  message: string,
  fieldErrors?: Record<string, string[]>,
): Result<T> {
  return { success: false, error: message, code, fieldErrors };
}

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  /** Called before each retry with the attempt number (1-based) and total retries. */
  onRetry?: (attempt: number, maxRetries: number) => void;
  /** Called when all retries are exhausted and the action still failed. */
  onFail?: (result: Result<never>) => void;
  /** Called when the action succeeds (including after retries). */
  onSuccess?: () => void;
  /** Called when an offline condition is detected instead of retrying. */
  onOffline?: () => void;
}

/**
 * Retry a server action with exponential backoff when it returns a
 * transient (INTERNAL_ERROR) failure. Non-transient failures (validation,
 * permission, etc.) are returned immediately without retrying.
 *
 * Safe to use with idempotent actions.
 */
export async function retryAction<T>(
  fn: () => Promise<Result<T>>,
  opts: RetryOptions = {},
): Promise<Result<T>> {
  const { maxRetries = 3, baseDelayMs = 500, onRetry, onFail, onSuccess, onOffline } = opts;
  let lastResult: Result<T> | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      onOffline?.();
      return {
        success: false,
        error: "You appear to be offline. Please check your connection and try again.",
        code: "INTERNAL_ERROR",
      };
    }

    try {
      lastResult = await fn();
    } catch {
      lastResult = {
        success: false,
        error: "Network request failed. Please check your connection.",
        code: "INTERNAL_ERROR",
      };
    }

    if (lastResult.success) {
      onSuccess?.();
      return lastResult;
    }
    if (lastResult.code !== "INTERNAL_ERROR") return lastResult;
    if (attempt < maxRetries) {
      onRetry?.(attempt + 1, maxRetries);
      await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt));
    }
  }

  onFail?.(lastResult as Result<never>);
  return lastResult!;
}
