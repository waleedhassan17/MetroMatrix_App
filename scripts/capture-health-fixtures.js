// Captures real Healthcare responses (MetroMatrix-API docs/API_HEALTH.md) from a
// local, seeded backend as the app's serializer fixture:
//   BACKEND=~/MetroMatix-NestJS node scripts/capture-health-fixtures.js \
//     serializers/__tests__/fixtures/health/real.json
// The backend must run on :3000 with `npm run seed:health` applied; the run books,
// moves, completes and cancels demo appointments in that (local) database. Credentials
// come from its git-ignored Postman environment and are never printed. The
// output is scrubbed (tokens, signatures, the cloud name, IBANs, emails) and
// shortened (at most 3 rows per list) before it is written.
const fs = require('fs');
const crypto = require('crypto');
const BACKEND = process.env.BACKEND;
const OUT = process.argv[2];
const { authenticator } = require(BACKEND + '/node_modules/otplib');
const env = Object.fromEntries(
  JSON.parse(fs.readFileSync(BACKEND + '/postman/MetroMatrix-Local.postman_environment.local.json')).values.map(v => [v.key, v.value]),
);
const BASE = 'http://localhost:3000/api/v1';
const out = {};
let cloud = null;

async function call(method, path, { token, body, key } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (key) headers['Idempotency-Key'] = key;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}
const save = (name, res) => {
  out[name] = { status: res.status, body: res.body };
  return res.body && res.body.data;
};
const must = (name, res, status = 200) => {
  if (res.status !== status) throw new Error(`${name}: ${res.status} ${JSON.stringify(res.body).slice(0, 300)}`);
  return save(name, res);
};
const signin = async (email, password, portal) => {
  for (let i = 0; i < 8; i++) {
    const r = await call('POST', '/auth/signin', { body: { email, password, portal } });
    if (r.status === 429) { await new Promise(res => setTimeout(res, 15000)); continue; }
    if (r.status !== 200) throw new Error(`signin ${portal}: ${r.status}`);
    return r.body.data;
  }
  throw new Error('signin: rate limited');
};

