module.exports = {
  // jest-expo (not FinMatrix's bare react-native preset): the store pulls in
  // Expo modules (expo-constants, expo-device, …) whose native halves only
  // jest-expo knows how to mock.
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  globalSetup: '<rootDir>/jest.globalSetup.js',
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/', '/dist/'],
  // Redux Toolkit ships ESM (and pulls immer's legacy-esm build); Expo and RN
  // packages ship untranspiled TS/ESM. Let Babel transform all of them.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@reduxjs/toolkit|immer|redux|react-redux|reselect|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|expo-.*|react-navigation|@react-navigation/.*|redux-persist|@gorhom/.*)/)',
  ],
};
