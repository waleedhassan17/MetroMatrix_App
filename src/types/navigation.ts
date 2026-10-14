// ═══════════════════════════════════════════════════════
// MetroMatrix — Navigation param lists
// ═══════════════════════════════════════════════════════
// One entry per route name in navigations-maps/Base.ts. Params are optional
// unless a screen genuinely cannot render without them: under React
// Navigation v7 a navigate() to a non-focused route PUSHES a fresh route, so
// its params are exactly what that caller passed.

export type RootStackParamList = {
  Welcome: undefined;
  DesignGallery: undefined;
};
