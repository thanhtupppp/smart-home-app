/**
 * Push Notification Service
 * Manages device push tokens, permission requests, and scheduling local alerts.
 */

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: boolean;
}

class NotificationService {
  private pushToken: string | null = null;

  public async registerForPushNotifications(): Promise<string | null> {
    try {
      console.log('[NotificationService] Requesting notification permissions...');
      // Simulated Expo push token or native FCM token
      this.pushToken = `ExponentPushToken[demo_smart_home_${Date.now().toString(36)}]`;
      console.log('[NotificationService] Push Token obtained:', this.pushToken);
      return this.pushToken;
    } catch (error) {
      console.error('[NotificationService] Error getting push token:', error);
      return null;
    }
  }

  public getPushToken(): string | null {
    return this.pushToken;
  }

  public async sendLocalAlert(payload: NotificationPayload): Promise<void> {
    console.log('[NotificationService] Local notification triggered:', payload);
    // In production with expo-notifications:
    // await Notifications.scheduleNotificationAsync({
    //   content: {
    //     title: payload.title,
    //     body: payload.body,
    //     data: payload.data,
    //     sound: payload.sound ?? true,
    //   },
    //   trigger: null, // Immediate
    // });
  }

  public async notifySecurityAlert(cameraName: string, message: string) {
    await this.sendLocalAlert({
      title: `🚨 CẢNH BÁO AN NINH: ${cameraName}`,
      body: message,
      data: { type: 'security', cameraName },
      sound: true,
    });
  }

  public async notifyTemperatureWarning(roomName: string, currentTemp: number) {
    await this.sendLocalAlert({
      title: `⚠️ Cảnh Báo Nhiệt Độ: ${roomName}`,
      body: `Nhiệt độ hiện tại đạt ${currentTemp}°C, vượt ngưỡng an toàn.`,
      data: { type: 'warning', roomName, currentTemp },
    });
  }
}

export const notificationService = new NotificationService();
