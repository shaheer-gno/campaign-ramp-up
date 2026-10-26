/** Shared helpers for tab/comma flat-file reports (same idea as FBA). */

export function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/_/g, '-');
}

/** RFC-style CSV cell split (handles quotes and "" escapes). */
export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

export function splitLine(line: string): string[] {
  if (line.includes('\t')) return line.split('\t');
  return splitCsvLine(line);
}

export function parseNumber(raw: string | undefined): number | null {
  if (raw == null) return null;
  const s = raw.trim();
  if (!s || s === '--' || s.toLowerCase() === 'n/a') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function col(
  cells: string[],
  index: Map<string, number>,
  ...names: string[]
): string | undefined {
  for (const name of names) {
    const i = index.get(normalizeHeader(name));
    if (i != null && cells[i] != null) return cells[i];
  }
  return undefined;
}

export function headerIndex(text: string): {
  lines: string[];
  index: Map<string, number>;
} | null {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);
  if (lines.length < 1) return null;
  const headers = splitLine(lines[0]!).map(normalizeHeader);
  const index = new Map(headers.map((h, i) => [h, i]));
  return { lines, index };
}

export function hasCols(
  index: Map<string, number>,
  ...names: string[]
): boolean {
  return names.every((n) => index.has(normalizeHeader(n)));
}
