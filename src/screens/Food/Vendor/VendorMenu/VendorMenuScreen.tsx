// ═══════════════════════════════════════════════════════
// MetroMatrix — Food vendor: Menu
// ═══════════════════════════════════════════════════════
// Stateless for now; the menu manager replaces it in the next phase.
// TODO(API_FOOD): categories, items, option groups, availability.

import React from 'react';
import { ServiceScope } from '@theme/index';
import { EmptyState, ScreenShell } from '@custom/index';

const VendorMenuScreen: React.FC = () => (
  <ServiceScope service="food">
    <ScreenShell title="Menu">
      <EmptyState icon="book-open" title="Your menu" body="Categories, dishes, sizes and add-ons are managed here." />
    </ScreenShell>
  </ServiceScope>
);

export default VendorMenuScreen;
