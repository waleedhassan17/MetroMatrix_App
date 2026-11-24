// ═══════════════════════════════════════════════════════
// GoogleSignInButton (native) — acquires the ID token, hands it up
// ═══════════════════════════════════════════════════════
// The screen's slice exchanges the token with the API; this component only
// runs the Google SDK. The web build resolves GoogleSignInButton.web.tsx.

import React, { useState } from 'react';
import { GoogleButton } from '../../Custom-Components/GoogleButton';
import { getGoogleIdToken } from '../../services/googleAuth';

export interface GoogleSignInButtonProps {
  onIdToken: (idToken: string) => void;
  /** `code` GOOGLE_UNAVAILABLE ("coming soon", Expo Go) reads as information, not a failure. */
  onError: (message: string, code?: string) => void;
  /** The API exchange is running (the slice's status). */
  busy?: boolean;
  disabled?: boolean;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({ onIdToken, onError, busy, disabled }) => {
  const [acquiring, setAcquiring] = useState(false);
  const press = async () => {
    setAcquiring(true);
    try {
      const token = await getGoogleIdToken();
      if (token) onIdToken(token);
    } catch (e) {
      onError((e as Error).message, (e as { code?: string }).code);
    } finally {
      setAcquiring(false);
    }
  };
  return <GoogleButton onPress={press} loading={acquiring || busy} disabled={disabled} />;
};

export default GoogleSignInButton;
