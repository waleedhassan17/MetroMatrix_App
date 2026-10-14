// MetroMatrix — Orders (placeholder until ordering ships). Stateless.

import React from 'react';
import { EmptyState, ScreenShell } from '@custom/index';

const OrdersScreen: React.FC = () => (
  <ScreenShell title="Orders">
    <EmptyState icon="package" title="No orders yet" body="Your orders and bookings will show here." />
  </ScreenShell>
);

export default OrdersScreen;
