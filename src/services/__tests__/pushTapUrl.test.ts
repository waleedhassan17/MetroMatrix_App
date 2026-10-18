// A tapped push opens the right screen: the patient's appointment or
// prescription, the doctor's appointment, a shop order, a Food Court order
// (the customer's, the kitchen's, the rider's delivery), a kitchen's reviews.

import { pushTapUrl } from '../push';

describe('pushTapUrl', () => {
  it('sends a patient to the appointment (reminders, confirmations) or the prescription', () => {
    expect(pushTapUrl({ appointmentCode: 'HC-7KQ2MZ' }, 'customer')).toBe('metromatrix://health/appointment/HC-7KQ2MZ');
    expect(pushTapUrl({ prescriptionId: 'rx_1', appointmentCode: 'HC-7KQ2MZ' }, 'customer')).toBe('metromatrix://profile/prescriptions/rx_1');
  });

  it('sends a doctor to their appointment', () => {
    expect(pushTapUrl({ appointmentCode: 'HC-7KQ2MZ' }, 'partner')).toBe('metromatrix://doctor/appointments/HC-7KQ2MZ');
    expect(pushTapUrl({ appointmentId: 'ap_9' }, 'partner')).toBe('metromatrix://doctor/appointments/ap_9');
  });

  it('keeps Shopping taps as they were', () => {
    expect(pushTapUrl({ groupCode: 'MM-24A7Q2' }, 'customer')).toBe('metromatrix://orders/MM-24A7Q2');
    expect(pushTapUrl({ orderId: 'o_1' }, 'partner')).toBe('metromatrix://store/orders/o_1');
    expect(pushTapUrl({}, 'customer')).toBeNull();
  });

  it('sends Food Court pushes to the customer’s order, the kitchen’s order or reviews, the rider’s delivery', () => {
    const order = { type: 'food.order.accepted', orderId: 'fo_1', code: 'FC-7KQ2PX' };
    expect(pushTapUrl(order, 'customer')).toBe('metromatrix://food/order/FC-7KQ2PX');
    expect(pushTapUrl({ type: 'food.review.reply', reviewId: 'r1' }, 'customer')).toBe('metromatrix://food/orders');
    expect(pushTapUrl({ type: 'food.order.new', orderId: 'fo_1', code: 'FC-7KQ2PX' }, 'partner')).toBe('metromatrix://vendor/orders/fo_1');
    expect(pushTapUrl({ type: 'food.review.new', reviewId: 'r1' }, 'partner')).toBe('metromatrix://vendor/reviews');
    expect(pushTapUrl({ type: 'food.rider.assigned', orderId: 'fo_1', code: 'FC-7KQ2PX' }, 'rider')).toBe('metromatrix://rider/deliveries/fo_1');
    expect(pushTapUrl({ type: 'food.rider.unassigned' }, 'rider')).toBe('metromatrix://rider/deliveries');
  });
});
