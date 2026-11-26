const { getDefaultConfig } = require('expo/metro-config');
const { createDevApiProxy } = require('./scripts/devApiProxy');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// The development web build calls the API through the dev server (same origin,
// so the browser's CORS check never applies): /__api/* is forwarded to
// EXPO_PUBLIC_API_URL. Expo loads .env.local before this file runs. Native
// apps and release builds call the API directly. See scripts/devApiProxy.js.
const devApiProxy = createDevApiProxy(process.env.EXPO_PUBLIC_API_URL);
const enhance = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const inner = enhance ? enhance(middleware, server) : middleware;
  return (req, res, next) => devApiProxy(req, res, () => inner(req, res, next));
};

module.exports = config;
