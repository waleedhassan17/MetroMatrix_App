// ═══════════════════════════════════════════════════════
// MetroMatrix — Type scale (the FYP app's)
// ═══════════════════════════════════════════════════════
// THE APP RENDERS IN THE PLATFORM SYSTEM FACE — Roboto on Android, San
// Francisco on iOS — exactly as the FYP does. No custom family is loaded or
// named for UI text; weight is `fontWeight`. Values are the FYP's `T` scale
// (constants/theme.ts) plus the few auth-screen sizes the FYP sets inline
// (logo 28, screen title 24, input 15, button 16).

import type { TextStyle } from 'react-native';

export type TypeRole =
  | 'display'
  | 'logo'
  | 'h1'
  | 'screenTitle'
  | 'h2'
  | 'heading'
  | 'cardTitle'
  | 'barTitle'
  | 'title'
  | 'body'
  | 'bodyStrong'
  | 'input'
  | 'button'
  | 'label'
  | 'small'
  | 'caption'
  | 'chip'
  | 'tag'
  | 'micro'
  | 'overline'
  | 'tab'
  | 'tabActive'
  | 'tabSmall'
  | 'pageTitle'
  | 'sectionTitle';

export type TypeScale = Record<TypeRole, TextStyle>;

const font = (
  fontWeight: TextStyle['fontWeight'],
  fontSize: number,
  lineHeight: number,
  letterSpacing = 0,
): TextStyle => ({ fontWeight, fontSize, lineHeight, letterSpacing });

export const type: TypeScale = {
  /** Splash wordmark, screen-owning numbers. (T.display) */
  display: font('700', 34, 40, -0.8),
  /** "MetroMatrix" at the top of the auth screens. */
  logo: font('700', 28, 34),
  /** Page title inside content. (T.title) */
  h1: font('700', 26, 32, -0.5),
  /** Auth screen titles: "Welcome Back", "Get Started". */
  screenTitle: font('600', 24, 30),
  /** Section heading. (T.heading) */
  h2: font('600', 20, 26, -0.3),
  /** Home section titles: "Our Services" (FYP userHome sectionTitle). */
  heading: font('700', 22, 28, -0.3),
  /** The title set on a service card's photo (FYP userHome cardTitle). */
  cardTitle: font('700', 20, 26),
  /** The app bar's title. (T.barTitle) */
  barTitle: font('600', 18, 24),
  /** Card title and list-row primary line. (T.subhead) */
  title: font('600', 16, 22),
  /** Body copy. (T.body) */
  body: font('400', 14, 20),
  /** Emphasis. (T.bodyStrong) */
  bodyStrong: font('600', 14, 20),
  /** Text typed into an input (FYP auth inputs). */
  input: font('400', 15, 20),
  /** Primary button labels (FYP auth buttons). */
  button: font('600', 16, 20),
  /** Field labels (FYP auth labels). */
  label: font('500', 14, 20),
  /** Control labels, chips, links. (T.label) */
  small: font('500', 13, 18),
  /** Metadata, timestamps, helper text. (T.caption) */
  caption: font('400', 12, 16),
  /** Pill chips: "3 Available", "Explore" (FYP userHome countText / exploreText). */
  chip: font('600', 12, 16),
  /** Uppercase photo badges: RETAIL, MEDICAL (FYP userHome categoryText, 0.5 tracking). */
  tag: font('700', 10, 12, 0.5),
  /** Counters and badges only. (T.micro) */
  micro: font('600', 11, 14),
  /** Menu section titles, set in capitals: ACCOUNT, HEALTH (the FYP profile's sectionTitle). */
  overline: { ...font('700', 11, 14, 0.8), textTransform: 'uppercase' },
  /** Service tab bars: the FYP Health bar's 11 pt labels, bolder when selected; Shopping's 10 pt bold. */
  tab: font('500', 11, 14, 0.1),
  tabActive: font('700', 11, 14, 0.1),
  tabSmall: font('700', 10, 12),
  /** The module page header's title (the FYP's bold white header title). */
  pageTitle: font('800', 24, 30, -0.5),
  /** A page's section heads: "Find by specialty", "Featured brands" (the FYP's 19 / 800). */
  sectionTitle: font('800', 19, 24, -0.4),
};

/** Dynamic type is honoured up to 130% — beyond that fixed-height controls clip. */
export const MAX_FONT_SCALE = 1.3;

/** Healthcare's booking and appointment screens wrap to 150% (the clinical scale). */
export const CLINICAL_FONT_SCALE = 1.5;

/**
 * The same system face for raw DOM controls on web (the date input), which
 * do not inherit React Native Web's text font by themselves.
 */
export const WEB_SYSTEM_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
