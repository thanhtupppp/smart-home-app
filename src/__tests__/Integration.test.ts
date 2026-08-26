import { commandQueueService } from '../services/commandQueueService';
import { firebaseService } from '../services/firebaseService';
import { notificationService } from '../services/notificationService';
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
});
