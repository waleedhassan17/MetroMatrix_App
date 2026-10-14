# Google sign-in setup

The app sends a **Google ID token** to `POST /auth/google`. The API verifies the token against the **web** client ID, which is the audience the token is minted for. Never send an access token.

| Platform | How the token is obtained | Code |
|---|---|---|
| Android / iOS (dev or EAS build) | `@react-native-google-signin/google-signin`, `GoogleSignin.signIn()` | `src/services/googleAuth.ts` |
| Web | Google Identity Services: the rendered button plus One Tap | `src/services/googleAuth.web.ts`, `src/components/auth/GoogleSignInButton.web.tsx` |
| Expo Go | **Not available.** The native module isn't in Expo Go. The button shows "Google sign-in needs the MetroMatrix app build" instead of crashing. | — |

## 1. Google Cloud console

In **APIs & Services → Credentials**, create these OAuth client IDs in the same project:

1. **Web application.** This is the ID the app is configured with.
   - Authorised JavaScript origins:
     - `http://localhost:8081` (Expo web, dev)
     - your deployed web origin
   - Copy the client ID into `.env.local`:
     ```
     EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=1234-abc.apps.googleusercontent.com
     ```
   - Give the same ID to the API (it is the token audience).
2. **Android**, one per signing key (see SHA-1 below).
   - Package name: `com.metromatrix.app`
   - The app never references the Android client IDs. Google matches them by package name + SHA-1, so a missing or wrong SHA-1 fails with `DEVELOPER_ERROR` (code 10).
3. **iOS**, if you ship iOS.
   - Bundle ID: `com.metromatrix.app`
   - Put its *reversed* client ID in `app.json` → `plugins` → `@react-native-google-signin/google-signin` → `iosUrlScheme` (currently the placeholder `com.googleusercontent.apps.TODO-ios-client-id`).

## 2. SHA-1 fingerprints (Android)

Register **every** key that signs a build you test with.

**Debug key** (`npm run android` / `expo run:android`):
```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android | grep SHA1
```
With a generated `android/` folder, also check `android/app/debug.keystore`. Prebuild may use that one instead:
```bash
keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android | grep SHA1
```

**EAS keystore** (internal and production builds):
```bash
eas credentials -p android   # → Keystore → shows SHA1 / SHA256
```

**Play App Signing** (store installs): Play Console → *Test and release → App integrity → App signing key certificate* → SHA-1. Store installs are re-signed by Google, so this key needs its own Android client ID too.

## 3. Build

```bash
npm run android     # dev build that includes the native Google module
npm run web         # GIS button; origin must be in the web client's JS origins
```

## Troubleshooting

| Symptom | Cause |
|---|---|
| `DEVELOPER_ERROR` / code 10 on Android | SHA-1 or package name not registered for the key that signed this build |
| "Google sign-in is not set up on this build yet." | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` missing at bundle time; restart Metro after editing `.env.local` |
| Web button never renders | Origin not in the web client's *Authorised JavaScript origins*, or third-party cookies blocked for One Tap |
| `/auth/google` returns 401 `GOOGLE_TOKEN_INVALID` | The API verifies against a different client ID than the one the app uses |
