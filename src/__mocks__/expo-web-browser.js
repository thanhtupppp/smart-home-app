module.exports = {
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(async () => ({ type: 'dismiss' })),
  openBrowserAsync: jest.fn(async () => ({ type: 'dismiss' })),
};
