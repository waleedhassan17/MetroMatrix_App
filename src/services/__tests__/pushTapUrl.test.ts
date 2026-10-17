// A tapped push opens the right screen: the patient's appointment or
// prescription, the doctor's appointment, a shop order.

import { pushTapUrl } from '../push';

describe('pushTapUrl', () => {
  it('sends a patient to the appointment (reminders, confirmations) or the prescription', () => {
    expect(pushTapUrl({ appointmentCode: 'HC-7KQ2MZ' }, false)).toBe('metromatrix://health/appointment/HC-7KQ2MZ');
    expect(pushTapUrl({ prescriptionId: 'rx_1', appointmentCode: 'HC-7KQ2MZ' }, false)).toBe('metromatrix://profile/prescriptions/rx_1');
  });

  it('sends a doctor to their appointment', () => {
    expect(pushTapUrl({ appointmentCode: 'HC-7KQ2MZ' }, true)).toBe('metromatrix://doctor/appointments/HC-7KQ2MZ');
    expect(pushTapUrl({ appointmentId: 'ap_9' }, true)).toBe('metromatrix://doctor/appointments/ap_9');
  });

  it('keeps Shopping taps as they were', () => {
    expect(pushTapUrl({ groupCode: 'MM-24A7Q2' }, false)).toBe('metromatrix://orders/MM-24A7Q2');
    expect(pushTapUrl({ orderId: 'o_1' }, true)).toBe('metromatrix://store/orders/o_1');
    expect(pushTapUrl({}, false)).toBeNull();
  });
});