(async () => {
  // ── Guests: discovery ──
  const home = must('home', await call('GET', '/health/home?city=Lahore'));
  must('specialties', await call('GET', '/health/specialties?city=Lahore'));
  must('conditions', await call('GET', '/health/conditions?q=pimples'));
  must('suggest', await call('GET', '/health/search/suggest?q=skin'));
  const derms = must('doctors', await call('GET', '/health/doctors?specialty=dermatologist&city=Lahore&pageSize=5'));
  const patient = await signin('demo.patient1@metromatrix.test', env.demoPassword, 'customer');
  const pt = patient.tokens.accessToken;
  const doctorAuth = await signin('demo.dr01@metromatrix.test', env.demoPassword, 'partner');
  const dt = doctorAuth.tokens.accessToken;
  const me = must('doctorProfile', await call('GET', '/health/doctor/profile', { token: dt }));
  const profile = must('profile', await call('GET', `/health/doctors/${me.id}`));
  must('similar', await call('GET', `/health/doctors/${me.id}/similar`));
  const clinic = profile.locations.find(l => l.kind === 'clinic');
  const slots = must('slots', await call('GET', `/health/doctors/${me.id}/locations/${clinic.id}/slots?days=3`));
  must('reviews', await call('GET', `/health/doctors/${me.id}/reviews?pageSize=3`));

  // ── Patient: family, booking, the slot race, reschedule, cancel ──
  must('family', await call('GET', '/health/family-members', { token: pt }));
  const free = slots.days.flatMap(d => d.slots).map(s => s.startsAt);
  const booked = must(
    'book',
    await call('POST', '/health/appointments', {
      token: pt,
      key: crypto.randomUUID(),
      body: { doctorId: me.id, locationId: clinic.id, startsAt: free[1], reason: 'Acne for six months', symptoms: ['pimples'] },
    }),
    201,
  );
  const other = await signin('demo.patient2@metromatrix.test', env.demoPassword, 'customer');
  save(
    'slotTaken',
    await call('POST', '/health/appointments', {
      token: other.tokens.accessToken,
      key: crypto.randomUUID(),
      body: { doctorId: me.id, locationId: clinic.id, startsAt: free[1] },
    }),
  );
  must('appointment', await call('GET', `/health/appointments/${booked.code}`, { token: pt }));
  must('appointments', await call('GET', '/health/appointments?scope=upcoming&pageSize=3', { token: pt }));
  must('homeSignedIn', await call('GET', '/health/home?city=Lahore', { token: pt }));
  const moved = must(
    'reschedule',
    await call('POST', `/health/appointments/${booked.code}/reschedule`, { token: pt, key: crypto.randomUUID(), body: { startsAt: free[3] } }),
    200,
  );
  // Book another to cancel, and one to take through a visit.
  must('cancel', await call('POST', `/health/appointments/${moved.code}/cancel`, { token: pt, body: { reason: 'Feeling better' } }), 200);
  const visit = must(
    'bookVisit',
    await call('POST', '/health/appointments', {
      token: pt,
      key: crypto.randomUUID(),
      body: { doctorId: me.id, locationId: clinic.id, startsAt: free[5], reason: 'Follow-up', symptoms: [] },
    }),
    201,
  );
  must('prescriptions', await call('GET', '/health/prescriptions?pageSize=3', { token: pt }));
  must('records', await call('GET', '/health/records?pageSize=3', { token: pt }));
  save('symptomFallback', await call('POST', '/health/symptom-checker', { token: pt, body: { text: 'I have had pimples on my face for months' } }));
  save('symptomEmergency', await call('POST', '/health/symptom-checker', { token: pt, body: { text: 'severe chest pain and I cannot breathe' } }));
  const sign = must('signUpload', await call('POST', '/media/sign-upload', { token: pt, body: { purpose: 'health_record' } }));
  cloud = sign.cloudName;

  // ── Doctor ──
  must('completeness', await call('GET', '/health/doctor/profile/completeness', { token: dt }));
  const locs = must('locations', await call('GET', '/health/doctor/locations', { token: dt }));
  must('schedule', await call('GET', `/health/doctor/locations/${clinic.id}/schedule`, { token: dt }));
  must('timeOffList', await call('GET', '/health/doctor/time-off', { token: dt }));
  const day = visit.startsAt.slice(0, 10);
  save(
    'timeOffConflict',
    await call('POST', '/health/doctor/time-off', {
      token: dt,
      body: { startsAt: `${day}T00:00:00+05:00`, endsAt: `${day}T23:59:00+05:00`, reason: 'Conference' },
    }),
  );
  must('preview', await call('GET', '/health/doctor/availability/preview?days=2', { token: dt }));
  must('paymentAccounts', await call('GET', '/health/doctor/payment-accounts', { token: dt }));
  must('today', await call('GET', '/health/doctor/today', { token: dt }));
  must('doctorAppointments', await call('GET', `/health/doctor/appointments?from=${day}&to=${day}&pageSize=5`, { token: dt }));
  must('doctorAppointment', await call('GET', `/health/doctor/appointments/${visit.code}`, { token: dt }));
  must('checkIn', await call('POST', `/health/doctor/appointments/${visit.code}/check-in`, { token: dt }), 200);
  must('start', await call('POST', `/health/doctor/appointments/${visit.code}/start`, { token: dt }), 200);
  must('notesPut', await call('PUT', `/health/doctor/appointments/${visit.code}/notes`, { token: dt, body: { text: 'Mild acne; no scarring.' } }));
  must('notes', await call('GET', `/health/doctor/appointments/${visit.code}/notes`, { token: dt }));
  must(
    'prescriptionWrite',
    await call('POST', `/health/doctor/appointments/${visit.code}/prescription`, {
      token: dt,
      body: {
        diagnosis: 'Acne vulgaris (mild)',
        advice: 'Gentle cleanser twice a day.',
        followUpInDays: 30,
        medicines: [{ name: 'Doxycycline', strength: '100 mg', form: 'capsule', dosePattern: '1+0+0', timing: 'after_meal', durationDays: 30 }],
        tests: [{ name: 'CBC' }],
      },
    }),
    201,
  );
  must('prescriptionCurrent', await call('GET', `/health/doctor/appointments/${visit.code}/prescription`, { token: dt }));
  must('complete', await call('POST', `/health/doctor/appointments/${visit.code}/complete`, { token: dt, body: { paymentCollected: true } }), 200);
  const done = must('doctorAppointmentDone', await call('GET', `/health/doctor/appointments/${visit.code}`, { token: dt }));
  const pats = must('patients', await call('GET', '/health/doctor/patients?pageSize=3', { token: dt }));
  must('patientHistory', await call('GET', `/health/doctor/patients/${done.patientKey}`, { token: dt }));
  must('insights', await call('GET', '/health/doctor/insights?range=7d', { token: dt }));
  must('doctorReviews', await call('GET', '/health/doctor/reviews?pageSize=3', { token: dt }));
  must('doctorReviewSummary', await call('GET', '/health/doctor/reviews/summary', { token: dt }));
  must('medicines', await call('GET', '/health/doctor/medicines/suggest?q=para', { token: dt }));
  must('diagnoses', await call('GET', '/health/doctor/diagnoses/recent', { token: dt }));
  must('doctorBusiness', await call('GET', '/businesses/me', { token: dt }));
  const other2 = locs.find(l => l.kind === 'clinic' && l.id !== clinic.id) ?? locs.find(l => l.id !== clinic.id);
  const week = (await call('GET', `/health/doctor/locations/${clinic.id}/schedule`, { token: dt })).body.data;
  if (other2) {
    const ranges = (Array.isArray(week) ? week : week.ranges ?? week.days ?? []).flatMap(d =>
      (d.ranges ?? [d]).map(r => ({ weekday: d.weekday, start: r.start, end: r.end })),
    );
    save('scheduleOverlap', await call('PUT', `/health/doctor/locations/${other2.id}/schedule`, { token: dt, body: ranges }));
  }

  // ── Patient after the visit ──
  must(
    'review',
    await call('POST', `/health/appointments/${visit.code}/review`, {
      token: pt,
      body: { overall: 5, diagnosis: 5, staff: 4, environment: 4, recommend: true, tags: ['explained_well'], text: 'Clear and kind.' },
    }),
    201,
  );
  must('appointmentDone', await call('GET', `/health/appointments/${visit.code}`, { token: pt }));
  const rxs = (await call('GET', '/health/prescriptions?pageSize=1', { token: pt })).body.data;
  if (rxs.items[0]) must('prescription', await call('GET', `/health/prescriptions/${rxs.items[0].id}`, { token: pt }));
  must('notifications', await call('GET', '/notifications?pageSize=5', { token: pt }));
  must('doctorNotifications', await call('GET', '/notifications?pageSize=5', { token: dt }));

  // ── Video (a doctor with video) ──
  const video = derms.items.find(c => c.offersVideo) ?? (await call('GET', '/health/doctors?kind=video&pageSize=1')).body.data.items[0];
  const vProfile = (await call('GET', `/health/doctors/${video.id}`)).body.data;
  const vLoc = vProfile.locations.find(l => l.kind === 'video');
  const vSlots = (await call('GET', `/health/doctors/${video.id}/locations/${vLoc.id}/slots?days=3`)).body.data;
  const vFree = vSlots.days.flatMap(d => d.slots).map(s => s.startsAt);
  const vBook = must(
    'bookVideo',
    await call('POST', '/health/appointments', { token: pt, key: crypto.randomUUID(), body: { doctorId: video.id, locationId: vLoc.id, startsAt: vFree[vFree.length - 1] } }),
    201,
  );
  save('videoTooEarly', await call('POST', `/health/appointments/${vBook.code}/video/join`, { token: pt }));
  await call('POST', `/health/appointments/${vBook.code}/cancel`, { token: pt, body: { reason: 'Capture clean-up' } });

  // ── Staff ──
  const challenge = (await signin(env.adminEmail, env.adminPassword, 'admin')).challengeToken;
  const a2 = await call('POST', '/auth/admin/totp', { body: { challengeToken: challenge, code: authenticator.generate(env.adminTotpSecret) } });
  if (a2.status !== 200) throw new Error('admin totp ' + a2.status);
  const at = a2.body.data.tokens.accessToken;
  must('adminOverview', await call('GET', '/admin/health/overview', { token: at }));
  must('adminSpecialties', await call('GET', '/admin/health/specialties', { token: at }));
  must('adminConditions', await call('GET', '/admin/health/conditions?q=acne', { token: at }));
  must('adminDoctors', await call('GET', '/admin/health/doctors?pageSize=2', { token: at }));
  must('adminReviews', await call('GET', '/admin/health/reviews?pageSize=2', { token: at }));
  must('adminAppointment', await call('GET', `/admin/health/appointments/${visit.code}`, { token: at }));
  must('adminBanners', await call('GET', '/admin/health/banners', { token: at }));
  must('adminBusiness', await call('GET', `/admin/businesses/${done.doctor ? '' : ''}${(await call('GET', '/businesses/me', { token: dt })).body.data.id}`, { token: at }));

  // Scrub anything account-specific before it becomes a committed fixture.
  let s = JSON.stringify(out);
  if (cloud) s = s.split(cloud).join('demo-cloud');
  s = s.replace(/"(signature|apiKey|timestamp)":\s*("[^"]*"|\d+)/g, '"$1": "redacted"');
  s = s.replace(/(https:\/\/api\.cloudinary\.com\/v1_1\/[^"?]+\/download)\?[^"]*/g, '$1?redacted');
  s = s.replace(/\/s--[A-Za-z0-9_-]{8}--\//g, '/s--redacted--/');
  s = s.replace(/"(accessToken|refreshToken|challengeToken|jwt)":\s*"[^"]*"/g, '"$1": "redacted"');
  s = s.replace(/PK\d{2}[A-Z]{4}\d{16}/g, 'PK00DEMO0000000000000000');
  s = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/g, 'someone@example.test');
  // Short lists keep the fixture small; whole weeks and star counts stay whole.
  const WHOLE = new Set(['distribution', 'perDay', 'ranges', 'days', 'events', 'timings', 'ratingTrend', 'schedule']);
  const trim = (v, key) => {
    if (Array.isArray(v)) {
      const rows = v.some(x => x && typeof x === 'object') ? v.slice(0, WHOLE.has(key) ? 7 : 3) : v;
      return rows.map(x => trim(x));
    }
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, trim(x, k)]));
    return v;
  };
  fs.writeFileSync(OUT, JSON.stringify(trim(JSON.parse(s)), null, 1) + '\n');
  console.log('captured', Object.keys(out).length, 'responses');
})().catch(e => {
  console.error('capture failed:', e.message);
  process.exit(1);
});
