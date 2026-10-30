// The dummy API is opt-in (src/config/env.ts): the suites run against it, as
// a dev build with EXPO_PUBLIC_USE_MOCK_API=1 does. Tests that need the other
// modes set the env and re-require in jest.isolateModules.
process.env.EXPO_PUBLIC_USE_MOCK_API = '1';

// Native modules have no implementation under Jest. Mock the two storage
// backends the infra layer touches so networks/slices/storageUtils can be
// required (and exercised) from plain unit tests.

jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    getItemAsync: jest.fn(async key => (store.has(key) ? store.get(key) : null)),
    setItemAsync: jest.fn(async (key, value) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async key => {
      store.delete(key);
    }),
    __reset: () => store.clear(),
  };
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
