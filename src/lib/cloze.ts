const CLOZE_REGEX = /\{\{c(\d+)::([^}]*?)(?:::([^}]*?))?\}\}/g;

export interface ClozeMatch {
  index: number;
  answer: string;
  hint?: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function parseClozeText(text: string): ClozeMatch[] {
  const matches: ClozeMatch[] = [];
  let m: RegExpExecArray | null;

  const re = new RegExp(CLOZE_REGEX.source, CLOZE_REGEX.flags);
  while ((m = re.exec(text)) !== null) {
    matches.push({
      index: parseInt(m[1], 10),
      answer: m[2],
      hint: m[3] || undefined,
    });
  }

  return matches;
}

export function getUniqueClozeIndices(text: string): number[] {
  const matches = parseClozeText(text);
  return [...new Set(matches.map((m) => m.index))].sort((a, b) => a - b);
}

export function getNextClozeIndex(text: string): number {
  const indices = getUniqueClozeIndices(text);
  if (indices.length === 0) return 1;
  return indices[indices.length - 1] + 1;
}

export function getCurrentClozeIndex(text: string): number {
  const indices = getUniqueClozeIndices(text);
  if (indices.length === 0) return 1;
  return indices[indices.length - 1];
}

/**
 * Render with a specific cloze index hidden (blanked out).
 * Other cloze markers are unwrapped to show their answer as plain text.
 */
export function renderClozeHidden(text: string, clozeIndex: number): string {
  return text.replace(
    new RegExp(CLOZE_REGEX.source, CLOZE_REGEX.flags),
    (_match, idx, answer, hint) => {
      if (parseInt(idx, 10) === clozeIndex) {
        const label = hint ? `[${escapeHtml(hint)}]` : "[...]";
        return `<span class="cloze-blank">${label}</span>`;
      }
      return escapeHtml(answer);
    },
  );
}

/**
 * Render with a specific cloze index revealed (highlighted).
 * Other cloze markers are unwrapped to show their answer as plain text.
 */
export function renderClozeRevealed(text: string, clozeIndex: number): string {
  return text.replace(new RegExp(CLOZE_REGEX.source, CLOZE_REGEX.flags), (_match, idx, answer) => {
    if (parseInt(idx, 10) === clozeIndex) {
      return `<span class="cloze-reveal">${escapeHtml(answer)}</span>`;
    }
    return escapeHtml(answer);
  });
}

/**
 * Render all cloze markers visually for the deck card listing (editor preview).
 * Shows each cloze as a highlighted badge with its index.
 */
export function renderClozePreview(text: string): string {
  return text.replace(new RegExp(CLOZE_REGEX.source, CLOZE_REGEX.flags), (_match, idx, answer) => {
    return `<span class="cloze-preview" data-cloze="${escapeHtml(idx)}">${escapeHtml(answer)}</span>`;
  });
}
