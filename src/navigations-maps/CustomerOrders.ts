// MetroMatrix — Customer Orders stack: Shop / Health / Food, then an order.

import type { IRoute } from './types';
import { ROUTES } from './Base';

import OrdersScreen from '../screens/Customer/Orders/OrdersScreen';
import OrderDetailScreen from '../screens/Shopping/Customer/OrderDetail/OrderDetailScreen';
import ReturnRequestScreen from '../screens/Shopping/Customer/ReturnRequest/ReturnRequestScreen';
import WriteReviewScreen from '../screens/Shopping/Customer/WriteReview/WriteReviewScreen';
import { SHOP_BROWSE_ROUTES } from './ShoppingCustomer';
import { HEALTH_BROWSE_ROUTES } from './HealthPatient';

export const ORDERS_ROUTES: IRoute[] = [
  { title: ROUTES.ORDERS, component: OrdersScreen },
  { title: ROUTES.ORDER_DETAIL, component: OrderDetailScreen },
  { title: ROUTES.RETURN_REQUEST, component: ReturnRequestScreen },
  { title: ROUTES.WRITE_REVIEW, component: WriteReviewScreen },
  ...SHOP_BROWSE_ROUTES,
  ...HEALTH_BROWSE_ROUTES,
];
