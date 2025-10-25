/**
 * Color manipulation utilities for theme editor
 * Supports both hex and OKLCH color formats
 */

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toHex(n: number): string {
  const clamped = clamp(Math.round(n), 0, 255);
  return clamped.toString(16).padStart(2, "0");
}

/**
 * Adjust a hex color towards a target (0 for darker, 255 for lighter)
 */
function adjustHexTowards(hex: string, target: 0 | 255, t: number): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;

  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);

  const newR = r + (target - r) * t;
  const newG = g + (target - g) * t;
  const newB = b + (target - b) * t;

  return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
}

interface OklchColor {
  l: number;
  c: number;
  h: number;
  percent: boolean;
}

/**
 * Parse OKLCH color string into components
 */
function parseOklch(color: string): OklchColor | null {
  const m = color.match(
    /oklch\(\s*([0-9.]+)(%?)\s+([0-9.]+)\s+([0-9.]+)\s*\)/i,
  );
  if (!m) return null;

  const lRaw = parseFloat(m[1]);
  const percent = m[2] === "%";
  const l = percent ? lRaw / 100 : lRaw;
  const c = parseFloat(m[3]);
  const h = parseFloat(m[4]);

  return { l, c, h, percent };
}

/**
 * Format OKLCH components back to string
 */
function formatOklch({ l, c, h, percent }: OklchColor): string {
  const lOut = percent
    ? `${clamp(l * 100, 0, 100).toFixed(1)}%`
    : l.toFixed(3);
  return `oklch(${lOut} ${c} ${h})`;
}

/**
 * Lighten a color (hex or OKLCH)
 */
export function lighten(color: string, amount = 0.28): string {
  if (color.startsWith("#")) {
    return adjustHexTowards(color, 255, amount);
  }

  const parsed = parseOklch(color);
  if (parsed) {
    return formatOklch({ ...parsed, l: clamp(parsed.l + amount, 0, 1) });
  }

  return color;
}

/**
 * Darken a color (hex or OKLCH)
 */
export function darken(color: string, amount = 0.28): string {
  if (color.startsWith("#")) {
    return adjustHexTowards(color, 0, amount);
  }

  const parsed = parseOklch(color);
  if (parsed) {
    return formatOklch({ ...parsed, l: clamp(parsed.l - amount, 0, 1) });
  }

  return color;
}

