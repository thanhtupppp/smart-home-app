export type DeviceType = 'light' | 'rgb_light' | 'ac' | 'switch' | 'sensor' | 'fan' | 'camera' | 'curtain';

// ─── Shadow Model (Desired / Reported) ─────────────────────────────────────
// "desired"  = trạng thái app muốn thiết bị đạt tới (app ghi)
// "reported" = trạng thái thiết bị thực tế đang báo về (ESP32 ghi)

export interface DeviceDesired {
  isOn?: boolean;
  brightness?: number;
  color?: string;
  rgbMode?: 'solid' | 'rainbow' | 'breathing' | 'strobe';
  temperature?: number;
  acMode?: 'cool' | 'heat' | 'dry' | 'fan' | 'eco';
  fanSpeed?: 'auto' | 'low' | 'medium' | 'high';
  /** ID của command đã tạo state này */
  commandId?: string;
  /** Monotonic sequence counter để chống out-of-order execution */
  sequence?: number;
  /** Khóa chống lặp lệnh khi retry */
  idempotencyKey?: string;
}

export interface DeviceReported {
  isOn?: boolean;
  brightness?: number;
  color?: string;
  rgbMode?: 'solid' | 'rainbow' | 'breathing' | 'strobe';
  temperature?: number;
  currentTemperature?: number;
  humidity?: number;
  airQuality?: string;
  acMode?: 'cool' | 'heat' | 'dry' | 'fan' | 'eco';
  fanSpeed?: 'auto' | 'low' | 'medium' | 'high';
  isOnline?: boolean;
  /** Unix timestamp ms - heartbeat từ ESP32 */
  lastSeenAt?: number;
  /** ID của command cuối thiết bị đã thực thi xong */
  lastAppliedCommandId?: string;
  /** Sequence cuối thiết bị đã thực thi xong */
  lastAppliedSequence?: number;
  powerUsageWatts?: number;
  firmwareVersion?: string;
}

// ─── Device ────────────────────────────────────────────────────────────────

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  roomId: string;
  roomName: string;
  isFavorite?: boolean;
  lastUpdated?: string;

  // Flat UI state (merged từ reported; optimistic update từ desired khi pending)
  isOnline: boolean;
  isOn: boolean;
  brightness?: number;
  color?: string;
  rgbMode?: 'solid' | 'rainbow' | 'breathing' | 'strobe';
  temperature?: number;
  currentTemperature?: number;
  humidity?: number;
  airQuality?: string;
  acMode?: 'cool' | 'heat' | 'dry' | 'fan' | 'eco';
  fanSpeed?: 'auto' | 'low' | 'medium' | 'high';
  powerUsageWatts?: number;

  // Sub-documents từ Firebase (tùy chọn — present khi fetch từ homeId-scoped path)
  desired?: DeviceDesired;
  reported?: DeviceReported;
}

// ─── Room ──────────────────────────────────────────────────────────────────

export interface Room {
  id: string;
  name: string;
  iconName: string;
  imageBg?: string;
  deviceCount: number;
  activeCount: number;
  temperature?: number;
  humidity?: number;
}

// ─── Command / Ack protocol ────────────────────────────────────────────────

/** Discriminated union — mỗi loại lệnh có payload riêng */
export type DeviceCommand =
  | { type: 'power'; value: boolean }
  | { type: 'brightness'; value: number }           // 0–100
  | { type: 'temperature'; value: number }           // 16–30
  | { type: 'rgb'; color: string; brightness?: number; mode?: string }
  | { type: 'acMode'; value: 'cool' | 'heat' | 'dry' | 'fan' | 'eco' }
  | { type: 'fanSpeed'; value: 'auto' | 'low' | 'medium' | 'high' }
  | { type: 'curtain'; value: boolean };

export type CommandStatus = 'pending' | 'applied' | 'failed' | 'timeout';

/** Ghi vào homes/{homeId}/commands/{commandId} */
export interface CommandRecord {
  id: string;
  homeId: string;
  deviceId: string;
  type: DeviceCommand['type'];
  payload: Record<string, unknown>;
  requestedBy: string;   // uid của người ra lệnh
  requestedAt: number;   // Unix ms
  status: CommandStatus;
  expiresAt: number;     // requestedAt + 15_000
  sequence?: number;     // Monotonic sequence chống out-of-order
  idempotencyKey?: string;
  appliedAt?: number;
  error?: string;
}

// ─── Scene ─────────────────────────────────────────────────────────────────

export interface SceneAction {
  deviceId: string;
  /** Chỉ các trường được phép thay đổi */
  patch: Partial<Pick<Device, 'isOn' | 'brightness' | 'color' | 'rgbMode' | 'temperature' | 'acMode'>>;
}

export interface Scene {
  id: string;
  homeId?: string;
  name: string;
  icon: string;
  description: string;
  isActive: boolean;
  actionsCount: number;
  /** Nếu có: data-driven. Nếu undefined: fallback về logic hard-code trong HomeContext */
  actions?: SceneAction[];
  timeSchedule?: string;
}

// ─── Automation ────────────────────────────────────────────────────────────

export interface Automation {
  id: string;
  title: string;
  triggerType: 'time' | 'sensor' | 'manual';
  triggerDescription: string;
  actionDescription: string;
  isEnabled: boolean;
  repeatDays: string[];
  executionTime?: string;
}

// ─── Alert ─────────────────────────────────────────────────────────────────

export interface AlertNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'security' | 'warning' | 'info' | 'device';
  isRead: boolean;
  deviceId?: string;
}

// ─── Firebase Config ───────────────────────────────────────────────────────
// authSecret đã bị XÓA — không bao giờ lưu Database Secret trong app.
// App chỉ dùng Firebase ID Token từ Firebase Authentication.

export interface FirebaseConfig {
  databaseURL: string;
  apiKey?: string;
  projectId?: string;
  isDemoMode: boolean;
}

// ─── Auth ──────────────────────────────────────────────────────────────────

export type AuthRole = 'owner' | 'member' | 'guest';

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  photoUrl?: string;
  role: AuthRole;
  idToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  lastLoginAt?: string;
  isDemo?: boolean;
}

// ─── Home Overview ─────────────────────────────────────────────────────────

export interface HomeOverview {
  homeName: string;
  totalDevices: number;
  onlineDevices: number;
  activeDevices: number;
  avgTemperature: number;
  avgHumidity: number;
  powerConsumptionWatts: number;
  securityStatus: 'armed' | 'disarmed' | 'alert';
}

// ─── Connection Status ─────────────────────────────────────────────────────
/** Trạng thái kết nối thật giữa app và Firebase RTDB */
export type HomeConnectionStatus = 'connected' | 'reconnecting' | 'offline';

// ─── Home Meta ─────────────────────────────────────────────────────────────
/** Metadata của một ngôi nhà — lưu tại homes/{homeId}/meta */
export interface HomeMeta {
  id: string;
  name: string;
  address?: string;
  icon?: string;
  createdAt: string;
  ownerUid: string;
}
