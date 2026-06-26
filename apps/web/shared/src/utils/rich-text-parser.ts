/** Gap markers for English fill subtypes */
export const GAP_MARKER_RE = /(\{\{\d+\}\}|___+)/g;

const FENCED_CODE_RE = /(```(\w+)?\n?([\s\S]*?)```)/g;

export type PassageSegment =
  | { kind: 'text'; value: string }
  | { kind: 'gap'; value: string; gapIndex: number };

/**
 * Split passage into text/gap segments. Gaps inside fenced code blocks are kept as text.
 */
export function splitPassageGaps(text: string): PassageSegment[] {
  const segments: PassageSegment[] = [];
  let gapIndex = 0;
  const parts = text.split(FENCED_CODE_RE);

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;

    if (part.startsWith('```')) {
      segments.push({ kind: 'text', value: part });
      continue;
    }

    const subparts = part.split(GAP_MARKER_RE);
    for (const sp of subparts) {
      if (!sp) continue;
      if (/^\{\{\d+\}\}$|___+/.test(sp)) {
        segments.push({ kind: 'gap', value: sp, gapIndex: gapIndex++ });
      } else {
        segments.push({ kind: 'text', value: sp });
      }
    }
  }

  return segments;
}

/** Inline rich-text tokens (single line) */
export const INLINE_TOKEN_RE =
  /(\$\$[^$]+\$\$|\$[^$]+\$|\*\*[^*]+\*\*|\*[^*]+\*|__[^_]+__|`[^`]+`|\[(?:Ảnh|Audio):\s*[^\]]+\])/g;

export function wrapSelection(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  before: string,
  after: string,
): { value: string; cursor: number } {
  const selected = text.slice(selectionStart, selectionEnd);
  const value =
    text.slice(0, selectionStart) + before + selected + after + text.slice(selectionEnd);
  const cursor = selectionStart + before.length + selected.length + after.length;
  return { value, cursor };
}
