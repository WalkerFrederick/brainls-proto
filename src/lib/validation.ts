const NAME_MAX = 50;
const NAME_PATTERN = /^[\p{L}\p{M}'\-.\s]+$/u;

export function validateName(
  raw: string,
): { valid: true; name: string } | { valid: false; error: string } {
  const name = raw.trim().replace(/\s+/g, " ");

  if (name.length === 0) {
    return { valid: false, error: "Name is required." };
  }

  if (name.length > NAME_MAX) {
    return { valid: false, error: `Name must be ${NAME_MAX} characters or fewer.` };
  }

  if (!NAME_PATTERN.test(name)) {
    return { valid: false, error: "Name contains invalid characters." };
  }

  return { valid: true, name };
}
