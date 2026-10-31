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

  it('sends Shopping pushes to the order, from the data MetroMatrix-API sends', () => {
    expect(pushTapUrl({ type: 'shop.order.placed', groupCode: 'MM-24A7Q2' }, 'customer')).toBe('metromatrix://orders/MM-24A7Q2');
    // A store order's notice names it and its code; the group is the code's prefix.
    expect(pushTapUrl({ type: 'shop.order.shipped', storeOrderId: 'so_1', code: 'MM-24A7Q2-2' }, 'customer')).toBe('metromatrix://orders/MM-24A7Q2');
    expect(pushTapUrl({ type: 'shop.order.new', storeOrderId: 'so_1', code: 'MM-24A7Q2-2' }, 'partner')).toBe('metromatrix://store/orders/so_1');
    expect(pushTapUrl({ type: 'shop.return.requested', storeOrderId: 'so_1', code: 'MM-24A7Q2-2' }, 'partner')).toBe('metromatrix://store/orders/so_1');
    expect(pushTapUrl({ type: 'shop.return.approved', returnId: 'rt_1', storeOrderId: 'so_1', code: 'MM-24A7Q2-2' }, 'customer')).toBe('metromatrix://orders/MM-24A7Q2');
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
