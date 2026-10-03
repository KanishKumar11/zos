// Deterministic identity colours: the same project or person always gets the same colour on every
// chip, avatar, chart and timeline. Colours come from the --p1..--p8 theme tokens, so they adapt to
// light and dark mode.

const PALETTE_SIZE = 8;

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Palette slot 1..8 for an id (or name). */
export const paletteIndex = (key: string | undefined | null): number => (key ? (hash(key) % PALETTE_SIZE) + 1 : 1);

/** CSS colour for an id, e.g. "hsl(var(--p3))". Pass `alpha` (0–1) for washes. */
export const identityColor = (key: string | undefined | null, alpha?: number): string =>
  alpha === undefined ? `hsl(var(--p${paletteIndex(key)}))` : `hsl(var(--p${paletteIndex(key)}) / ${alpha})`;

export const initialsOf = (name: string | undefined | null): string =>
  (name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?';
