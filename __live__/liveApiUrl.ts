// Imported first by live.test.ts: network.ts reads EXPO_PUBLIC_API_URL when it
// loads, so the live API's address is set before it.
process.env.EXPO_PUBLIC_API_URL = process.env.LIVE_API_URL ?? 'http://live.invalid/api/v1';

export {};
