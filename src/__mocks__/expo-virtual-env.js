// Mock module "expo/virtual/env" cho Jest.
// Babel của Expo (SDK 52+) chuyển các truy cập process.env.EXPO_PUBLIC_*
// thành import từ module ESM này; bản gốc trong node_modules dùng cú pháp
// "export" mà Jest (CommonJS) không parse được, nên mock lại dạng CJS.
module.exports = { env: process.env };
