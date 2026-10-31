#!/usr/bin/env node
// Real staff (/admin/shop) responses for the serializer fixtures.
//
//   BACKEND=~/MetroMatix-NestJS node scripts/capture-shop-staff-fixtures.js serializers/__tests__/fixtures/shop/staff.json
//
// Staff sign in with an authenticator, so this never touches a real account:
// it runs the backend's own Shopping staff e2e specs (shop-admin,
// qa-matrix-shopping) on their throwaway database (metromatrix_test, which
// they create and drop) with RESPONSE_PROBE_LOG set. The probe
// (test/utils/response-probe.ts) records up to 4 successful answers per
// /admin route; this keeps the /admin/shop ones, scrubbed (emails), lists
// trimmed to 3 rows. Needs the backend's Postgres up (docker compose up -d).

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BACKEND = process.env.BACKEND;
const OUT = process.argv[2];
if (!BACKEND || !OUT) {
  console.error('usage: BACKEND=<MetroMatix-NestJS checkout> node scripts/capture-shop-staff-fixtures.js <out.json>');
  process.exit(2);
}

const log = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'shop-staff-')), 'probe.jsonl');
const env = { ...process.env, RESPONSE_PROBE_LOG: log };
// The e2e setup refuses anything but a *_test database; DATABASE_URL would bypass that check.
delete env.DATABASE_URL;
const run = spawnSync('npm', ['run', 'test:e2e', '--', 'shop-admin', 'qa-matrix-shopping'], { cwd: BACKEND, env, stdio: 'inherit' });
if (run.status !== 0) {
  console.error('the e2e specs failed; nothing written');
  process.exit(run.status ?? 1);
}

const scrub = v => {
  if (Array.isArray(v)) return v.slice(0, 3).map(scrub);
  if (!v || typeof v !== 'object') return typeof v === 'string' && /@/.test(v) && /^\S+@\S+\.\S+$/.test(v) ? 'someone@example.com' : v;
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, scrub(x)]));
};

const out = {};
for (const line of fs.readFileSync(log, 'utf8').split('\n').filter(Boolean)) {
  const { route, status, data } = JSON.parse(line);
  if (!/^[A-Z]+ \/admin\/shop\//.test(route)) continue;
  (out[route] ??= []).push({ status, body: { success: true, data: scrub(data) } });
}
fs.writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
console.log(`${Object.keys(out).length} staff routes → ${OUT}`);
