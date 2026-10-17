// ═══════════════════════════════════════════════════════
// AuthErrorNotice — a server error, phrased for the person reading it
// ═══════════════════════════════════════════════════════
// WRONG_PORTAL shows the server's message plus a button to the portal the
// account belongs to (QA 10): the API names the account type (and the
// portal that was tried); staff go to the User sign-in, as in the FYP. Offline gets its own title (QA 27); retrying
// is simply submitting again.

import React from 'react';
import { InlineNotice } from '../../Custom-Components/InlineNotice';
import type { Portal } from '../../types/auth';
import type { ServerError } from '../../screens/Auth/shared/formStatus';

const PORTAL_LABEL: Record<Portal, string> = {
  customer: 'Sign in as a User',
  partner: 'Sign in as a Service Provider',
  admin: 'Sign in as a User',
};

const DOOR: Record<string, Portal> = { customer: 'customer', partner: 'partner', admin: 'customer', super_admin: 'customer' };

/** `{ accountType, portal: tried }` from the API → where to sign in instead. */
const rightPortal = (details: unknown): Portal | undefined => {
  const d = (details ?? {}) as { accountType?: unknown; portal?: unknown };
  return typeof d.accountType === 'string' ? DOOR[d.accountType] : (d.portal as Portal | undefined);
};

export const AuthErrorNotice: React.FC<{
  error: ServerError;
  fallbackTitle?: string;
  onGoToPortal?: (portal: Portal) => void;
}> = ({ error, fallbackTitle, onGoToPortal }) => {
  if (!error.message) return null;
  if (error.code === 'NETWORK_ERROR') {
    return <InlineNotice tone="warning" message="You're offline. Check your connection, then try again." />;
  }
  const portal = rightPortal(error.details);
  if (error.code === 'WRONG_PORTAL' && portal && onGoToPortal && PORTAL_LABEL[portal]) {
    return (
      <InlineNotice
        tone="info"
        message={error.message}
        action={{ label: PORTAL_LABEL[portal], onPress: () => onGoToPortal(portal) }}
      />
    );
  }
  return <InlineNotice tone="error" title={fallbackTitle} message={error.message} />;
};

export default AuthErrorNotice;
