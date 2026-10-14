// ═══════════════════════════════════════════════════════
// GoogleSignInButton (web) — Google Identity Services button + One Tap
// ═══════════════════════════════════════════════════════
// GIS renders its own official button into our container and returns the ID
// token in a callback; One Tap is offered once on mount. Falls back to the
// design-system GoogleButton (with an explanatory error) when no client ID
// is configured or the script cannot load.

import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { GoogleButton } from '../../Custom-Components/GoogleButton';
import { useTheme } from '../../theme';
import { GOOGLE_CLIENT_ID, loadGoogleIdentity, isGoogleSignInAvailable } from '../../services/googleAuth.web';
import type { GoogleSignInButtonProps } from './GoogleSignInButton';

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({ onIdToken, onError, busy, disabled }) => {
  const { mode, size, opacity } = useTheme();
  const container = useRef<View>(null);
  const [failed, setFailed] = useState(!isGoogleSignInAvailable());
  // Latest callbacks without re-initialising GIS on every render.
  const handlers = useRef({ onIdToken, onError });
  useEffect(() => {
    handlers.current = { onIdToken, onError };
  }, [onIdToken, onError]);

  useEffect(() => {
    if (failed) return;
    let cancelled = false;
    loadGoogleIdentity()
      .then(gis => {
        if (cancelled) return;
        gis.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: response => {
            if (response.credential) handlers.current.onIdToken(response.credential);
            else handlers.current.onError('Google sign-in did not finish. Try again.');
          },
          cancel_on_tap_outside: true,
        });
        const node = container.current as unknown as HTMLElement | null;
        if (node) {
          gis.renderButton(node, {
            type: 'standard',
            theme: mode === 'dark' ? 'filled_black' : 'outline',
            size: 'large',
            text: 'continue_with',
            shape: 'pill',
            logo_alignment: 'left',
            width: Math.min(node.offsetWidth || 320, 400),
          });
        }
        gis.prompt();
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setFailed(true);
        handlers.current.onError(e.message);
      });
    return () => {
      cancelled = true;
      window.google?.accounts?.id?.cancel();
    };
  }, [failed, mode]);

  if (failed) {
    return (
      <GoogleButton
        onPress={() => onError('Google sign-in is not set up on this build yet.')}
        loading={busy}
        disabled={disabled}
      />
    );
  }
  return (
    <View
      ref={container}
      style={{ minHeight: size.control.md, alignItems: 'center', opacity: busy || disabled ? opacity.disabled : 1 }}
      pointerEvents={busy || disabled ? 'none' : 'auto'}
      accessibilityLabel="Continue with Google"
    />
  );
};

export default GoogleSignInButton;
