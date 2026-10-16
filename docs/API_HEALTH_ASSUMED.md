# MetroMatrix API — Chunk 3 contract (Healthcare), ASSUMED

The real `MetroMatrix-API/docs/API_HEALTH.md` does not exist yet: the backend's Healthcare module isn't built. The app is built on this document instead, and the dummy API (`src/networks/network/mock/health/`) implements every line of it. Every dependency in the app is marked `TODO(API_HEALTH)`. When the real document arrives, reconcile networks, serializers and models in one pass. Screens and slices stay as they are.

It follows the conventions of the real `API_SHOPPING.md` and `API_AUTH.md`:

| Rule | What it means |
|---|---|
| Base | `https://<host>/api/v1`. Patients and public reads under **`/healthcare`**, the doctor partner under **`/healthcare/doctor`**, staff under **`/admin/healthcare`**. `/health` stays the server's uptime check. |
| Envelope | `{ success: true, data }` / `{ success: false, error: { code, message, details? } }`. Branch on `error.code`. |
| Lists | `data: { items, total, page, pageSize }`; query `?page=1&pageSize=20` (max 100). |
| Optional auth | Discovery routes work signed out. With a token, `/healthcare/home` adds the patient's `upcoming` appointment. |
| Patient routes | Role `customer` with a verified email, else `403 FORBIDDEN` / `403 EMAIL_NOT_VERIFIED`. |
| Doctor routes | Role `partner`, business **approved**, service **healthcare**. Others get `403 BUSINESS_NOT_APPROVED`, `BUSINESS_SUSPENDED` or `WRONG_SERVICE` (`details: { required: "healthcare", actual }`). |
| Isolation | Another patient's appointment, record or family member, and another doctor's appointment, patient or prescription, is **`404 NOT_FOUND`**, never 403. |
| Validation | `400 VALIDATION_FAILED` with `details.fields: { field: [message] }`. A state change that isn't allowed is `409 INVALID_TRANSITION`. |
| Money | Whole rupees (integer). Fees come from the server; a fee sent by the app is ignored. MetroMatrix never holds money: patients pay the doctor at the visit or by transfer to the doctor's own account. Doctor screens say "Recorded fees", never earnings. |
| Time | ISO-8601 UTC instants named `…At`. Every location has a `timezone` (`Asia/Karachi`); the app shows times in that zone. Days (`YYYY-MM-DD`, weekly hours, time off) are the location's local days. |
| Flags | The server computes every action flag (`canCancel`, `canReschedule`, `canJoinVideo`, `canReview`, `canPay`, the doctor's `actions`). The app never derives business rules from dates. |
| Idempotency | `POST /healthcare/appointments` **requires** `Idempotency-Key` (a fresh UUID per attempt, reused for its retries). A retry replays the first response; one still running gets `409 IDEMPOTENCY_IN_PROGRESS`; missing gives `400 IDEMPOTENCY_KEY_REQUIRED`. |
| Uploads | `POST /media/sign { purpose }` (Chunk 1's assumed path; the real API names it `/media/sign-upload`). Health purposes: `health_record` (patient; images and PDF), `doctor_photo`, `consult_attachment` (doctor), and `payment_proof` (shared with Shopping). |

---

## 1. Shapes

### `DoctorCard`
```json
{
  "id": "d_ayesha", "name": "Dr. Ayesha Siddiqui", "photoUrl": null, "gender": "female",
  "specialty": { "slug": "dermatologist", "name": "Dermatologist", "nameUr": "ماہر امراض جلد" },
  "qualifications": "MBBS, FCPS (Dermatology)", "yearsExperience": 13,
  "rating": 4.8, "reviewCount": 39, "waitMinutes": 6,
  "badges": ["pmdc_verified", "top_booked"],
  "offersVideo": true, "offersClinic": true, "fromFee": 2000,
  "availability": { "label": "Available today, 9:30 PM", "today": true, "nextAt": "2026-10-15T16:30:00Z" },
  "city": "Lahore"
}
```
`rating` and `waitMinutes` are measured: `null` until there are at least 3 data points. Wait is check-in to start. `availability.label` is the server's wording.

### `PracticeLocation` (each row of "Choose how to see the doctor")
```json
{
  "id": "loc_ayesha_2", "kind": "clinic", "name": "Skin and Laser Clinic", "area": "DHA Phase 6", "city": "Lahore",
  "address": "7-C Commercial Area, DHA Phase 6, Lahore", "lat": 31.4697, "lng": 74.4513, "phone": "+924235790011",
  "fee": 3000, "slotMinutes": 20, "instructions": "First floor. Please arrive 10 minutes early.",
  "timezone": "Asia/Karachi",
  "availability": { "label": "Available tomorrow, 4:00 PM", "today": false, "nextAt": "…" },
  "timings": [{ "days": "Mon – Sat", "hours": "4:00 PM – 8:00 PM" }],
  "requiresPrepay": false
}
```
Video is one of the rows (`kind: "video"`; `area` empty; `requiresPrepay` true when the doctor asks for a transfer before the consult).

### `DoctorProfile` = `DoctorCard` +
`title`, `about`, `languages[]`, `services[]`, `conditions[{ slug, name }]`, `qualificationList[{ degree, institute, year }]`, `experienceList[{ role, place, from, to|null }]`, `locations[]` (video first), `stats { satisfactionPct, waitMinutes, timeWithPatientMinutes, reviewCount }` (each may be null), `reviewSummary`, `topReviews[3]`, `similar[DoctorCard]`, `bookingRules { windowDays, minNoticeMinutes, cancelCutoffHours, videoPrepay }`.

### `ReviewSummary`
`{ average, count, recommendPct, distribution[5] (1★…5★), dimensions[{ key: diagnosis|staff|environment, label, score }], tags[{ label, count }] }`. A dimension appears once it has at least 3 scores.

### `Review`
`{ id, authorName, rating, kind: video|clinic, tags[], text|null, recommend, createdAt, reply: { text, createdAt }|null, isHidden, replyEditableUntil|null, doctorName|null }`. `authorName` is initials ("A. K.") when the review was posted anonymously, which is the default. `replyEditableUntil` appears on the doctor's own list only; `doctorName` on staff's moderation list only.

### `Appointment` (summary) and `AppointmentDetail`
Summary:
- `id`, `code` (`HC-7KQ2MZ`), `status`, `kind`, `startAt`, `endAt`, `timezone`
- `doctor { id, name, photoUrl, specialty }`
- `location { id, kind, name, area, city, address, lat, lng, phone, instructions }`
- `patientName`, `fee`, `paymentStatus`
- `canJoinVideo`, `canPay`, `canReview`, `joinOpensAt` (video only)

Detail adds:
- `patient { familyMemberId, name, relation, age, gender }`
- `reasonTags[follow_up|new_problem|reports_review]`, `reason`, `records[HealthRecord]`
- `payment { method: pay_at_visit|transfer, status, amount, instructions: PaymentInstructions|null, proof: PaymentProof|null }`. The `PaymentInstructions` and `PaymentProof` shapes are Shopping's.
- `timeline[{ type, note, createdAt }]`
- `flags { canCancel, canReschedule, canJoinVideo, canReview, canPay, canAttachRecords }`
- `isLateCancel`, `lateCancelNote`, `cancelReason`, `rescheduleCount`, `prescriptionId`, `reviewed`

### `Prescription`
- `id`, `appointmentCode`, `doctorId`, `locationId`, `kind`
- `doctor { name, specialtyName, qualifications, pmdcNumber, place, phone }`
- `patient { name, age, gender }`
- `issuedAt`, `diagnosis`, `followUpInDays|null`, `editableUntil` (`issuedAt + 24 h`)
- `medicines[{ name, strength, form: tablet|capsule|syrup|injection|drops|cream|inhaler|other, dose: "1+0+1", timing: before_meal|after_meal|with_meal|bedtime|as_needed|null, days, instructions }]`
- `tests[]`, `advice`

`dose` is morning + afternoon + night; halves are written `0.5`.

## 2. State machines

**Appointment:**

| Status | Comes from | Meaning |
|---|---|---|
| `awaiting_payment` | booking with `transfer` | The patient sends the fee by `payment.instructions.payBy`, the sooner of 3 h after booking and 15 min before the start. Unpaid by then → `cancelled` by `system`, and the slot is freed. |
| `confirmed` | booking with `pay_at_visit`, or the doctor confirming a transfer | |
| `checked_in` | `confirmed` (clinic) | `checkedInAt` starts the waiting timer |
| `in_progress` | `checked_in`, or `confirmed` (video, inside the join window) | |
| `completed` | `in_progress` | |
| `cancelled` | `awaiting_payment` or `confirmed`, before the start | By the patient (late when inside `cancelCutoffHours`), the doctor (with a reason), or `system` |
| `no_show` | `confirmed` or `checked_in` | 10 min after the start |

**Payment:** `pay_at_visit` → `collected` (the doctor ticks "Payment collected" on Complete). `awaiting_transfer` → `proof_submitted` → `paid`, or `proof_rejected` (with `proof.rejectionReason`, deadline extended by at least an hour) → `proof_submitted` again.

**Video:** the room opens `10 min` before the start and closes `30 min` after the end. `POST …/video/join` outside the window answers `403 VIDEO_NOT_OPEN { opensAt }`.

## 3. Endpoints

### 3.1 Discovery (public, optional auth)

| Method | Path | Query / body | Response |
|---|---|---|---|
| GET | `/healthcare/home` | `city?` (default: the patient's default address city, else Lahore) | `{ city, cities[], specialties[8], commonConditions[], availableToday[DoctorCard ≤10], upcoming: Appointment\|null, emergencyNumbers[{ label, number }] }` |
| GET | `/healthcare/specialties` | `city?` | `Specialty[] { id, slug, name, nameUr, icon, doctorCount }` |
| GET | `/healthcare/conditions` | `q?` (matches name, Urdu name and aliases) | `Condition[] { id, slug, name, nameUr, specialtySlug, isCommon }` |
| GET | `/healthcare/search/suggest` | `q` | `{ doctors[{ id, name, specialtyName }≤5], specialties[≤5], conditions[≤6] }`. "pimples" → Acne → dermatologists; Urdu input matches Urdu names. |
| GET | `/healthcare/doctors` | `specialty, condition, q, city, kind=video\|clinic, availableToday, gender=female\|male, maxFee, minYears, minRating, language, area, sort=recommended\|earliest\|fee_low\|most_reviewed\|most_experienced, page, pageSize` | page of `DoctorCard`. A doctor serves a city with a clinic there, or anywhere by video. With `kind`, fee and availability are for that kind. |
| GET | `/healthcare/doctors/:id` | | `DoctorProfile` (listed doctors only) |
| GET | `/healthcare/doctors/:id/locations/:locationId/days` | `from?` (`YYYY-MM-DD`), `days` (default 14) | `[{ date, slotCount }]` |
| GET | `/healthcare/doctors/:id/locations/:locationId/slots` | `date` | `{ date, timezone, slots[{ startAt, period: morning\|afternoon\|evening\|night }], nextAvailable: { date, startAt }\|null }` (`nextAvailable` only when the day is empty) |
| GET | `/healthcare/doctors/:id/reviews` | `kind?`, `rating?` (1–5), `sort=recent\|highest\|lowest`, `page` | page of `Review` |

**Free slots** come from:
- the location's weekly hours, cut into `slotMinutes` steps;
- minus time off;
- minus any booked visit of the same doctor at any location (a doctor is in one place at a time);
- minus anything sooner than `minNoticeMinutes`;
- only within `windowDays`.

### 3.2 Patient

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/healthcare/appointments` | `{ doctorId, locationId, startAt, familyMemberId?, reasonTags[], reason?, recordIds[], paymentMethod }` + **Idempotency-Key** | `201 AppointmentDetail` |
| GET | `/healthcare/appointments` | `segment=upcoming\|past`, `page` | page of `Appointment`. Upcoming is soonest first; past is latest first. |
| GET | `/healthcare/appointments/:code` | | `AppointmentDetail` |
| POST | `/healthcare/appointments/:code/cancel` | `{ reason: feeling_better\|schedule_clash\|booked_by_mistake\|other_doctor\|other, note? }` | `AppointmentDetail` |
| POST | `/healthcare/appointments/:code/reschedule` | `{ startAt }` (same location; once) | `AppointmentDetail` |
| POST | `/healthcare/appointments/:code/payment-proof` | `{ transactionId, imageUrl? }` | `AppointmentDetail` |
| POST | `/healthcare/appointments/:code/records` | `{ recordIds[] }` (adds; max 10) | `AppointmentDetail` |
| POST | `/healthcare/appointments/:code/review` | `{ rating 1–5, recommend, dimensions{ diagnosis, staff?, environment? }, tags[], text?, anonymous }` | `201 AppointmentDetail` (once; completed visits from the last 30 days) |
| POST | `/healthcare/appointments/:code/video/join` | | `{ provider: jitsi\|jaas, roomUrl, jwt\|null, displayName, closesAt }` |
| GET / POST | `/healthcare/family` | `{ name, relation: spouse\|child\|parent\|sibling\|other, gender, dateOfBirth, phone? }` | `FamilyMember[]` / `201 FamilyMember` (max 10) |
| PATCH / DELETE | `/healthcare/family/:id` | partial | `FamilyMember` / `{ removed: true }` (`409 MEMBER_HAS_APPOINTMENTS`) |
| GET / POST | `/healthcare/records` | query `memberId? (an id or self), type?, page` / body `{ title, type: lab_report\|prescription\|imaging\|discharge\|other, recordedOn, memberId?, files[{ url, mime }≤10] }` | page of `HealthRecord` / `201 HealthRecord` |
| GET / DELETE | `/healthcare/records/:id` | | `HealthRecord` / `{ removed: true }` |
| GET | `/healthcare/prescriptions` | `page` | page of `{ id, appointmentCode, doctorName, specialtyName, diagnosis, issuedAt, patientName }` |
| GET | `/healthcare/prescriptions/:id` | | `Prescription` |
| POST | `/healthcare/symptoms/check` | `{ text, age, gender }` | `{ emergency, emergencyNumbers[], areas[{ title, body }≤3], specialty: { slug, name, nameUr }\|null, disclaimer }`. Red flags (chest pain, trouble breathing, fainting, heavy bleeding, stroke signs, seizures, self-harm, poisoning) give `emergency: true` with no areas. |

**Booking errors:**

| Code | Status | When |
|---|---|---|
| `SLOT_TAKEN` | 409 | the time is no longer free; `details.alternatives[{ startAt, period }≤3]` are the next free times at the same location |
| `VALIDATION_FAILED` | 400 | the wrong `paymentMethod` (a clinic visit is `pay_at_visit`; a prepaid video is `transfer`), or a family member or record that isn't the patient's |
| `NO_PAYMENT_ACCOUNT` | 422 | `transfer` to a doctor without an active payment account |

### 3.3 Doctor partner (`/healthcare/doctor`)

| Method | Path | Body / query | Response |
|---|---|---|---|
| GET / PATCH | `/profile` | `{ title, name, gender, photoUrl, specialtySlug, secondarySpecialtySlug, practisingSince, languages[], about, qualifications[], experience[], services[], conditionSlugs[], bookingRules }` | own profile `+ { pmdcNumber, isListed }` |
| GET | `/profile/completeness` | | `{ items[{ key: photo\|about\|qualifications\|services\|location\|hours\|preview, label, done }], percent, isListed, canPublish }` |
| POST | `/profile/publish` | | the `Business` (`isListed: true`); `422 PROFILE_INCOMPLETE { missing[] }`, `422 PMDC_NOT_VERIFIED` |
| GET / POST | `/locations` | `{ kind, name, area, city, address?, lat?, lng?, phone?, fee, slotMinutes: 10\|15\|20\|30\|45\|60, instructions?, requiresPrepay? }` | `DoctorLocation[]` (`PracticeLocation + hours[]`) / `201` (one video row at most: `409 VIDEO_EXISTS`) |
| PATCH / DELETE | `/locations/:id` | partial | `DoctorLocation` / `{ removed: true }` (`409 LOCATION_HAS_APPOINTMENTS`) |
| PUT | `/locations/:id/hours` | `{ hours[{ day 1–7, ranges[{ from: "HH:mm", to }] }] }` | `DoctorLocation`. A clash with another location gives `400 VALIDATION_FAILED` with `details.overlaps[{ day, otherLocationName }]`. |
| GET | `/availability/preview` | `days` (default 7) | `{ locations[{ id, name, kind, timezone, days[{ date, slots[startAt] }] }] }`, exactly what patients see. It also ticks the checklist's "preview". |
| GET / POST | `/time-off` | `{ from, to, locationId?, reason?, cancelConflicts? }` | `TimeOff[]` / `201 TimeOff`. Over booked visits: `409 TIME_OFF_CONFLICT { appointments[{ id, code, startAt, timezone, patientName }] }` unless `cancelConflicts: true`, which cancels them and notifies each patient. |
| DELETE | `/time-off/:id` | | `{ removed: true }` |
| GET / POST / PATCH / DELETE | `/payment-accounts[/:id]` | as Shopping's store accounts | max 4 active |
| GET | `/today` | `date?`, `locationId?` | `{ date, timezone, locations[], counts { booked, checkedIn, done, noShow }, queue[QueueItem] }`, ordered by time |
| GET | `/calendar` | `from`, `to` | `{ appointments[{ id, startAt, endAt, timezone, kind, locationId, locationName, patientName, status }], timeOff[], locations[] }` |
| GET | `/appointments/:id` | | `DoctorAppointment`: detail + `patient { id, name, age, gender, phone, visitsWithYou, noShows, lateCancels }`, `previousVisits[]` with this doctor only, `notes { text, attachments[], updatedAt }`, `actions { canCheckIn, canStart, canComplete, canNoShow, canCancel, canConfirmPayment, canWritePrescription, canJoinVideo }`, `prescription` |
| POST | `/appointments/:id/check-in` · `/start` · `/no-show` | | `DoctorAppointment` |
| POST | `/appointments/:id/complete` | `{ paymentCollected }` | `DoctorAppointment` |
| POST | `/appointments/:id/cancel` | `{ reason }` | `DoctorAppointment` (the patient is notified) |
| POST | `/appointments/:id/payment/confirm` · `/payment/reject` | `{ reason }` (reject) | `DoctorAppointment` |
| PUT | `/appointments/:id/notes` | `{ text ≤4000, attachments[≤10] }` | `DoctorAppointment` (private to the doctor) |
| POST | `/appointments/:id/video/join` | | `VideoJoin` |
| POST | `/appointments/:id/prescription` | `{ diagnosis, medicines[], tests[], advice?, followUpInDays? }` | `201 Prescription` (visit `in_progress` or `completed`; one per visit: `409 PRESCRIPTION_EXISTS`). The patient is notified. |
| PATCH | `/prescriptions/:id` | same body | `Prescription`; `409 PRESCRIPTION_LOCKED` after 24 h |
| GET | `/medicines/suggest` | `q` | `[{ name, strength, form, isFavourite }≤12]`, favourites first |
| GET | `/diagnoses/recent` | | `string[≤8]` |
| GET | `/patients` | `q?`, `page` | page of `{ id, name, age, gender, lastVisitAt, visits }`; only the doctor's own patients |
| GET | `/patients/:id/history` | | `{ patient, visits[{ appointmentId, code, startAt, kind, diagnosis, prescriptionId, notes }] }` with this doctor only |
| GET | `/reviews` | `unreplied?`, `page` | page of `Review` |
| GET | `/reviews/summary` | | `ReviewSummary` |
| POST | `/reviews/:id/reply` | `{ text ≤600 }` | `Review` (editable for 24 h: `409 REPLY_LOCKED`) |
| GET | `/insights` | `range=7d\|30d\|90d` | `{ range, perDay[{ date, video, clinic }], outcomes { completed, cancelled, noShow }, avgWaitMinutes, ratingTrend[{ date, rating }], recordedFees, appointments }` |

### 3.4 Admin (`/admin/healthcare`, roles `admin`/`super_admin`)

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/overview` | | `{ listedDoctors, bySpecialty[{ name, count }], bookingsToday, cancelledToday, noShowsToday, pendingVerification }` |
| GET / POST / PATCH / DELETE | `/specialties[/:id]` | `{ name, nameUr, icon, sort }` | `Specialty + sort` (`409 SPECIALTY_EXISTS`, `409 SPECIALTY_IN_USE`) |
| GET / POST / PATCH / DELETE | `/conditions[/:id]` | `{ name, nameUr, specialtySlug, isCommon, aliases[] }`; `q?` on GET | `Condition + aliases` |
| GET | `/doctors` | `status=pending\|all` | `[{ businessId, name, specialty, city, pmdcNumber, pmdcVerified, pmdcNote, pmdcVerifiedAt, status, submittedAt, documents[] }]` |
| POST | `/doctors/:businessId/pmdc-verify` | `{ note }` | the same row |
| GET | `/reviews` | `hidden?`, `page` | page of `Review` (with `doctorName`) |
| POST | `/reviews/:id/hide` · `/unhide` | `{ reason }` (hide) | `Review` |
| GET | `/appointments/:code` | | `AppointmentDetail + doctorBusinessId` (read-only) |

`POST /admin/businesses/:id/approve` (Chunk 1) answers `422 PMDC_NOT_VERIFIED` for a doctor whose PMDC number staff haven't checked.

`Business` (Chunk 1) gains `isListed` and `pmdcVerified` for doctors (`null` for other services). A doctor who is approved but not listed opens the app on Practice setup.

## 4. Notifications (`type` → `data`)

| Type | To | `data` |
|---|---|---|
| `appointment_new` | doctor | `{ appointmentId }` |
| `appointment_payment` | doctor | `{ appointmentId }` |
| `appointment_update` | patient (cancelled, rescheduled, confirmed, missed, completed) or doctor (cancelled or moved by the patient) | `{ appointmentCode }` (patient) / `{ appointmentId }` (doctor) |
| `appointment_reminder` | patient, 24 h and 1 h before | `{ appointmentCode }` |
| `prescription_ready` | patient | `{ prescriptionId, appointmentCode }` |

A tap opens AppointmentDetail (patient) or DoctorAppointment (doctor). The deep links are `metromatrix://health/appointment/:code` and `metromatrix://doctor/appointments/:id`.

## 5. Jobs (real backend)

| Schedule | Job |
|---|---|
| every 5 min | unpaid transfers past `payBy` → `cancelled` by `system`, both sides notified |
| every 15 min | reminders 24 h and 1 h before each visit |
| nightly 03:00 PKT | doctor stats (rating, satisfaction, measured wait, time with patient) recomputed |

## Mock mode

While `BACKEND_URL` is empty, the dummy API answers all of the above. It differs from the real backend in a few ways:
- **Stats update immediately.** They are recomputed on every read; the real nightly job can lag.
- **Reminder pushes aren't sent.** The dummy API can't send pushes. Booking, confirmation and other notifications appear in the in-app Notifications list, and tapping one routes exactly as a push would.
- **The demo video consultation never runs out.** `customer@` always has a video consultation with Dr. Bilal Ahmed that starts within 15 minutes, so you can test two-device video at any time. Sign in as `customer@` on one phone and `doctor@` on the other. The room is a public `meet.jit.si` room; the first person in may be asked to sign in to start it.
- **A slot is always "taken" first.** At Dr. Bilal Ahmed's Gulberg Heart Clinic, the first time you try a day's earliest free time, another patient takes it a moment before you confirm (once per day). Use it to see the "Someone booked this time" message and the three alternatives.
- **Images stay on the device.** Uploaded files keep their local URI. Records and photos you upload on web disappear when the page reloads.

**Seeded accounts** (password `Metro2026`):

| Account | Who | What it shows |
|---|---|---|
| `customer@metromatrix.app` | Ayesha Khan, patient | Family: Hassan (spouse) and Zara (child). Records, including a PDF and a 2-page card. Upcoming visits: a clinic visit with Dr. Bilal tomorrow, and Zara's prepaid video with Dr. Ayesha (proof sent). Past: an acne visit with a prescription, still to be rated; a rated GP visit; a cancelled visit; a missed one. |
| `doctor@metromatrix.app` | Dr. Bilal Ahmed, cardiologist | 3 clinics + video, today's queue, the demo video consult |
| `derm@metromatrix.app` | Dr. Ayesha Siddiqui, dermatologist | Prepaid video + clinic, today's queue (a patient checked in, the next ones booked), a payment to confirm |
| `newdoctor@metromatrix.app` | Dr. Hamza Rauf | Approved but not listed: opens on Practice setup |
| `pmdc@metromatrix.app` | Dr. Sana Iqbal | Waiting for approval with the PMDC number unchecked (admin → Health → Doctor verification) |
| `admin@metromatrix.app` (`Admin2026`, code `123456`) | Staff | Health tab |

The catalogue has 16 specialties and 40 conditions in English and Urdu, plus 23 listed fictional doctors in Lahore, Karachi and Islamabad. Doctors show initials only: no stock photos of strangers presented as doctors.
