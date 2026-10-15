// ═══════════════════════════════════════════════════════
// MetroMatrix — Design tokens (the FYP app's look, light only)
// ═══════════════════════════════════════════════════════
// The base layer: neutrals, semantic colours, space, shape, depth, motion.
// Values come from the MetroMatrix FYP app (constants/theme.ts there): a warm
// stone neutral ramp, emerald brand, platform system font. Two deliberate
// changes from the FYP:
//   • the page canvas is pure white (#FFFFFF), not the FYP's warm paper;
//   • the app is light-only, like the FYP's app.json (userInterfaceStyle).
//
// Every value a component paints is written down HERE (or in ./services.ts,
// ./typography.ts, ./brandMarks.ts) and nowhere else. scripts/check-design-
// tokens.js fails the build on a raw value anywhere in the UI folders.

import { Platform, StyleSheet, type ViewStyle } from 'react-native';

export type ColorMode = 'light';

export interface Palette {
  /** Screen ground — white. */
  canvas: string;
  /** Cards, sheets, inputs. */
  surface: string;
  /** Wells, tab tracks, skeletons, thumbnails. */
  surfaceSunk: string;
  /** The ONE primary text colour. */
  ink: string;
  /** The ONE secondary text colour — passes AA body on white. */
  inkMuted: string;
  /** Icons, placeholders, disabled labels. Never body copy (2.5:1). */
  inkFaint: string;
  /** Hairline borders, input borders (the FYP's input look). */
  line: string;
  /** Dividers inside a card, where `line` is too loud. */
  lineSoft: string;
  /** Checkbox / radio outlines — a control that must be found. */
  lineStrong: string;
  /** Disabled control fills (the grey primary button before a form is valid). */
  disabled: string;
  brand: string;
  onBrand: string;
  danger: string;
  dangerSoft: string;
  /** Border of a destructive control / error notice where the soft is too faint. */
  dangerLine: string;
  onDanger: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  info: string;
  infoSoft: string;
  /** Rating stars. Amber, and only ever this. */
  star: string;
  /** Behind sheets and dialogs. */
  overlay: string;
  /** Text-legibility scrim over photography. */
  scrim: string;
  /** The scrim's clear end — where a photo scrim fades from. */
  scrimClear: string;
  /** The strong scrim (brand cards: copy sits mid-card, on any photo). */
  scrimFaint: string;
  scrimMid: string;
  scrimDeep: string;
  /** Text and icons painted on `scrim`. */
  onScrim: string;
  /** Secondary text on a photo or dark ground (the FYP's inkInverseSoft — 90% keeps AA). */
  onScrimSoft: string;
  /** Badges floating on a photo: near-opaque white, so they read on any image. */
  glass: string;
  /** Ground of the full-screen document viewer. */
  viewer: string;
  /** Role Selection's "Service Provider" card: the FYP's indigo icon on its tint. */
  roleProvider: string;
  roleProviderSoft: string;
}

const light: Palette = {
  canvas: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceSunk: '#F5F5F4',
  ink: '#1C1917',
  inkMuted: '#57534E',
  inkFaint: '#A8A29E',
  line: '#E7E5E4',
  lineSoft: '#F5F5F4',
  lineStrong: '#78716C',
  disabled: '#D6D3D1',
  brand: '#047857',
  onBrand: '#FFFFFF',
  danger: '#B91C1C',
  dangerSoft: '#FEF2F2',
  dangerLine: '#FECACA',
  onDanger: '#FFFFFF',
  success: '#047857',
  successSoft: '#ECFDF5',
  warning: '#B45309',
  warningSoft: '#FEF6EC',
  info: '#1D4ED8',
  infoSoft: '#EFF6FF',
  star: '#D97706',
  overlay: 'rgba(28, 25, 23, 0.45)',
  scrim: 'rgba(28, 25, 23, 0.62)',
  scrimClear: 'rgba(28, 25, 23, 0)',
  scrimFaint: 'rgba(28, 25, 23, 0.12)',
  scrimMid: 'rgba(28, 25, 23, 0.4)',
  scrimDeep: 'rgba(28, 25, 23, 0.88)',
  onScrim: '#FFFFFF',
  onScrimSoft: 'rgba(255, 255, 255, 0.9)',
  glass: 'rgba(255, 255, 255, 0.94)',
  viewer: '#0C0A09',
  roleProvider: '#6366F1',
  roleProviderSoft: '#F0F4FF',
};

export const PALETTES: Record<ColorMode, Palette> = { light };

// ─── Space — 4-pt scale ─────────────────────────────
export const space = {
  s0: 0,
  s4: 4,
  s8: 8,
  s12: 12,
  s16: 16,
  s20: 20,
  s24: 24,
  s32: 32,
  s40: 40,
  s56: 56,
} as const;

/** Side gutter for every screen (the FYP's 24). */
export const GUTTER = space.s24;

// ─── Shape (the FYP's radius roles) ─────────────────
export const radius = {
  /** Chips, badges, small tags, social buttons, tab tracks. */
  sm: 8,
  /** Inputs, cards. */
  md: 12,
  /** Role / provider cards, document tiles. */
  lg: 16,
  /** Bottom sheets and the single hero. */
  xl: 20,
  pill: 999,
} as const;

