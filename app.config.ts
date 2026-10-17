// MetroMatrix — app config.
// app.json is the source of truth; this only adds what must not live in it:
// the Google Maps key for Android builds, from an EAS secret
// (`eas secret:create --name GOOGLE_MAPS_ANDROID_KEY`). Expo Go and the web
// don't need it (Expo Go brings its own key; the web uses MapLibre).
import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const key = process.env.GOOGLE_MAPS_ANDROID_KEY;
  return {
    ...(config as ExpoConfig),
    android: {
      ...config.android,
      ...(key ? { config: { ...config.android?.config, googleMaps: { apiKey: key } } } : {}),
    },
  };
};
