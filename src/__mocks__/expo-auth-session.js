module.exports = {
  makeRedirectUri: jest.fn(() => 'tusmarthome://auth'),
  useAuthRequest: jest.fn(() => [null, null, jest.fn()]),
};
