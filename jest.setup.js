// No API URL here, so the client answers CONFIG_ERROR (networks/network/network.ts).
// A test that runs networks against the dummy API installs it
// (networks/network/mock/testing.ts); others stub axios themselves.

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

// The device's connectivity (networks/network/network.ts asks it why a request
// got no answer). Online by default; a test sets `isConnected: false` with
// `require('expo-network').getNetworkStateAsync.mockResolvedValueOnce(...)`.
jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(async () => ({ isConnected: true, isInternetReachable: true, type: 'WIFI' })),
  NetworkStateType: { NONE: 'NONE', UNKNOWN: 'UNKNOWN', WIFI: 'WIFI', CELLULAR: 'CELLULAR' },
}));

// Photo resizing before upload (utils/pickers). Answers the same file, sized.
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(async (uri, _actions, _options) => ({ uri: `${uri}#resized`, width: 2048, height: 1536 })),
  SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
}));
