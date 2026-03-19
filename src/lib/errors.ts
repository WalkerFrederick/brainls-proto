export const ErrorCode = {
  BAD_REQUEST: "BAD_REQUEST",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  NOT_FOUND: "NOT_FOUND",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  CONFLICT: "CONFLICT",
  LIMIT_EXCEEDED: "LIMIT_EXCEEDED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Log an error with optional context. Currently writes to stderr;
 * swap the body when an external service is wired up.
 */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  console.error("[app]", error, context);
  // TODO: Send to Sentry
  // TODO: Send to Axiom / LogSnag / external logging
  // TODO: Structured JSON logging for server-side log drain
}

/**
 * Detect Next.js internal throws (redirect, notFound) via the stable
 * `digest` property so we can re-throw them from safeAction.
 */
function isNextError(error: unknown): boolean {
  if (typeof error === "object" && error !== null && "digest" in error) {
    const digest = (error as { digest: unknown }).digest;
    return (
      typeof digest === "string" &&
      (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND"))
    );
  }
  return false;
}

// Lazily import result helpers to avoid circular deps — errors.ts is
// imported by result.ts consumers, but safeAction needs err()/ok().
// We inline the return shape instead.
import type { Result } from "@/lib/result";

/**
 * Wrap a server action so that unhandled throws become a structured
 * `Result` error instead of a 500. Next.js redirects and notFound
 * calls are re-thrown so routing still works.
 *
 * Lives in a non-"use server" file on purpose — the `"use server"`
 * directive in each action file applies to its *exports*, so the
 * wrapped function is still a valid server action.
 */
export function safeAction<TArgs extends unknown[], TResult>(
  name: string,
  fn: (...args: TArgs) => Promise<Result<TResult>>,
): (...args: TArgs) => Promise<Result<TResult>> {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (isNextError(e)) throw e;
      reportError(e, { action: name });
      return {
        success: false as const,
        error: "Something went wrong. Please try again.",
        code: "INTERNAL_ERROR" as const,
      };
    }
  };
}
