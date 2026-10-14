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
 *   '#1B2A41'               -> a colour token       (colors.brand)
 *
 * Tokens are DEFINED in src/theme/**, which is outside the scanned roots.
 * ALLOWED lists deliberate exceptions inside them; each needs a reason.
 */
const fs = require('fs');
const path = require('path');

const ROOTS = ['src/screens', 'src/components', 'src/Custom-Components', 'src/navigators'];

const ALLOWED = new Map([
  // ['src/path/File.tsx', 'reason this file may hold raw values'],
]);

const RULES = [
  { re: /fontSize:\s*\d/g, msg: 'hardcoded fontSize — use a type role' },
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
      for (const { re, msg } of RULES) {
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
