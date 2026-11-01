#!/usr/bin/env node
// Real staff Kitchen answers (and the kitchen's busier screens) for the serializer fixtures.
//
//   BACKEND=~/MetroMatix-NestJS node scripts/capture-kitchen-staff-fixtures.js serializers/__tests__/fixtures/kitchen/staff.json
//   PROBE_LOG=<an earlier probe.jsonl> node scripts/capture-kitchen-staff-fixtures.js <out.json>
//
// Staff sign in with an authenticator, so this never touches a real account:
// it runs the backend's own Kitchen e2e specs on their throwaway database
// (metromatrix_test, which they create and drop) with RESPONSE_PROBE_LOG set.
// The probe (test/utils/response-probe.ts) records up to 4 successful answers
// per route under RESPONSE_PROBE_PREFIXES; this keeps the staff Kitchen tools
// and the vendor routes whose answers the demo kitchens can't fill (a forecast
// after the nightly job, review themes, tiffins with deliveries), scrubbed
// (emails), lists trimmed to 3 rows. Needs the backend's Postgres up
// (docker compose up -d), and no other e2e run at the same time.

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BACKEND = process.env.BACKEND;
const OUT = process.argv[2];
let log = process.env.PROBE_LOG;
if ((!BACKEND && !log) || !OUT) {
  console.error('usage: BACKEND=<MetroMatix-NestJS checkout> | PROBE_LOG=<probe.jsonl> node scripts/capture-kitchen-staff-fixtures.js <out.json>');
  process.exit(2);
}

const PREFIXES = ['/admin/', '/food/vendor/', '/food/surplus', '/food/tiffin', '/food/catering', '/food/me/', '/my-kitchen/', '/ai/'];
const SPECS = ['kitchen-', 'growth-', 'nutrition', 'my-kitchen', 'ai-voice', 'qa-matrix-kitchen'];

if (!log) {
  log = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'kitchen-staff-')), 'probe.jsonl');
  const env = { ...process.env, RESPONSE_PROBE_LOG: log, RESPONSE_PROBE_PREFIXES: PREFIXES.join(',') };
  // The e2e setup refuses anything but a *_test database; DATABASE_URL would bypass that check.
  delete env.DATABASE_URL;
  const run = spawnSync('npx', ['jest', '--config', 'test/jest-e2e.json', '--runInBand', ...SPECS], { cwd: BACKEND, env, stdio: 'inherit' });
  if (run.status !== 0) {
    console.error('the e2e specs failed; nothing written');
    process.exit(run.status ?? 1);
  }
}

/** The staff Kitchen tools, and the kitchen's screens the demo data leaves thin. */
const KEEP = [
  /^[A-Z]+ \/admin\/(kitchen|nutrition|ai)\//,
  /^[A-Z]+ \/admin\/food\/(hygiene|calendar-events|signatures|demand-map|lookup)/,
  /^GET \/food\/vendor\/kitchen\/(forecast|prep-sheet|shopping-list|review-insights|eta-accuracy|menu-engineering|portions)/,
  /^GET \/food\/vendor\/tiffin\/(tomorrow|subscriptions)/,
  /^GET \/food\/vendor\/(demand-map|demand-curve|storefront)/,
];

const scrub = v => {
  if (Array.isArray(v)) return v.slice(0, 3).map(scrub);
  if (!v || typeof v !== 'object') return typeof v === 'string' && /@/.test(v) && /^\S+@\S+\.\S+$/.test(v) ? 'someone@example.com' : v;
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, /secret|apiKey|signature$/i.test(k) && typeof x === 'string' ? '…' : scrub(x)]));
};

const out = {};
for (const line of fs.readFileSync(log, 'utf8').split('\n').filter(Boolean)) {
  const { route, status, data } = JSON.parse(line);
  if (!KEEP.some(re => re.test(route))) continue;
  (out[route] ??= []).push({ status, body: { success: true, data: scrub(data) } });
}
fs.writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
console.log(`${Object.keys(out).length} routes → ${OUT}`);
