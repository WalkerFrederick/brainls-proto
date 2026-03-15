const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function requireUuid(value: string, label = "ID"): string {
  if (!isValidUuid(value)) {
    throw new Error(`Invalid ${label}: not a valid UUID`);
  }
  return value;
}
