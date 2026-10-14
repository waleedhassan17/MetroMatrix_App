// ═══════════════════════════════════════════════════════
// MetroMatrix — Route names
// ═══════════════════════════════════════════════════════
// The single source of route-name strings. A name must NEVER change once
// shipped: deep links (metromatrix://) and navigate() strings depend on it.
// Add new names; never rename or reuse old ones.

export const ROUTES = {
  // ── Unauthenticated ──
  WELCOME: 'Welcome',

  // ── Dev only ──
  DESIGN_GALLERY: 'DesignGallery',
} as const;

export type RouteName = typeof ROUTES[keyof typeof ROUTES];
