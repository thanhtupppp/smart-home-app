import { sentryService } from '../services/sentryService';
import { notificationService } from '../services/notificationService';
import { updateService } from '../services/updateService';

describe('Production Services Tests', () => {
  describe('SentryService', () => {
    it('should initialize without error', () => {
      expect(() => sentryService.init({ environment: 'test' })).not.toThrow();
    });

    it('should capture exceptions cleanly', () => {
      const testError = new Error('Test crash event');
      expect(() => sentryService.captureException(testError, { screen: 'Dashboard' })).not.toThrow();
    });

    it('should add breadcrumbs and set user context', () => {
      expect(() => sentryService.addBreadcrumb('navigation', 'User clicked AC button')).not.toThrow();
      expect(() => sentryService.setUser({ id: 'user_123', email: 'thanh@smarthome.vn' })).not.toThrow();
    });
  });

  describe('NotificationService', () => {
    it('should register and return push token', async () => {
      const token = await notificationService.registerForPushNotifications();
      expect(token).toContain('ExponentPushToken');
      expect(notificationService.getPushToken()).toBe(token);
    });

    it('should trigger local security and temperature alerts without crashing', async () => {
      await expect(
        notificationService.notifySecurityAlert('Cổng chính', 'Phát hiện chuyển động lạ')
      ).resolves.not.toThrow();

      await expect(
        notificationService.notifyTemperatureWarning('Phòng khách', 38.5)
      ).resolves.not.toThrow();
    });
  });

  describe('UpdateService (OTA)', () => {
    it('should check for updates gracefully', async () => {
      const result = await updateService.checkForUpdates();
      expect(result).toHaveProperty('isAvailable');
      expect(typeof result.isAvailable).toBe('boolean');
    });

    it('should handle fetch and reload without throwing unhandled exceptions', async () => {
      await expect(updateService.fetchAndReload()).resolves.not.toThrow();
    });
  });
});
