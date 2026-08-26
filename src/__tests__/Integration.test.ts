import { commandQueueService } from '../services/commandQueueService';
import { firebaseService } from '../services/firebaseService';
import { notificationService } from '../services/notificationService';
import { safeStorage, getScopedCacheKey } from '../services/storageService';
import { Device } from '../types';

describe('P1 Integration & Service Tests', () => {
  beforeEach(async () => {
    await commandQueueService.clearQueue();
    jest.clearAllMocks();
  });

  describe('CommandQueueService (Offline Queue & Debounce)', () => {
    it('should enqueue commands and track queue size when offline', async () => {
      expect(commandQueueService.getQueueLength()).toBe(0);

      const id = await commandQueueService.enqueue(
        'dev_light_living_01',
        { type: 'power', value: true },
        'user_test'
      );

      expect(id).toContain('queued_cmd_');
      expect(commandQueueService.getQueueLength()).toBe(1);
    });

    it('should debounce slider commands properly', (done) => {
      const mockAction = jest.fn();
      commandQueueService.debounce('slider_test', mockAction, 50);
      commandQueueService.debounce('slider_test', mockAction, 50);
      commandQueueService.debounce('slider_test', mockAction, 50);

      expect(mockAction).not.toHaveBeenCalled();

      setTimeout(() => {
        expect(mockAction).toHaveBeenCalledTimes(1);
        done();
      }, 80);
    });
  });

  describe('Real-time Heartbeat & Normalization', () => {
    it('should calculate isOnline = true when lastSeenAt is recent', () => {
      const rawData = {
        dev_01: {
          id: 'dev_01',
          name: 'Living Light',
          type: 'light',
          reported: {
            isOn: true,
            lastSeenAt: Date.now() - 10_000, // 10s ago
          },
        },
      };

      const normalized = firebaseService.normalizeDevices(rawData);
      expect(normalized.length).toBe(1);
      expect(normalized[0].isOnline).toBe(true);
      expect(normalized[0].isOn).toBe(true);
    });

    it('should calculate isOnline = false when lastSeenAt is older than timeout threshold', () => {
      // Temporarily ensure demo mode is false for this test
      const prevConfig = firebaseService.getConfig();
      firebaseService.setConfig({ ...prevConfig, isDemoMode: false });

      const rawData = {
        dev_02: {
          id: 'dev_02',
          name: 'Bedroom AC',
          type: 'ac',
          reported: {
            isOn: true,
            lastSeenAt: Date.now() - 120_000, // 120s ago (> 75s threshold)
          },
        },
      };

      const normalized = firebaseService.normalizeDevices(rawData);
      expect(normalized.length).toBe(1);
      expect(normalized[0].isOnline).toBe(false);

      firebaseService.setConfig(prevConfig);
    });
  });

  describe('NotificationService', () => {
    it('should trigger local notifications without error', async () => {
      await expect(
        notificationService.sendLocalAlert({
          title: '🚨 Cảnh báo thử nghiệm',
          body: 'Test alert content',
        })
      ).resolves.not.toThrow();
    });
  });

  describe('Multi-Home Scoped Cache & Safe Logout', () => {
    it('should generate correct scoped cache keys per user and home', () => {
      const key1 = getScopedCacheKey('devices', 'uid_alice', 'home_main');
      const key2 = getScopedCacheKey('devices', 'uid_bob', 'home_main');
      const key3 = getScopedCacheKey('devices', 'uid_alice', 'home_villa');

      expect(key1).toBe('tusmarthome:uid_alice:home_main:devices');
      expect(key2).toBe('tusmarthome:uid_bob:home_main:devices');
      expect(key3).toBe('tusmarthome:uid_alice:home_villa:devices');
      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
    });

    it('should isolate user-scoped data upon logout without wiping global configs', async () => {
      const uid = 'user_123';
      const homeId = 'home_main';
      const devKey = getScopedCacheKey('devices', uid, homeId);

      await safeStorage.setItem(devKey, JSON.stringify([{ id: 'dev_1' }]));
      await safeStorage.setItem('app_theme', 'dark');

      expect(await safeStorage.getItem(devKey)).not.toBeNull();
      expect(await safeStorage.getItem('app_theme')).toBe('dark');

      await safeStorage.clearUserScopedData(uid);

      expect(await safeStorage.getItem(devKey)).toBeNull();
      // Global app settings remain intact
      expect(await safeStorage.getItem('app_theme')).toBe('dark');
    });
  });

  describe('Multi-Home & Command Sequence Tracking', () => {
    it('should switch active home and update paths accordingly', async () => {
      expect(firebaseService.getActiveHomeId()).toBeDefined();
      await firebaseService.setActiveHome('home_vacation');
      expect(firebaseService.getActiveHomeId()).toBe('home_vacation');
      await firebaseService.setActiveHome('home_main');
      expect(firebaseService.getActiveHomeId()).toBe('home_main');
    });

    it('should increment command sequences and generate unique commandIds', async () => {
      const cmdId1 = await firebaseService.sendCommand(
        'dev_light_01',
        { type: 'power', value: true },
        'user_test'
      );
      const cmdId2 = await firebaseService.sendCommand(
        'dev_light_01',
        { type: 'power', value: false },
        'user_test'
      );

      expect(cmdId1).toBeTruthy();
      expect(cmdId2).toBeTruthy();
      expect(cmdId1).not.toBe(cmdId2);
    });
  });
});