// ─── Sizes (controls, icons, avatars) ───────────────
export const size = {
  hairline: StyleSheet.hairlineWidth,
  border: 1,
  focusBorder: 2,
  /** Minimum touch target (WCAG / Material). */
  touch: 44 as number,
  /** sm: compact buttons · md: the FYP's 50 pt buttons · lg: the FYP's 56 pt inputs. */
  control: { sm: 36, md: 50, lg: 56 },
  /** hero: the glyph on a kitchen card's art panel. */
  icon: { sm: 16, md: 20, lg: 24, xl: 32, hero: 56 },
  avatar: { sm: 32, md: 44, lg: 64, xl: 96 },
  /** Role / provider card icon tile. */
  tile: 64,
  otpCell: { width: 48, height: 56 },
  checkbox: 22,
  progress: 4,
  timelineDot: 12,
  timelineLine: 2,
  pageDot: 8,
  pageDotActive: 24,
  /** Onboarding indicator pitch (dot centre to dot centre). */
  pagePitch: 20,
  qr: 196,
  tabBar: 64,
  headerBar: 52,
  sheetHandle: 4,
  thumb: 56,
  logoMark: 40,
  /** The native splash mark's imageWidth (app.json) — the JS splash matches it. */
  splashMark: 104,
  /** Paragraph measure for onboarding and empty-state prose. */
  prose: 460,
  /** Onboarding preview card width, its row icon tile, eyebrow dot, top-bar mark. */
  previewCard: 300,
  previewRowIcon: 26,
  eyebrowDot: 6,
  markSmall: 28,
  /** Role / provider card: icon tile radius, chevron well, sub-type icon tile. */
  chevronWell: 32,
  subTypeTile: 36,
  /** Food home: the horizontal kitchen tile, the art panels, the promo card. */
  kitchenTile: 248,
  kitchenArt: 148,
  kitchenArtSmall: 112,
  promoCard: 136,
  /** Customer home: the photo panel of a service card (FYP userHome imageContainer, 160). */
  serviceArt: 160,
  /** Customer home: the FYP's 40 pt header wells. */
  headerWell: 40,
  /** The slide-out side menu: at most this wide (85% of the window below it). */
  sideMenu: 340,
  // ── Shopping ──
  /** Product photos are portrait 4:5 (width / height), as fashion catalogues shoot. */
  productAspect: 0.8,
  /** Home banners and store covers. */
  bannerAspect: 2,
  coverAspect: 2.4,
  /** A product card in a horizontal rail. */
  railCard: 156,
  /** A store card in a horizontal rail. */
  storeCard: 264,
  storeLogo: 56,
  storeLogoSmall: 28,
  /** Colour swatch in the variant sheet. */
  swatch: 36,
  /** Bag count on the header bag icon. */
  countBadge: 18,
  /** Category tile glyph well. */
  categoryWell: 56,
  /** The bag line thumbnail (4:5). */
  lineThumb: 64,
  /** Charts: the Today sparkline and the Insights charts. */
  chart: { spark: 56, bar: 168, line: 168 },
  /** Rating-breakdown bar track. */
  ratingBar: 6,
  /** Inventory's stock field beside each row. */
  stockField: 96,
  /** The brand list (the FYP's): a brand's photo card, and the featured logo ring. */
  brandCard: 220,
  brandRing: 64,
  brandRingInner: 52,
} as const;

export const opacity = {
  disabled: 0.4,
  pressed: 0.72,
  skeletonLow: 0.45,
  skeletonHigh: 1,
  /** A sold-out product's photo. */
  soldOut: 0.55,
} as const;

// ─── Depth (the FYP's three elevations) ─────────────
// flat     bordered, no shadow — the default card
// raised   lifted off the page: the one card a screen wants read first
// overlay  sheets, modals, floating action bars (StickyCTA)
// input    the FYP's barely-there shadow under text inputs and social buttons
export interface Elevation {
  none: ViewStyle;
  raised: ViewStyle;
  float: ViewStyle;
  input: ViewStyle;
}

const shadow = (height: number, blur: number, alpha: number, androidElevation: number, ink: string): ViewStyle =>
  Platform.select<ViewStyle>({
    ios: { shadowColor: ink, shadowOffset: { width: 0, height }, shadowOpacity: alpha, shadowRadius: blur / 2 },
    android: { elevation: androidElevation, shadowColor: ink },
    default: { boxShadow: `0px ${height}px ${blur}px rgba(28, 25, 23, ${alpha})` },
  }) ?? {};

export const buildElevation = (palette: Palette): Elevation => ({
  none: { borderWidth: size.hairline, borderColor: palette.line },
  raised: shadow(3, 20, 0.07, 3, palette.ink),
  float: shadow(10, 40, 0.14, 12, palette.ink),
  input: shadow(1, 4, 0.05, 1, palette.ink),
});

// ─── Motion ─────────────────────────────────────────
export const motion = {
  /** Press feedback: 180 ms ease-out. */
  press: { duration: 180, scale: 0.97 },
  /** A remote photo fading in. */
  imageFade: 150,
  /** Home banners advance this often, and pause while touched. */
  bannerInterval: 6000,
  /** Search suggestions wait for typing to pause this long. */
  suggestDebounce: 250,
  /** Checkout re-prices this long after the last change. */
  previewDebounce: 300,
  /** The store's Orders list refreshes this often while on screen. */
  ordersPoll: 30000,
  /** Sheets and step transitions. */
  sheet: { duration: 240 },
  /** Badges and pills arriving. */
  spring: { damping: 14, stiffness: 220, mass: 1 },
  /** Skeleton pulse half-period. */
  pulse: { duration: 900 },
  /** Large-title collapse distance. */
  titleCollapse: 44,
  /** A live indicator's ring pulse. */
  livePulse: { duration: 1400, scale: 2.4 },
  /** The slow breath on Provider Approval Pending's mark (the FYP's pulse). */
  breath: { duration: 1200, scale: 1.06 },
  /** The JS splash (FYP splash.tsx timings). */
  splash: { word: 420, tag: 380, stagger: 140, lead: 120, hold: 520 },
} as const;
