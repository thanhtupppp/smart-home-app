/**
 * Cấu hình tập trung của app — đọc từ biến môi trường EXPO_PUBLIC_* trong file .env
 * (Expo inline các biến này vào bundle lúc build, KHÔNG đọc lúc runtime).
 *
 * Không còn thông số Firebase/Google nằm cứng trong source code.
 * Nếu thiếu .env: giá trị là chuỗi rỗng -> app chạy ở chế độ chưa cấu hình,
 * người dùng nhập thông số qua màn hình "Cấu hình Firebase" (config được lưu lâu dài).
 *
 * Xem `.env.example` để biết danh sách biến cần thiết.
 */
export const appConfig = {
  /** Firebase Realtime Database URL (Project Settings -> Realtime Database) */
  // react-doctor-disable-next-line react-doctor/public-env-secret-name
  firebaseDatabaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL ?? '',
  /** Firebase Web API Key — khóa công khai, dùng cho Firebase Auth REST */
  firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  /** Google OAuth Client ID cho luồng đăng nhập Google */
  googleClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '',
};
