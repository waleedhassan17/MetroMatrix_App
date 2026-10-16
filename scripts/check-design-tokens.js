#!/usr/bin/env node
/**
 * Fails the build on hardcoded type or colour in the UI.
 *
 * Ported from FinMatrix. It is its own step rather than an ESLint rule so it
 * can gate CI on its own; the matching ESLint rule in .eslintrc.js gives the
 * same feedback in the editor.
 *
 * What it bans in src/screens, src/components, src/Custom-Components and
 * src/navigators:
 *   fontSize: 14            -> a type role          (...type.body)
 *   fontWeight: '600'       -> a type role
 *   fontFamily: 'Roboto'    -> a type role (src/theme/typography.ts)
 *   '#1B2A41' / rgba(...)   -> a colour token       (colors.brand)
 *   lineHeight / letterSpacing literals            -> a type role
 *   borderRadius: 12        -> radius.md
 *   padding: 16, gap: 8     -> space.s16, space.s8
 *   shadowRadius / elevation literals             -> elevation.float
 * and rule 8 of CLAUDE.md:
 *   expo-linear-gradient    (no gradients as surfaces)
 *   emoji anywhere in UI code
 *   ActivityIndicator in src/screens (content loads with Skeleton)
 *
 * Tokens are DEFINED in src/theme/**, which is outside the scanned roots.
 * ALLOWED lists deliberate exceptions inside them; each needs a reason.
 */
const fs = require('fs');
const path = require('path');

const ROOTS = ['src/screens', 'src/components', 'src/Custom-Components', 'src/navigators'];

const ALLOWED = new Map([
  // ['src/path/File.tsx', 'reason this file may hold raw values'],
  [
    'src/Custom-Components/PhotoScrim.tsx',
    'the legibility scrim over service photos (both colours are theme tokens) — imagery, not a surface',
  ],
  [
    'src/screens/Dev/DesignGallery/ShoppingStories.tsx',
    'demo STORE brand colours (data a store chooses, painted only through StoreBrandScope) — dev-only gallery',
  ],
  [
    'src/Custom-Components/PageHeader.tsx',
    "the FYP's module-page header the owner asked for on Shopping and Health (theme.header.gradient, AA-tested stops)",
  ],
  [
    'src/Custom-Components/ServiceTabBar.tsx',
    "the FYP Health tab bar's selected-icon pill (theme.tabBar.gradient: the service's highlight → accent) — a 40×32 marker, not a surface",
  ],
  [
    'src/screens/Onboarding/OnboardingScreen.tsx',
    "the onboarding preview card's header gradient, copied from the FYP app (its colours still come from the theme)",
  ],
]);

const RULES = [
  { re: /fontSize:\s*\d/g, msg: 'hardcoded fontSize — use a type role' },
  { re: /lineHeight:\s*\d/g, msg: 'hardcoded lineHeight — use a type role' },
  { re: /letterSpacing:\s*-?\d/g, msg: 'hardcoded letterSpacing — use a type role' },
  { re: /borderRadius:\s*[1-9]/g, msg: 'hardcoded borderRadius — use radius.*' },
  {
    re: /\b(margin|padding)(Top|Bottom|Left|Right|Horizontal|Vertical|Start|End)?:\s*-?[1-9]/g,
    msg: 'hardcoded spacing — use space.*',
  },
  { re: /\b(gap|rowGap|columnGap):\s*[1-9]/g, msg: 'hardcoded gap — use space.*' },
  { re: /\b(shadowRadius|shadowOpacity):\s*[0-9.]/g, msg: 'hardcoded shadow — use elevation.*' },
  { re: /\belevation:\s*[1-9]/g, msg: 'hardcoded elevation — use elevation.*' },
  { re: /\b(rgba?|hsla?)\(/g, msg: 'hardcoded colour function — use a colour token' },
  { re: /(expo|react-native)-linear-gradient/g, msg: 'gradient import — no gradients as surfaces (rule 8)' },
  {
    re: /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/gu,
    msg: 'emoji — no emoji in UI copy (rule 8)',
  },
  {
    re: /\bActivityIndicator\b/g,
    msg: 'spinner in a screen — load content with Skeleton (rule 8)',
    roots: ['src/screens'],
  },
  { re: /fontWeight:\s*'\d00'/g, msg: 'hardcoded fontWeight — use a type role' },
  { re: /fontFamily:\s*'[^']+'/g, msg: 'hardcoded fontFamily — use a type role' },
  // Both quote styles: matching only single quotes lets every JSX attribute
  // (`color="#8B5CF6"`) through.
  { re: /'#[0-9A-Fa-f]{3,8}'/g, msg: 'hardcoded colour — use a colour token' },
  { re: /"#[0-9A-Fa-f]{3,8}"/g, msg: 'hardcoded colour — use a colour token' },
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') walk(full, out);
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const findings = [];
for (const root of ROOTS) {
  if (!fs.existsSync(root)) continue;
  for (const file of walk(root)) {
    if (ALLOWED.has(file)) continue;
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      // A commented-out line is not shipped code.
      if (/^\s*(\/\/|\*)/.test(line)) return;
      for (const { re, msg, roots } of RULES) {
        if (roots && !roots.some(r => file.startsWith(r))) continue;
        re.lastIndex = 0;
        if (re.test(line)) findings.push({ file, line: i + 1, msg, text: line.trim() });
      }
    });
  }
}

if (findings.length === 0) {
  console.log('Design tokens: clean.');
  process.exit(0);
}

console.error(`Design tokens: ${findings.length} hardcoded value(s).\n`);
for (const f of findings) {
  console.error(`  ${f.file}:${f.line}  ${f.msg}`);
  console.error(`    ${f.text.slice(0, 100)}`);
}
console.error(
  '\nEvery value comes from src/theme (useTheme()). If a value genuinely belongs\n' +
    'outside the system, add the file to ALLOWED in this script with a reason.',
);
process.exit(1);
