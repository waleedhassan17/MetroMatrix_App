// MetroMatrix — A swatch for a colour option the store types ("Navy" → a navy dot).
// Unknown names get no swatch; the chip still shows the word.

const COLOURS: Record<string, string> = {
  black: '#1C1917', white: '#FFFFFF', ivory: '#F2EAD3', cream: '#F5EBDD', beige: '#D6C7A1', sand: '#D6C7A1',
  grey: '#9CA3AF', gray: '#9CA3AF', charcoal: '#374151', silver: '#C0C0C0', gold: '#C9A227',
  red: '#B91C1C', maroon: '#7A1F3D', rouge: '#9F1239', pink: '#EC4899', rose: '#E11D48', peach: '#F4A582',
  orange: '#EA580C', rust: '#B45309', mustard: '#D4A017', marigold: '#D4A017', yellow: '#FACC15',
  green: '#15803D', olive: '#6B7A2F', mint: '#98D8B4', teal: '#0F766E', emerald: '#047857',
  blue: '#1D4ED8', navy: '#1E3A8A', sky: '#7DD3FC', royal: '#1E40AF', ink: '#1E293B',
  purple: '#7E22CE', plum: '#5B2A6E', lilac: '#C8A2C8', lavender: '#B9A7E0', brown: '#78350F', tan: '#C08A5B',
};

export const swatchFor = (name: string): string | null => {
  const words = name.trim().toLowerCase().split(/\s+/);
  for (const w of [...words].reverse()) if (COLOURS[w]) return COLOURS[w];
  return null;
};
