// ═══════════════════════════════════════════════════════
// AuthErrorNotice — a server error, phrased for the person reading it
// ═══════════════════════════════════════════════════════
// WRONG_PORTAL shows the server's message plus a button to the portal the
// account belongs to (QA 10). Offline gets its own title (QA 27); retrying
// is simply submitting again.

import React from 'react';
import { InlineNotice } from '../../Custom-Components/InlineNotice';
import type { Portal } from '../../types/auth';
import type { ServerError } from '../../screens/Auth/shared/formStatus';

const PORTAL_LABEL: Record<Portal, string> = {
  customer: 'Go to customer sign-in',
  partner: 'Go to business sign-in',
  admin: 'Go to staff sign-in',
};

export const AuthErrorNotice: React.FC<{
  error: ServerError;
  fallbackTitle?: string;
  onGoToPortal?: (portal: Portal) => void;
}> = ({ error, fallbackTitle = "Couldn't sign you in", onGoToPortal }) => {
  if (!error.message) return null;
  if (error.code === 'NETWORK_ERROR') {
    return <InlineNotice tone="warning" title="You're offline" message="Check your connection, then try again." />;
  }
  const portal = error.details?.portal as Portal | undefined;
  if (error.code === 'WRONG_PORTAL' && portal && onGoToPortal && PORTAL_LABEL[portal]) {
    return (
      <InlineNotice
        tone="info"
        title="This account signs in elsewhere"
        message={error.message}
        action={{ label: PORTAL_LABEL[portal], onPress: () => onGoToPortal(portal) }}
      />
    );
  }
  return <InlineNotice tone="error" title={fallbackTitle} message={error.message} />;
};

export default AuthErrorNotice;
