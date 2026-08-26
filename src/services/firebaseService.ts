import {
  Device,
  FirebaseConfig,
  AlertNotification,
  CommandRecord,
  DeviceCommand,
  HomeConnectionStatus,
} from "../types";
import { authService } from "./authService";
import { secureStorage } from "./storageService";
import { appConfig } from "../config/appConfig";

const CONFIG_STORAGE_KEY = "tu_smarthome_firebase_config";
const ACTIVE_HOME_KEY = "tu_smarthome_active_home_id";

/** Tạo command ID dạng cmd_{timestamp}_{random} */
function generateCommandId(): string {
  return `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Chuyển DeviceCommand thành patch object ghi vào desired */
function commandToDesiredPatch(cmd: DeviceCommand): Record<string, unknown> {
  switch (cmd.type) {
    case "power":
      return { isOn: cmd.value };
    case "brightness":
      return { brightness: cmd.value };
    case "temperature":
      return { temperature: cmd.value };
    case "rgb":
      return {
        color: cmd.color,
        ...(cmd.brightness !== undefined && { brightness: cmd.brightness }),
        ...(cmd.mode && { rgbMode: cmd.mode }),
      };
    case "acMode":
      return { acMode: cmd.value };
    case "fanSpeed":
      return { fanSpeed: cmd.value };
    case "curtain":
      return { isOn: cmd.value };
  }
}

export class FirebaseService {
  // Giá trị mặc định lấy từ .env (EXPO_PUBLIC_*); nếu trống thì người dùng
  // tự nhập qua màn hình "Cấu hình Firebase" và config đó được lưu lâu dài.
  private config: FirebaseConfig = {
    databaseURL: appConfig.firebaseDatabaseURL,
    apiKey: appConfig.firebaseApiKey,
    isDemoMode: false,
  };

  /** homeId hiện hành — tất cả paths đều được scope theo giá trị này */
  private activeHomeId: string = "home_main";

  private listeners: ((devices: Device[]) => void)[] = [];
  private alertListeners: ((alerts: AlertNotification[]) => void)[] = [];
  private connectionListeners: ((status: HomeConnectionStatus) => void)[] = [];

  private connectionStatus: HomeConnectionStatus = "offline";
  private consecutiveFailures = 0;

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

  // ─── Config / Bootstrap ─────────────────────────────────────────────────

  /**
   * Nạp cấu hình Firebase đã lưu từ phiên trước (gọi một lần khi app khởi động).
   */
  public async loadPersistedConfig(): Promise<FirebaseConfig> {
    try {
      const json = await secureStorage.getItem(CONFIG_STORAGE_KEY);
      if (json) {
        const stored = JSON.parse(json) as Partial<FirebaseConfig>;
        if (stored && typeof stored === "object") {
          // Đảm bảo không bao giờ có authSecret trong config (migration safety)
          const { ...safeStored } = stored as any;
          delete safeStored.authSecret;
          this.config = { ...this.config, ...safeStored };
        }
      }
    } catch {
      // Giữ cấu hình mặc định nếu storage lỗi
    }

    // Nạp activeHomeId đã lưu
    try {
      const savedHomeId = await secureStorage.getItem(ACTIVE_HOME_KEY);
      if (savedHomeId) this.activeHomeId = savedHomeId;
    } catch {
      // Giữ mặc định
    }

    this.configLoaded = true;
    this.applyConfigSideEffects();
    return this.config;
  }

  public isConfigLoaded(): boolean {
    return this.configLoaded;
  }

  public setConfig(newConfig: FirebaseConfig) {
    const { ...safeConfig } = newConfig as any;
    delete safeConfig.authSecret; // bảo vệ khỏi code cũ gửi authSecret
    this.config = { ...safeConfig };
    this.configLoaded = true;
    this.applyConfigSideEffects();
    secureStorage
      .setItem(CONFIG_STORAGE_KEY, JSON.stringify(this.config))
      .catch(() => {});
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

  // ─── Active Home ─────────────────────────────────────────────────────────

  public getActiveHomeId(): string {
    return this.activeHomeId;
  }

  public async setActiveHome(homeId: string): Promise<void> {
    this.activeHomeId = homeId;
    await secureStorage.setItem(ACTIVE_HOME_KEY, homeId).catch(() => {});
    // Reset snapshot để force notify ngay khi switch home
    this.lastDeviceSnapshot = "";
    this.lastAlertSnapshot = "";
    // Restart sync với homeId mới
    if (!this.config.isDemoMode && this.config.databaseURL) {
      this.initRealtimeSync();
    }
  }

  /** Gọi khi logout — xóa activeHomeId khỏi storage và dừng sync */
  public async clearActiveHome(): Promise<void> {
    this.activeHomeId = "home_main";
    await secureStorage.removeItem(ACTIVE_HOME_KEY).catch(() => {});
    this.stopSync();
    this.setConnectionStatus("offline");
  }

  // ─── Connection Status ───────────────────────────────────────────────────

  private setConnectionStatus(status: HomeConnectionStatus) {
    if (this.connectionStatus === status) return;
    this.connectionStatus = status;
    this.connectionListeners.forEach((cb) => cb(status));
  }

  public getConnectionStatus(): HomeConnectionStatus {
    return this.connectionStatus;
  }

  public subscribeConnectionStatus(
    callback: (status: HomeConnectionStatus) => void
  ) {
    this.connectionListeners.push(callback);
    callback(this.connectionStatus);
    return () => {
      this.connectionListeners = this.connectionListeners.filter(
        (cb) => cb !== callback
      );
    };
  }

  // ─── Auth ────────────────────────────────────────────────────────────────

  /**
   * Lấy token hợp lệ (tự làm mới nếu sắp hết hạn).
   * KHÔNG fallback về authSecret — chỉ dùng Firebase ID Token.
   */
  public async getAuthParamAsync(): Promise<string> {
    const token = await authService.getValidIdToken();
    return token ? `?auth=${encodeURIComponent(token)}` : "";
  }

  // ─── Path helpers ────────────────────────────────────────────────────────

  /** Đường dẫn gốc của home hiện hành */
  private homePath(): string {
    return `/homes/${this.activeHomeId}`;
  }

  private devicePath(deviceId: string): string {
    return `${this.homePath()}/devices/${deviceId}`;
  }

  private roomPath(roomId: string): string {
    return `${this.homePath()}/rooms/${roomId}`;
  }

  private memberPath(uid: string): string {
    return `${this.homePath()}/members/${uid}`;
  }

  private commandPath(commandId: string): string {
    return `${this.homePath()}/commands/${commandId}`;
  }

  // ─── HTTP helper ─────────────────────────────────────────────────────────

  private sanitizeUrl(url: string): string {
    return url.replace(/\/+$/, "");
  }

  /**
   * Fetch tới RTDB kèm auth token; nếu bị 401 thì làm mới token và thử lại 1 lần.
   */
  private async requestWithAuth(
    path: string,
    options: RequestInit = {}
  ): Promise<Response> {
    let token = await authService.getValidIdToken();
    const buildUrl = () =>
      `${this.sanitizeUrl(this.config.databaseURL)}${path}.json${
        token ? `?auth=${encodeURIComponent(token!)}` : ""
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

  // ─── Subscriptions ───────────────────────────────────────────────────────

  public subscribe(callback: (devices: Device[]) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  public subscribeAlerts(callback: (alerts: AlertNotification[]) => void) {
    this.alertListeners.push(callback);
    return () => {
      this.alertListeners = this.alertListeners.filter(
        (cb) => cb !== callback
      );
    };
  }

  private notifyListeners(devices: Device[]) {
    this.listeners.forEach((cb) => cb(devices));
  }

  private notifyAlertListeners(alerts: AlertNotification[]) {
    this.alertListeners.forEach((cb) => cb(alerts));
  }

  // ─── Devices ─────────────────────────────────────────────────────────────

  public async syncDeviceState(
    device: Partial<Device> & { id: string }
  ): Promise<boolean> {
    if (this.config.isDemoMode || !this.config.databaseURL) return true;
    try {
      // Ghi vào desired (app muốn thiết bị làm gì)
      const { id, ...patch } = device;
      const response = await this.requestWithAuth(
        `${this.devicePath(id)}/desired`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        }
      );
      return response.ok;
    } catch (err) {
      console.warn("Firebase sync error, operating in offline/local mode:", err);
      return false;
    }
  }

  /**
   * Tạo command record và ghi desired — protocol lệnh/ack chính thức.
   * Trả về commandId nếu thành công, null nếu lỗi.
   */
  public async sendCommand(
    deviceId: string,
    command: DeviceCommand,
    requestedBy: string
  ): Promise<string | null> {
    if (this.config.isDemoMode || !this.config.databaseURL) {
      // Demo mode: giả lập thành công
      return generateCommandId();
    }

    const commandId = generateCommandId();
    const now = Date.now();
    const patch = commandToDesiredPatch(command);

    const commandRecord: CommandRecord = {
      id: commandId,
      deviceId,
      type: command.type,
      payload: patch,
      requestedBy,
      requestedAt: now,
      status: "pending",
      expiresAt: now + 15_000,
    };

    try {
      // 1. Ghi command record
      const cmdRes = await this.requestWithAuth(this.commandPath(commandId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(commandRecord),
      });
      if (!cmdRes.ok) return null;

      // 2. Ghi desired state kèm commandId
      const desiredRes = await this.requestWithAuth(
        `${this.devicePath(deviceId)}/desired`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...patch, commandId }),
        }
      );
      if (!desiredRes.ok) return null;

      return commandId;
    } catch {
      return null;
    }
  }

  /** Cập nhật status của command (timeout/applied/failed) */
  public async updateCommandStatus(
    commandId: string,
    status: "timeout" | "failed"
  ): Promise<void> {
    if (this.config.isDemoMode || !this.config.databaseURL) return;
    try {
      await this.requestWithAuth(this.commandPath(commandId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    } catch {
      // Offline — ignore
    }
  }

  public async saveDevice(device: Device): Promise<boolean> {
    if (this.config.isDemoMode || !this.config.databaseURL) return true;
    try {
      const response = await this.requestWithAuth(this.devicePath(device.id), {
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
      const response = await this.requestWithAuth(this.devicePath(deviceId), {
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
      const response = await this.requestWithAuth(
        `${this.homePath()}/devices`,
        { method: "DELETE" }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Lấy danh sách thiết bị kèm trạng thái request.
   * - ok=false: lỗi mạng/xác thực → KHÔNG xóa dữ liệu hiện có.
   * - ok=true, data=null: node trống (mọi thiết bị đã bị xóa).
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
      const response = await this.requestWithAuth(
        `${this.homePath()}/devices`,
        { method: "GET" }
      );
      if (response.ok) {
        return { ok: true, data: await response.json() };
      }
      return { ok: false, data: null };
    } catch {
      return { ok: false, data: null };
    }
  }

  public async fetchDevices(): Promise<Record<string, Device> | null> {
    const result = await this.fetchDevicesDetailed();
    return result.ok ? result.data : null;
  }

  // ─── Rooms ───────────────────────────────────────────────────────────────

  public async fetchRooms(): Promise<Record<string, any> | null> {
    if (this.config.isDemoMode || !this.config.databaseURL) return null;
    try {
      const response = await this.requestWithAuth(
        `${this.homePath()}/rooms`,
        { method: "GET" }
      );
      if (response.ok) return await response.json();
      return null;
    } catch {
      return null;
    }
  }

  public async saveRoom(room: any): Promise<boolean> {
    if (this.config.isDemoMode || !this.config.databaseURL) return true;
    try {
      const response = await this.requestWithAuth(this.roomPath(room.id), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
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
      const response = await this.requestWithAuth(this.roomPath(roomId), {
        method: "DELETE",
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // ─── Members ─────────────────────────────────────────────────────────────

  public async fetchMembers(): Promise<Record<string, any> | null> {
    if (this.config.isDemoMode || !this.config.databaseURL) return null;
    try {
      const response = await this.requestWithAuth(
        `${this.homePath()}/members`,
        { method: "GET" }
      );
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
    isActivated?: boolean;
    lastLoginAt?: string;
  }): Promise<boolean> {
    if (this.config.isDemoMode || !this.config.databaseURL) return true;
    try {
      const response = await this.requestWithAuth(
        this.memberPath(member.id),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(member),
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  public async removeMember(memberId: string): Promise<boolean> {
    if (this.config.isDemoMode || !this.config.databaseURL) return true;
    try {
      const response = await this.requestWithAuth(this.memberPath(memberId), {
        method: "DELETE",
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // ─── Homes (meta) ────────────────────────────────────────────────────────

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
    ownerUid?: string;
    createdAt?: string;
  }): Promise<boolean> {
    if (this.config.isDemoMode || !this.config.databaseURL) return true;
    try {
      const response = await this.requestWithAuth(`/homes/${home.id}/meta`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
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
        method: "DELETE",
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // ─── Alerts ──────────────────────────────────────────────────────────────

  public async logAlert(alert: AlertNotification): Promise<void> {
    if (this.config.isDemoMode || !this.config.databaseURL) return;
    try {
      await this.requestWithAuth(`${this.homePath()}/alerts/${alert.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(alert),
      });
    } catch {
      // offline silent
    }
  }

  private async fetchAlertsDetailed(): Promise<{
    ok: boolean;
    data: Record<string, AlertNotification> | null;
  }> {
    if (this.config.isDemoMode || !this.config.databaseURL) {
      return { ok: false, data: null };
    }
    try {
      const response = await this.requestWithAuth(
        `${this.homePath()}/alerts`,
        { method: "GET" }
      );
      if (response.ok) {
        return { ok: true, data: await response.json() };
      }
      return { ok: false, data: null };
    } catch {
      return { ok: false, data: null };
    }
  }

  public async fetchAlerts(): Promise<AlertNotification[] | null> {
    const result = await this.fetchAlertsDetailed();
    if (!result.ok) return null;
    return this.normalizeAlerts(result.data);
  }

  public async markAlertRead(alertId: string): Promise<boolean> {
    if (this.config.isDemoMode || !this.config.databaseURL) return true;
    try {
      const response = await this.requestWithAuth(
        `${this.homePath()}/alerts/${alertId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isRead: true }),
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  // ─── Scenes ──────────────────────────────────────────────────────────────

  public async fetchScenes(): Promise<Record<string, any> | null> {
    if (this.config.isDemoMode || !this.config.databaseURL) return null;
    try {
      const response = await this.requestWithAuth(
        `${this.homePath()}/scenes`,
        { method: "GET" }
      );
      if (response.ok) return await response.json();
      return null;
    } catch {
      return null;
    }
  }

  public async saveScene(scene: any): Promise<boolean> {
    if (this.config.isDemoMode || !this.config.databaseURL) return true;
    try {
      const response = await this.requestWithAuth(
        `${this.homePath()}/scenes/${scene.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(scene),
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  // ─── Overview ────────────────────────────────────────────────────────────

  public async updateOverviewField(
    field: string,
    value: unknown
  ): Promise<void> {
    if (this.config.isDemoMode || !this.config.databaseURL) return;
    try {
      await this.requestWithAuth(`${this.homePath()}/meta`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
    } catch {
      // Fallback
    }
  }

  // ─── Realtime Polling ────────────────────────────────────────────────────

  private initRealtimeSync() {
    this.stopSync();

    // Poll thiết bị mỗi 3 giây
    this.pollInterval = setInterval(async () => {
      const result = await this.fetchDevicesDetailed();

      if (!result.ok) {
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= 2) {
          this.setConnectionStatus(
            this.connectionStatus === "offline" ? "offline" : "reconnecting"
          );
          if (this.consecutiveFailures >= 4) {
            this.setConnectionStatus("offline");
          }
        }
        return;
      }

      // Kết nối thành công
      this.consecutiveFailures = 0;
      this.setConnectionStatus("connected");

      const devicesList = Object.values(result.data || {});
      devicesList.sort((a, b) => a.id.localeCompare(b.id));
      const snapshot = JSON.stringify(devicesList);
      if (snapshot === this.lastDeviceSnapshot) return;
      this.lastDeviceSnapshot = snapshot;
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

  private normalizeAlerts(
    data: Record<string, AlertNotification> | null
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
    this.lastDeviceSnapshot = "";
    this.lastAlertSnapshot = "";
  }
}

export const firebaseService = new FirebaseService();
