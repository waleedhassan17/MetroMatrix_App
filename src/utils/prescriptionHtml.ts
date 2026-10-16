// ═══════════════════════════════════════════════════════
// MetroMatrix — The prescription as printable HTML (expo-print → PDF)
// ═══════════════════════════════════════════════════════
// The same layout as PrescriptionSheet, in plain HTML and CSS, so the PDF a
// patient shares on WhatsApp reads like the screen. Colours come from the
// theme (passed in), and every value from the API is escaped.

import type { PrescriptionDoc } from '../Custom-Components/health/PrescriptionSheet';
import { doseSlots, formLabel, formatDose, timingLabel } from '../models/health/prescriptionModel';
import { formatOn } from './healthTime';

export interface PrintColours {
  ink: string;
  muted: string;
  line: string;
  accent: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const prescriptionHtml = (p: PrescriptionDoc, c: PrintColours): string => {
  const patient = [p.patient.name, p.patient.age !== null ? `${p.patient.age} years` : null, p.patient.gender]
    .filter(Boolean)
    .map(x => esc(String(x)))
    .join(' · ');
  const dots = (dose: string) =>
    doseSlots(dose)
      .map(s => `<span class="dot${s.amount ? ' on' : ''}" title="${s.label}"></span><span class="dl">${s.label[0]}</span>`)
      .join('');
  const meds = p.medicines
    .map(
      (m, i) => `<tr>
        <td class="n">${i + 1}</td>
        <td><b>${esc(`${m.name} ${m.strength}`.trim())}</b><br/><span class="m">${esc(formLabel(m.form))}${m.instructions ? ` · ${esc(m.instructions)}` : ''}</span></td>
        <td class="dose">${dots(m.dose)}<br/><span class="m">${esc(formatDose(m.dose))}</span></td>
        <td>${esc(timingLabel(m.timing))}</td>
        <td>${m.days} ${m.days === 1 ? 'day' : 'days'}</td>
      </tr>`,
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  @page { margin: 18mm 16mm; }
  body { font-family: -apple-system, Roboto, "Segoe UI", Arial, sans-serif; color: ${c.ink}; font-size: 12pt; line-height: 1.45; }
  h1 { font-size: 18pt; margin: 0; }
  .m { color: ${c.muted}; font-size: 10pt; }
  .head { border-bottom: 2px solid ${c.accent}; padding-bottom: 10px; margin-bottom: 12px; }
  .row { display: flex; justify-content: space-between; margin-bottom: 14px; }
  h2 { font-size: 9pt; letter-spacing: .08em; color: ${c.muted}; margin: 16px 0 6px; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 9pt; color: ${c.muted}; font-weight: 600; border-bottom: 1px solid ${c.line}; padding: 6px 4px; }
  td { vertical-align: top; border-bottom: 1px solid ${c.line}; padding: 8px 4px; }
  td.n { width: 18px; color: ${c.muted}; }
  .dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; border: 1px solid ${c.muted}; margin: 0 2px 0 6px; }
  .dot.on { background: ${c.accent}; border-color: ${c.accent}; }
  .dl { font-size: 8pt; color: ${c.muted}; }
  .foot { margin-top: 28px; font-size: 9pt; color: ${c.muted}; border-top: 1px solid ${c.line}; padding-top: 8px; }
</style></head><body>
  <div class="head">
    <h1>${esc(p.doctor.name)}</h1>
    <div>${esc([p.doctor.qualifications, p.doctor.specialtyName].filter(Boolean).join(' · '))}</div>
    <div class="m">${esc([p.doctor.pmdcNumber ? `PMDC ${p.doctor.pmdcNumber}` : '', p.doctor.place, p.doctor.phone ?? ''].filter(Boolean).join(' · '))}</div>
  </div>
  <div class="row"><b>${patient}</b><span class="m">${esc(formatOn(p.issuedAt))}</span></div>
  ${p.diagnosis ? `<h2>Diagnosis</h2><div>${esc(p.diagnosis)}</div>` : ''}
  ${p.medicines.length ? `<h2>Medicines</h2><table><tr><th></th><th>Medicine</th><th>Morning · Afternoon · Night</th><th>When</th><th>For</th></tr>${meds}</table>` : ''}
  ${p.tests.length ? `<h2>Tests</h2><ul>${p.tests.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
  ${p.advice ? `<h2>Advice</h2><div>${esc(p.advice)}</div>` : ''}
  ${p.followUpInDays ? `<h2>Follow-up</h2><div>In ${p.followUpInDays} ${p.followUpInDays === 1 ? 'day' : 'days'}</div>` : ''}
  <div class="foot">Prescribed by ${esc(p.doctor.name)}${p.doctor.pmdcNumber ? ` (PMDC ${esc(p.doctor.pmdcNumber)})` : ''} on ${esc(formatOn(p.issuedAt))}. Shared from MetroMatrix.</div>
</body></html>`;
};
