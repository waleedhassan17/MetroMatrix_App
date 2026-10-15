// MetroMatrix — Customer Orders stack: Shop / Health / Food, then an order.

import type { IRoute } from './types';
import { ROUTES } from './Base';

import OrdersScreen from '../screens/Customer/Orders/OrdersScreen';

export const ORDERS_ROUTES: IRoute[] = [{ title: ROUTES.ORDERS, component: OrdersScreen }];
