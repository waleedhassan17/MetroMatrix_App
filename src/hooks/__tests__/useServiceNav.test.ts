// The customer app's addresses (the FYP's per-service apps): what each jump asks
// the root stack for. Route names are the shipped ones — they must not drift.

import { serviceTargets } from '../useServiceNav';

describe('serviceTargets', () => {
  it('opens a service app on its tabs, or a page over them', () => {
    expect(serviceTargets.health()).toEqual(['HealthApp', undefined]);
    expect(serviceTargets.health('AppointmentDetail', { code: 'HC-1' })).toEqual([
      'HealthApp',
      { screen: 'AppointmentDetail', params: { code: 'HC-1' }, initial: false },
    ]);
    expect(serviceTargets.shop('OrderDetail', { groupCode: 'MM-1' })[1]).toEqual({ screen: 'OrderDetail', params: { groupCode: 'MM-1' }, initial: false });
    expect(serviceTargets.food()).toEqual(['FoodApp', undefined]);
  });

  it('switches a service app to one of its tabs', () => {
    expect(serviceTargets.healthTab('AppointmentsTab')).toEqual(['HealthApp', { screen: 'HealthTabs', params: { screen: 'AppointmentsTab', params: undefined } }]);
    expect(serviceTargets.shopTab('SavedTab')).toEqual(['ShopApp', { screen: 'ShopTabs', params: { screen: 'SavedTab', params: undefined } }]);
    expect(serviceTargets.foodTab('FoodOrdersTab')[1]).toEqual({ screen: 'FoodTabs', params: { screen: 'FoodOrdersTab', params: undefined } });
  });

  it('leaves for the three cards', () => {
    expect(serviceTargets.home()).toEqual(['CustomerHome', undefined]);
  });
});
