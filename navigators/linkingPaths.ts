// Path rewrites applied before React Navigation resolves a deep link
// (AppContainer's linking.getStateFromPath). Pure, so they are unit-tested.

/**
 * verify-success?… → verify-email?…: links sent before the rename, and the
 * FYP's name for the screen, reach the one handler (VerifySuccess).
 */
export const rewriteVerifyPath = (path: string): string =>
  path.replace(/^(\/?)verify-success(?=[/?#]|$)/, '$1verify-email');
