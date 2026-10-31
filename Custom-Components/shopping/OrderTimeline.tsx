// OrderTimeline — a store order's journey on StatusTimeline. The steps and
// their wording come from orderStatusModel; times read as "14 Oct, 3:05 pm".

import React from 'react';
import { orderTimeline } from '../../models/shopping/orderStatusModel';
import type { StoreOrder } from '../../models/shopping';
import { formatDateTime } from '../../utils/dates/dates';
import { StatusTimeline } from '../StatusTimeline';

export const OrderTimeline: React.FC<{ order: Pick<StoreOrder, 'status' | 'events' | 'shipment'> }> = ({ order }) => (
  <StatusTimeline steps={orderTimeline(order, formatDateTime)} />
);

export default OrderTimeline;
