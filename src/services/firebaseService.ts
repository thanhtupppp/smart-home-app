import { Device, FirebaseConfig, AlertNotification } from "../types";
import { authService } from "./authService";
import { secureStorage } from "./storageService";

const CONFIG_STORAGE_KEY = "tu_smarthome_firebase_config";

export class FirebaseService {
  private config: FirebaseConfig = {
    databaseURL:
      "https://tu-smart-home-1dcb8-default-rtdb.asia-southeast1.firebasedatabase.app",
    apiKey: "AIzaSyB1LxkzmFpYhHBnfkbfzN7SbcqYUI-of1o",
    authSecret: "",
    isDemoMode: false,
  };

  private listeners: ((devices: Device[]) => void)[] = [];
  private alertListeners: ((alerts: AlertNotification[]) => void)[] = [];
  private isConnected = false;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private alertPollInterval: ReturnType<typeof setInterval> | null = null;
  private lastDeviceSnapshot = "";
  private lastAlertSnapshot = "";
  private configLoaded = false;

  constructor() {
    if (this.config.apiKey) {
      authService.setApiKey(this.config.apiKey);
    }
  }

  /**
   * Nạp cấu hình Firebase đã lưu từ phiên trước (gọi một lần khi app khởi động).
   * Nếu chưa từng lưu, giữ cấu hình mặc định.
   */
  public async loadPersistedConfig(): Promise<FirebaseConfig> {
    try {
      const json = await secureStorage.getItem(CONFIG_STORAGE_KEY);
      if (json) {
        const stored = JSON.parse(json) as Partial<FirebaseConfig>;
        if (stored && typeof stored === "object") {
          this.config = { ...this.config, ...stored };
        }
      }
    } catch {
      // Giữ cấu hình mặc định nếu storage lỗi
    }
    this.configLoaded = true;
    this.applyConfigSideEffects();
    return this.config;
  }

  public isConfigLoaded(): boolean {
    return this.configLoaded;
  }

