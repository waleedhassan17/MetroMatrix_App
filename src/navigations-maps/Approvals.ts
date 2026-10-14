// MetroMatrix — Admin Approvals stack (queue → review).

import type { IRoute } from './types';
import { ROUTES } from './Base';

import ApprovalQueueScreen from '../screens/Admin/ApprovalQueue/ApprovalQueueScreen';
import BusinessReviewScreen from '../screens/Admin/BusinessReview/BusinessReviewScreen';

export const ADMIN_STACK_ROUTES: IRoute[] = [
  { title: ROUTES.APPROVAL_QUEUE, component: ApprovalQueueScreen },
  { title: ROUTES.BUSINESS_REVIEW, component: BusinessReviewScreen },
];
