module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.(js|ts|tsx)$': 'babel-jest',
  },
  moduleNameMapper: {
    '^react-native$': '<rootDir>/src/__mocks__/react-native.js',
    '^@expo/vector-icons$': '<rootDir>/src/__mocks__/expo-vector-icons.js',
    '^@react-native-async-storage/async-storage$': '<rootDir>/src/__mocks__/async-storage.js',
    '^expo-secure-store$': '<rootDir>/src/__mocks__/expo-secure-store.js',
    '^expo-auth-session$': '<rootDir>/src/__mocks__/expo-auth-session.js',
    '^expo-web-browser$': '<rootDir>/src/__mocks__/expo-web-browser.js',
    '^expo/virtual/env$': '<rootDir>/src/__mocks__/expo-virtual-env.js',
    '^test-renderer$': 'react-test-renderer',
  },
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
};
