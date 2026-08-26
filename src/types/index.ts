export type DeviceType = 'light' | 'rgb_light' | 'ac' | 'switch' | 'sensor' | 'fan' | 'camera' | 'curtain';

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  roomId: string;
  roomName: string;
  isOnline: boolean;
  isOn: boolean;
  isFavorite?: boolean;
  // Specific device attributes
  brightness?: number; // 0-100
  color?: string; // Hex color for RGB
  rgbMode?: 'solid' | 'rainbow' | 'breathing' | 'strobe';
  temperature?: number; // Target temperature for AC (16-30)
  currentTemperature?: number; // Sensor temperature
  humidity?: number; // Sensor humidity
  airQuality?: string; // Good, Moderate, Poor
  acMode?: 'cool' | 'heat' | 'dry' | 'fan' | 'eco';
  fanSpeed?: 'auto' | 'low' | 'medium' | 'high';
  powerUsageWatts?: number;
  lastUpdated?: string;
}

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

export interface Scene {
  id: string;
  name: string;
  icon: string;
  description: string;
  isActive: boolean;
  actionsCount: number;
  timeSchedule?: string;
}

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

export interface AlertNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'security' | 'warning' | 'info' | 'device';
  isRead: boolean;
  deviceId?: string;
}

export interface FirebaseConfig {
  databaseURL: string;
  apiKey?: string;
  projectId?: string;
  authSecret?: string;
  isDemoMode: boolean;
}

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

