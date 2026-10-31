// MetroMatrix — Admin Approvals stack (queue → review).

import type { IRoute } from './types';
import { ROUTES } from './Base';

import ApprovalQueue from '../screens/approval-queue-screen/ApprovalQueue';
import BusinessReview from '../screens/business-review-screen/BusinessReview';

export const ADMIN_STACK_ROUTES: IRoute[] = [
  { title: ROUTES.APPROVAL_QUEUE, component: ApprovalQueue },
  { title: ROUTES.BUSINESS_REVIEW, component: BusinessReview },
];
