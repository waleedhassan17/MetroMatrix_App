module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/', '/dist/'],
  // The react-native preset's transformIgnorePatterns only whitelists
  // react-native and @react-native*. Redux Toolkit ships ESM (and pulls immer,
  // which ships `export {` in its legacy-esm build), so requiring it from a
  // test dies on "Unexpected token 'export'". Expo modules ship untranspiled
  // TS/ESM too. Let Babel transform those alongside the RN packages.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@reduxjs/toolkit|immer|redux|reselect|expo(nent)?|@expo(nent)?/.*|expo-.*|@expo-google-fonts/.*|redux-persist)/)',
  ],
};
