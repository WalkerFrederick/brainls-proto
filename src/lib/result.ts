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
