import { Device, Room, Scene, Automation, AlertNotification, HomeOverview } from '../types';

export const initialHomeOverview: HomeOverview = {
  homeName: 'Nhà của tôi',
  totalDevices: 12,
  onlineDevices: 11,
  activeDevices: 6,
  avgTemperature: 25.5,
  avgHumidity: 62,
  powerConsumptionWatts: 420,
  securityStatus: 'armed',
};

export const initialRooms: Room[] = [
  {
    id: 'room_living',
    name: 'Phòng khách',
    iconName: 'weekend',
    deviceCount: 5,
    activeCount: 3,
    temperature: 24.8,
    humidity: 58,
  },
  {
    id: 'room_bedroom_master',
    name: 'Phòng ngủ Master',
    iconName: 'bed',
    deviceCount: 3,
    activeCount: 1,
    temperature: 26.0,
    humidity: 65,
  },
  {
    id: 'room_kitchen',
    name: 'Phòng bếp',
    iconName: 'restaurant',
    deviceCount: 2,
    activeCount: 1,
    temperature: 27.2,
    humidity: 60,
  },
  {
    id: 'room_balcony',
    name: 'Ban công',
    iconName: 'balcony',
    deviceCount: 2,
    activeCount: 1,
    temperature: 29.1,
    humidity: 70,
  },
];

export const initialDevices: Device[] = [];

export const initialScenes: Scene[] = [
  {
    id: 'scene_arrive_home',
    name: 'Về nhà',
    icon: 'home',
    description: 'Bật đèn phòng khách, bật điều hòa 24°C, mở rèm',
    isActive: true,
    actionsCount: 4,
    actions: [
      { deviceId: 'dev_light_living_01', patch: { isOn: true } },
      { deviceId: 'dev_rgb_living_01', patch: { isOn: true } },
      { deviceId: 'dev_ac_living_01', patch: { isOn: true, temperature: 24, acMode: 'cool' } },
    ],
  },
  {
    id: 'scene_leave_home',
    name: 'Rời nhà',
    icon: 'logout',
    description: 'Tắt toàn bộ đèn & điều hòa, kích hoạt an ninh',
    isActive: false,
    actionsCount: 8,
    // actions = [] → HomeContext sẽ dùng turnAllDevices(false)
    actions: [],
  },
  {
    id: 'scene_sleep',
    name: 'Đi ngủ',
    icon: 'bedtime',
    description: 'Tắt đèn phòng khách, hạ nhiệt độ phòng ngủ 26°C',
    isActive: false,
    actionsCount: 5,
    actions: [
      { deviceId: 'dev_light_living_01', patch: { isOn: false } },
      { deviceId: 'dev_rgb_living_01', patch: { isOn: false } },
      { deviceId: 'dev_ac_bedroom_01', patch: { isOn: true, temperature: 26, acMode: 'cool' } },
    ],
  },
  {
    id: 'scene_movie',
    name: 'Xem phim',
    icon: 'movie',
    description: 'Đèn LED chuyển màu Neon, giảm độ sáng 20%',
    isActive: false,
    actionsCount: 3,
    actions: [
      { deviceId: 'dev_rgb_living_01', patch: { isOn: true, color: '#7c4dff', brightness: 25, rgbMode: 'breathing' } },
      { deviceId: 'dev_light_living_01', patch: { isOn: false } },
    ],
  },
];

export const initialAutomations: Automation[] = [
  {
    id: 'auto_1',
    title: 'Hẹn giờ tắt đèn Ban đêm',
    triggerType: 'time',
    triggerDescription: 'Mỗi ngày lúc 23:30',
    actionDescription: 'Tắt tất cả đèn khu vực sinh hoạt chung',
    isEnabled: true,
    repeatDays: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
    executionTime: '23:30',
  },
  {
    id: 'auto_2',
    title: 'Kích hoạt điều hòa khi trời nóng',
    triggerType: 'sensor',
    triggerDescription: 'Khi nhiệt độ phòng khách > 29°C',
    actionDescription: 'Bật điều hòa chế độ Cool 25°C',
    isEnabled: true,
    repeatDays: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
  },
  {
    id: 'auto_3',
    title: 'Cảnh báo an ninh ban đêm',
    triggerType: 'sensor',
    triggerDescription: 'Phát hiện chuyển động sau 00:00',
    actionDescription: 'Bật đèn ban công 100% & gửi cảnh báo đến điện thoại',
    isEnabled: true,
    repeatDays: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
  },
];

export const initialAlerts: AlertNotification[] = [
  {
    id: 'alert_1',
    title: 'Phát hiện chuyển động ở Ban công',
    message: 'Camera AI ghi nhận chuyển động lúc 20:15 hôm nay.',
    timestamp: '20:15 Hôm nay',
    type: 'security',
    isRead: false,
    deviceId: 'dev_camera_balcony',
  },
  {
    id: 'alert_2',
    title: 'Nhiệt độ phòng ngủ đạt mức tối ưu',
    message: 'Nhiệt độ phòng ngủ duy trì ổn định ở 26°C.',
    timestamp: '19:40 Hôm nay',
    type: 'info',
    isRead: true,
    deviceId: 'dev_ac_bedroom',
  },
  {
    id: 'alert_3',
    title: 'Đã kích hoạt Kịch bản Về nhà',
    message: 'Tự động bật đèn và điều hòa phòng khách.',
    timestamp: '18:30 Hôm nay',
    type: 'device',
    isRead: true,
  },
];
