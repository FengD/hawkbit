const parseHexColor = (hex: string): [number, number, number] | null => {
  const normalized = hex.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return null;
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return [r, g, b];
};

export const withAlpha = (hex: string, alpha: number, fallback: string): string => {
  const rgb = parseHexColor(hex);
  if (!rgb) {
    return fallback;
  }

  const safeAlpha = Math.max(0, Math.min(1, alpha));
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${safeAlpha})`;
};
