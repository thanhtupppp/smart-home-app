let store = {};

module.exports = {
  getItemAsync: jest.fn(async (key) => store[key] || null),
  setItemAsync: jest.fn(async (key, value) => {
    store[key] = String(value);
  }),
  deleteItemAsync: jest.fn(async (key) => {
    delete store[key];
  }),
};
