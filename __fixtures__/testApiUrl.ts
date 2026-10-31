// Imported first by a test that needs the client configured: network.ts reads
// EXPO_PUBLIC_API_URL when it loads, so this runs before it.
process.env.EXPO_PUBLIC_API_URL = 'https://api.test/api/v1';

export {};