  public setConfig(newConfig: FirebaseConfig) {
    this.config = { ...newConfig };
    this.configLoaded = true;
    this.applyConfigSideEffects();
    // Lưu cấu hình để phiên sau khởi động với đúng project Firebase
    secureStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(this.config)).catch(() => {});
  }

  private applyConfigSideEffects() {
    if (this.config.apiKey) {
      authService.setApiKey(this.config.apiKey);
    }
    if (!this.config.isDemoMode && this.config.databaseURL) {
      this.initRealtimeSync();
    } else {
      this.stopSync();
    }
  }

  public getConfig(): FirebaseConfig {
    return this.config;
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Token còn hiệu lực (tự làm mới nếu sắp hết hạn). Rơi về auth secret nếu không có user.
   */
  public async getAuthParamAsync(): Promise<string> {
    const token = (await authService.getValidIdToken()) || this.config.authSecret;
    return token ? `?auth=${encodeURIComponent(token)}` : "";
  }

  public subscribe(callback: (devices: Device[]) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  public subscribeAlerts(callback: (alerts: AlertNotification[]) => void) {
    this.alertListeners.push(callback);
    return () => {
      this.alertListeners = this.alertListeners.filter((cb) => cb !== callback);
    };
  }

  private notifyListeners(devices: Device[]) {
    this.listeners.forEach((cb) => cb(devices));
  }

  private notifyAlertListeners(alerts: AlertNotification[]) {
    this.alertListeners.forEach((cb) => cb(alerts));
  }

  /**
   * Fetch tới RTDB kèm auth token; nếu bị 401 (token hết hạn/vô hiệu) thì
   * làm mới token và thử lại đúng 1 lần.
   */
  private async requestWithAuth(path: string, options: RequestInit = {}): Promise<Response> {
    let token = (await authService.getValidIdToken()) || this.config.authSecret;
    const buildUrl = () =>
      `${this.sanitizeUrl(this.config.databaseURL)}${path}.json${
        token ? `?auth=${encodeURIComponent(token)}` : ""
      }`;

    let response = await fetch(buildUrl(), options);

    if (response.status === 401) {
      const fresh = await authService.refreshToken();
      if (fresh) {
        token = fresh;
        response = await fetch(buildUrl(), options);
      }
    }

    return response;
  }

  public async syncDeviceState(
    device: Partial<Device> & { id: string },
  ): Promise<boolean> {
    if (this.config.isDemoMode || !this.config.databaseURL) {
      return true; // Instant simulated sync in demo mode
    }

    try {
      const response = await this.requestWithAuth(`/devices/${device.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(device),
      });

      return response.ok;
    } catch (err) {
      console.warn(
        "Firebase sync error, operating in offline/local mode:",
        err,
      );
      return false;
    }
  }

  public async saveDevice(device: Device): Promise<boolean> {
    if (this.config.isDemoMode || !this.config.databaseURL) return true;
    try {
      const response = await this.requestWithAuth(`/devices/${device.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(device),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  public async removeDevice(deviceId: string): Promise<boolean> {
    if (this.config.isDemoMode || !this.config.databaseURL) return true;
    try {
      const response = await this.requestWithAuth(`/devices/${deviceId}`, {
        method: "DELETE",
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  public async clearAllDevices(): Promise<boolean> {
    if (this.config.isDemoMode || !this.config.databaseURL) return true;
    try {
      const response = await this.requestWithAuth("/devices", {
        method: "DELETE",
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Lấy danh sách thiết bị kèm trạng thái request:
   * - ok=false: lỗi mạng/xác thực -> KHÔNG được xóa dữ liệu hiện có của app.
   * - ok=true, data=null: node /devices trên Firebase trống (mọi thiết bị đã bị xóa).
   * - ok=true, data={...}: dữ liệu thực tế từ Firebase.
   */
  public async fetchDevicesDetailed(): Promise<{
    ok: boolean;
    data: Record<string, Device> | null;
  }> {
    if (this.config.isDemoMode || !this.config.databaseURL) {
      return { ok: false, data: null };
    }

    try {
      const response = await this.requestWithAuth("/devices", { method: "GET" });
      if (response.ok) {
        this.isConnected = true;
        return { ok: true, data: await response.json() };
      }
      this.isConnected = false;
      return { ok: false, data: null };
    } catch (err) {
      this.isConnected = false;
      return { ok: false, data: null };
    }
  }

  public async fetchDevices(): Promise<Record<string, Device> | null> {
    const result = await this.fetchDevicesDetailed();
    return result.ok ? result.data : null;
  }

  public async fetchMembers(): Promise<Record<string, any> | null> {
    if (this.config.isDemoMode || !this.config.databaseURL) return null;
    try {
      const response = await this.requestWithAuth("/members", { method: "GET" });
      if (response.ok) return await response.json();
      return null;
    } catch {
      return null;
    }
  }

  public async saveMember(member: {
    id: string;
    name: string;
    email: string;
    role: string;
    roomsCount?: number;
    createdAt?: string;
  }): Promise<boolean> {
    if (this.config.isDemoMode || !this.config.databaseURL) return true;
    try {
      const response = await this.requestWithAuth(`/members/${member.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(member),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  public async removeMember(memberId: string): Promise<boolean> {
    if (this.config.isDemoMode || !this.config.databaseURL) return true;
    try {
      const response = await this.requestWithAuth(`/members/${memberId}`, {
        method: 'DELETE',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  public async fetchHomes(): Promise<Record<string, any> | null> {
    if (this.config.isDemoMode || !this.config.databaseURL) return null;
    try {
      const response = await this.requestWithAuth("/homes", { method: "GET" });
      if (response.ok) return await response.json();
      return null;
    } catch {
      return null;
    }
  }

  public async saveHome(home: {
    id: string;
    name: string;
    address?: string;
    icon?: string;
    isCurrent?: boolean;
    createdAt?: string;
  }): Promise<boolean> {
    if (this.config.isDemoMode || !this.config.databaseURL) return true;
    try {
      const response = await this.requestWithAuth(`/homes/${home.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(home),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  public async removeHome(homeId: string): Promise<boolean> {
    if (this.config.isDemoMode || !this.config.databaseURL) return true;
    try {
      const response = await this.requestWithAuth(`/homes/${homeId}`, {
        method: 'DELETE',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  public async fetchRooms(): Promise<Record<string, any> | null> {
    if (this.config.isDemoMode || !this.config.databaseURL) return null;
    try {
      const response = await this.requestWithAuth("/rooms", { method: "GET" });
      if (response.ok) return await response.json();
      return null;
    } catch {
      return null;
    }
  }

  public async saveRoom(room: any): Promise<boolean> {
    if (this.config.isDemoMode || !this.config.databaseURL) return true;
    try {
      const response = await this.requestWithAuth(`/rooms/${room.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(room),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  public async removeRoom(roomId: string): Promise<boolean> {
    if (this.config.isDemoMode || !this.config.databaseURL) return true;
    try {
      const response = await this.requestWithAuth(`/rooms/${roomId}`, {
        method: 'DELETE',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  public async logAlert(alert: AlertNotification): Promise<void> {
    if (this.config.isDemoMode || !this.config.databaseURL) return;
    try {
      await this.requestWithAuth(`/alerts/${alert.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(alert),
      });
    } catch (err) {
      // offline silent
    }
  }

  /**
   * Lấy toàn bộ cảnh báo từ node /alerts (ESP32 push lên khi quá nhiệt, camera...).
   * Semantics giống fetchDevicesDetailed: ok=false nghĩa là giữ nguyên dữ liệu hiện tại.
   */
  private async fetchAlertsDetailed(): Promise<{
    ok: boolean;
    data: Record<string, AlertNotification> | null;
  }> {
    if (this.config.isDemoMode || !this.config.databaseURL) {
      return { ok: false, data: null };
    }
    try {
      const response = await this.requestWithAuth("/alerts", { method: "GET" });
      if (response.ok) {
        return { ok: true, data: await response.json() };
      }
      return { ok: false, data: null };
    } catch {
      return { ok: false, data: null };
    }
  }

  /**
   * Lấy cảnh báo đã chuẩn hóa (mới nhất lên đầu, id = key Firebase).
   * Trả về null khi lỗi mạng/auth -> nơi gọi phải GIỮ NGUYÊN dữ liệu hiện tại.
   */
  public async fetchAlerts(): Promise<AlertNotification[] | null> {
    const result = await this.fetchAlertsDetailed();
    if (!result.ok) return null;
    return this.normalizeAlerts(result.data);
  }

  public async markAlertRead(alertId: string): Promise<boolean> {
    if (this.config.isDemoMode || !this.config.databaseURL) return true;
    try {
      const response = await this.requestWithAuth(`/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private initRealtimeSync() {
    this.stopSync();
    // Poll thiết bị mỗi 3 giây (nhẹ pin, không cần giữ kết nối thường trực).
    // Snapshot JSON để chỉ notify khi dữ liệu THỰC SỰ thay đổi.
    this.pollInterval = setInterval(async () => {
      const result = await this.fetchDevicesDetailed();
      if (!result.ok) return; // Lỗi mạng -> giữ nguyên trạng thái app
      const devicesList = Object.values(result.data || {});
      // Sắp xếp theo id để snapshot ổn định, không phụ thuộc thứ tự trả về
      devicesList.sort((a, b) => a.id.localeCompare(b.id));
      const snapshot = JSON.stringify(devicesList);
      if (snapshot === this.lastDeviceSnapshot) return;
      this.lastDeviceSnapshot = snapshot;
      // Notify KỂ CẢ danh sách rỗng -> thiết bị bị xóa trên Firebase sẽ biến mất trong app
      this.notifyListeners(devicesList);
    }, 3000);

    // Poll cảnh báo mỗi 5 giây
    this.alertPollInterval = setInterval(async () => {
      const result = await this.fetchAlertsDetailed();
      if (!result.ok) return;
      const alerts = this.normalizeAlerts(result.data);
      const snapshot = JSON.stringify(alerts);
      if (snapshot === this.lastAlertSnapshot) return;
      this.lastAlertSnapshot = snapshot;
      this.notifyAlertListeners(alerts);
    }, 5000);
  }

  /**
   * Chuẩn hóa node /alerts: dùng key Firebase làm id (ESP32 push bằng pushJSON
   * nên key node khác trường "id" nội bộ), đảo thứ tự để alert mới nhất lên đầu
   * (push key của Firebase sắp xếp tăng dần theo thời gian).
   */
  private normalizeAlerts(
    data: Record<string, AlertNotification> | null,
  ): AlertNotification[] {
    if (!data) return [];
    return Object.entries(data)
      .reverse()
      .map(([key, value]) => ({ ...(value || {}), id: key }));
  }

  private stopSync() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.alertPollInterval) {
      clearInterval(this.alertPollInterval);
      this.alertPollInterval = null;
    }
    // Reset snapshot để lần sync sau (VD: đổi project Firebase) notify lại ngay
    this.lastDeviceSnapshot = "";
    this.lastAlertSnapshot = "";
  }

  private sanitizeUrl(url: string): string {
    return url.replace(/\/+$/, "");
  }
}

export const firebaseService = new FirebaseService();
