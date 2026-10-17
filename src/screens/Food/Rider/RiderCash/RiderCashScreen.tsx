// ═══════════════════════════════════════════════════════
// MetroMatrix — Food rider: Cash
// ═══════════════════════════════════════════════════════
// Stateless for now: the cash a rider holds for their vendor (collected on
// delivery, handed over at the kitchen) arrives with the API's rider phase.
// TODO(API_FOOD): GET /food/rider/cash.

import React from 'react';
import { ServiceScope } from '@theme/index';
import { EmptyState, ScreenShell } from '@custom/index';

const RiderCashScreen: React.FC = () => (
  <ServiceScope service="food">
    <ScreenShell title="Cash" subtitle="What you hold for your vendor">
      <EmptyState icon="dollar-sign" title="No cash held" body="Cash you collect on delivery adds up here until you hand it over at the kitchen." />
    </ScreenShell>
  </ServiceScope>
);

export default RiderCashScreen;
