import {
  Device,
  FirebaseConfig,
  AlertNotification,
  CommandRecord,
  DeviceCommand,
  HomeConnectionStatus,
  UserHomeIndex,
  HomeMeta,
  BatchCommandItem,
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

  /** Theo dõi sequence cho từng thiết bị để chống out-of-order execution */
  private deviceSequences: Record<string, number> = {};

  private listeners: { callback: (devices: Device[]) => void; homeId: string }[] = [];
  private alertListeners: { callback: (alerts: AlertNotification[]) => void; homeId: string }[] = [];
  private connectionListeners: ((status: HomeConnectionStatus) => void)[] = [];

  private connectionStatus: HomeConnectionStatus = "offline";
  private consecutiveFailures = 0;

  /** Token chống stale response khi chuyển home liên tục */
  private syncGeneration = 0;

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
          const { ...safeStored } = stored as any;
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
    if (this.activeHomeId === homeId) return;
    this.activeHomeId = homeId;
    this.syncGeneration++;
    await secureStorage.setItem(ACTIVE_HOME_KEY, homeId).catch(() => {});
    // Reset snapshot để force notify ngay khi switch home
    this.lastDeviceSnapshot = "";
    this.lastAlertSnapshot = "";
    // Restart sync với homeId mới ngay lập tức
    if (!this.config.isDemoMode && this.config.databaseURL) {
      this.initRealtimeSync();
    }
  }

  /** Gọi khi logout — xóa activeHomeId khỏi storage và dừng sync */
  public async clearActiveHome(): Promise<void> {
    this.activeHomeId = "home_main";
    this.syncGeneration++;
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
   */
  public async getAuthParamAsync(): Promise<string> {
    const token = await authService.getValidIdToken();
    return token ? `?auth=${encodeURIComponent(token)}` : "";
  }

  // ─── Path helpers ────────────────────────────────────────────────────────

  /** Đường dẫn gốc của home */
  private homePath(homeId?: string): string {
    return `/homes/${homeId || this.activeHomeId}`;
  }

  private devicePath(deviceId: string, homeId?: string): string {
    return `${this.homePath(homeId)}/devices/${deviceId}`;
  }

  private roomPath(roomId: string, homeId?: string): string {
    return `${this.homePath(homeId)}/rooms/${roomId}`;
  }

  private memberPath(uid: string, homeId?: string): string {
    return `${this.homePath(homeId)}/members/${uid}`;
  }

  private commandPath(commandId: string, homeId?: string): string {
    return `${this.homePath(homeId)}/commands/${commandId}`;
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

  public subscribe(callback: (devices: Device[]) => void, homeId?: string) {
    const targetHome = homeId || this.activeHomeId;
    const subscriber = { callback, homeId: targetHome };
    this.listeners.push(subscriber);
    return () => {
      this.listeners = this.listeners.filter((s) => s !== subscriber);
    };
  }

  public subscribeAlerts(callback: (alerts: AlertNotification[]) => void, homeId?: string) {
    const targetHome = homeId || this.activeHomeId;
    const subscriber = { callback, homeId: targetHome };
    this.alertListeners.push(subscriber);
    return () => {
      this.alertListeners = this.alertListeners.filter((s) => s !== subscriber);
    };
  }

  private notifyListeners(devices: Device[], homeId: string) {
    this.listeners.forEach((s) => {
      if (s.homeId === homeId) {
        s.callback(devices);
      }
    });
  }

  private notifyAlertListeners(alerts: AlertNotification[], homeId: string) {
    this.alertListeners.forEach((s) => {
      if (s.homeId === homeId) {
        s.callback(alerts);
      }
    });
  }

  // ─── Devices ─────────────────────────────────────────────────────────────

  public async syncDeviceState(
    device: Partial<Device> & { id: string },
    homeId?: string
  ): Promise<boolean> {
    if (this.config.isDemoMode || !this.config.databaseURL) return true;
    try {
      const { id, ...patch } = device;
      const response = await this.requestWithAuth(
        `${this.devicePath(id, homeId)}/desired`,
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
   * Tạo command record và ghi desired — protocol lệnh/ack chính thức với sequence và idempotencyKey.
   * Trả về commandId nếu thành công, null nếu lỗi.
   */
  public async sendCommand(
    deviceId: string,
    command: DeviceCommand,
    requestedBy: string,
    homeId?: string
  ): Promise<string | null> {
    const targetHome = homeId || this.activeHomeId;
    if (this.config.isDemoMode || !this.config.databaseURL) {
      // Demo mode: giả lập thành công
      return generateCommandId();
    }

    const commandId = generateCommandId();
    const now = Date.now();
    const patch = commandToDesiredPatch(command);

    const sequence = (this.deviceSequences[deviceId] || 0) + 1;
    this.deviceSequences[deviceId] = sequence;
    const idempotencyKey = `${deviceId}_${sequence}_${now}`;

    const commandRecord: CommandRecord = {
      id: commandId,
      homeId: targetHome,
      deviceId,
      type: command.type,
      payload: patch,
      requestedBy,
      requestedAt: now,
      status: "pending",
      expiresAt: now + 15_000,
      sequence,
      idempotencyKey,
    };

    try {
      // 1. Ghi command record
      const cmdRes = await this.requestWithAuth(this.commandPath(commandId, targetHome), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(commandRecord),
      });
      if (!cmdRes.ok) return null;

      // 2. Ghi desired state kèm commandId & sequence
      const desiredRes = await this.requestWithAuth(
        `${this.devicePath(deviceId, targetHome)}/desired`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...patch,
            commandId,
            sequence,
            idempotencyKey,
          }),
        }
      );
      if (!desiredRes.ok) return null;

      // 3. Tự động ghi log audit cho hành động điều khiển
      this.logEvent({
        type: "command",
        title: `Điều khiển thiết bị (${command.type})`,
        description: `Lệnh ${command.type} được gửi bởi ${requestedBy}`,
        actor: requestedBy,
      }, targetHome).catch(() => {});

      return commandId;
    } catch {
      return null;
    }
  }

  /** Cập nhật status của command (timeout/applied/failed) */
  public async updateCommandStatus(
    commandId: string,
    status: "timeout" | "failed",
    homeId?: string
  ): Promise<void> {
    if (this.config.isDemoMode || !this.config.databaseURL) return;
    try {
      await this.requestWithAuth(this.commandPath(commandId, homeId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    } catch {
      // Offline — ignore
    }
  }

  /**
   * Gửi hàng loạt lệnh cho nhiều thiết bị trong kịch bản (Scene) hoặc Tắt/Bật toàn bộ
   * Tránh burst HTTP flood bằng cách gom nhóm và track kết quả.
   */
  public async sendBatchCommands(
    items: BatchCommandItem[],
    requestedBy: string,
    homeId?: string
  ): Promise<{ successCount: number; failedCount: number; commandIds: string[] }> {
    const targetHome = homeId || this.activeHomeId;
    const results = {
      successCount: 0,
      failedCount: 0,
      commandIds: [] as string[],
    };

    if (this.config.isDemoMode || !this.config.databaseURL) {
      results.successCount = items.length;
      results.commandIds = items.map(() => generateCommandId());
      return results;
    }

    const promises = items.map(async (item) => {
      const cmdId = await this.sendCommand(
        item.deviceId,
        item.command,
        requestedBy,
        targetHome
      );
      if (cmdId) {
        results.successCount++;
        results.commandIds.push(cmdId);
      } else {
        results.failedCount++;
      }
    });

    await Promise.allSettled(promises);
    return results;
  }

  public async saveDevice(device: Device, homeId?: string): Promise<boolean> {
    if (this.config.isDemoMode || !this.config.databaseURL) return true;
    try {
      const response = await this.requestWithAuth(this.devicePath(device.id, homeId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(device),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  public async removeDevice(deviceId: string, homeId?: string): Promise<boolean> {
    if (this.config.isDemoMode || !this.config.databaseURL) return true;
    try {
      const response = await this.requestWithAuth(this.devicePath(deviceId, homeId), {
        method: "DELETE",
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  public async clearAllDevices(homeId?: string): Promise<boolean> {
    if (this.config.isDemoMode || !this.config.databaseURL) return true;
    try {
      const response = await this.requestWithAuth(
        `${this.homePath(homeId)}/devices`,
        { method: "DELETE" }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Lấy danh sách thiết bị kèm trạng thái request theo homeId cụ thể.
   */
  public async fetchDevicesDetailed(homeId?: string): Promise<{
    ok: boolean;
    data: Record<string, Device> | null;
  }> {
    if (this.config.isDemoMode || !this.config.databaseURL) {
      return { ok: false, data: null };
    }
    try {
      const response = await this.requestWithAuth(
        `${this.homePath(homeId)}/devices`,
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

  public async fetchDevices(homeId?: string): Promise<Record<string, Device> | null> {
    const result = await this.fetchDevicesDetailed(homeId);
    return result.ok ? result.data : null;
  }

  // ─── Rooms ───────────────────────────────────────────────────────────────

  public async fetchRooms(homeId?: string): Promise<Record<string, any> | null> {
    if (this.config.isDemoMode || !this.config.databaseURL) return null;
    try {
      const response = await this.requestWithAuth(
        `${this.homePath(homeId)}/rooms`,
        { method: "GET" }
      );
      if (response.ok) return await response.json();
      return null;
    } catch {
      return null;
    }
  }

  public async saveRoom(room: any, homeId?: string): Promise<boolean> {
    if (this.config.isDemoMode || !this.config.databaseURL) return true;
    try {
      const response = await this.requestWithAuth(this.roomPath(room.id, homeId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(room),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  public async removeRoom(roomId: string, homeId?: string): Promise<boolean> {
    if (this.config.isDemoMode || !this.config.databaseURL) return true;
    try {
      const response = await this.requestWithAuth(this.roomPath(roomId, homeId), {
        method: "DELETE",
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // ─── Members & RBAC (Cloud Functions & Scoped Profile) ───────────────────

  /**
   * Gọi Firebase HTTPS Callable Function (hoặc REST fallback)
   */
  public async callFunction<T = any>(
    functionName: string,
    data: Record<string, any>
  ): Promise<T | null> {
    if (this.config.isDemoMode) {
      return null;
    }
    try {
      const token = await authService.getValidIdToken();
      const projectId = this.config.projectId || (appConfig as any).firebaseProjectId || 'esp32-smarthome';
      const region = 'us-central1';
      const url = `https://${region}-${projectId}.cloudfunctions.net/${functionName}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ data }),
      });

      if (response.ok) {
        const resJson = await response.json();
        return (resJson?.result ?? resJson) as T;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Mời thành viên mới qua backend Cloud Function
   */
  public async inviteMember(
    homeId: string,
    email: string,
    role: 'owner' | 'member' | 'guest' = 'member',
    memberName?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (this.config.isDemoMode) {
      return { success: true };
    }
    const res = await this.callFunction('inviteMember', { homeId, email, role, memberName });
    if (res && res.success) return { success: true };
    return { success: false, error: res?.error || 'Không thể mời thành viên qua Cloud Function.' };
  }

  /**
   * Thay đổi quyền thành viên qua backend Cloud Function (chỉ owner được gọi)
   */
  public async changeMemberRole(
    homeId: string,
    targetUid: string,
    newRole: 'owner' | 'member' | 'guest'
  ): Promise<{ success: boolean; error?: string }> {
    if (this.config.isDemoMode) {
      return { success: true };
    }
    const res = await this.callFunction('changeMemberRole', { homeId, targetUid, newRole });
    if (res && res.success) return { success: true };
    return { success: false, error: res?.error || 'Không thể cập nhật vai trò qua Cloud Function.' };
  }

  public async fetchMembers(homeId?: string): Promise<Record<string, any> | null> {
    if (this.config.isDemoMode || !this.config.databaseURL) return null;
    try {
      const response = await this.requestWithAuth(
        `${this.homePath(homeId)}/members`,
        { method: "GET" }
      );
      if (response.ok) return await response.json();
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Cập nhật thông tin profile của thành viên (chỉ các trường an toàn: tên, avatar, lastLoginAt)
   */
  public async updateMemberProfile(
    profile: {
      id: string;
      name?: string;
      photoUrl?: string;
      lastLoginAt?: string;
    },
    homeId?: string
  ): Promise<boolean> {
    if (this.config.isDemoMode || !this.config.databaseURL) return true;
    try {
      const { id, ...patch } = profile;
      const response = await this.requestWithAuth(
        this.memberPath(id, homeId),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  public async saveMember(
    member: {
      id: string;
      name: string;
      email: string;
      role: string;
      roomsCount?: number;
      createdAt?: string;
      isActivated?: boolean;
      lastLoginAt?: string;
    },
    homeId?: string
  ): Promise<boolean> {
    if (this.config.isDemoMode || !this.config.databaseURL) return true;
    try {
      const response = await this.requestWithAuth(
        this.memberPath(member.id, homeId),
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

  public async removeMember(memberId: string, homeId?: string): Promise<boolean> {
    if (this.config.isDemoMode || !this.config.databaseURL) return true;
    try {
      const response = await this.requestWithAuth(this.memberPath(memberId, homeId), {
        method: "DELETE",
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // ─── Homes Discovery & Meta ──────────────────────────────────────────────

  /**
   * Lấy danh mục các nhà mà user tham gia: /users/{uid}/homes
   * Đây là API chuẩn để discovery nhà theo RBAC (thay vì query toàn cục /homes).
   */
  public async fetchUserHomes(uid: string): Promise<UserHomeIndex[] | null> {
    if (this.config.isDemoMode || !this.config.databaseURL) return null;
    try {
      const response = await this.requestWithAuth(`/users/${uid}/homes`, { method: "GET" });
      if (response.ok) {
        const data = await response.json();
        if (!data) return [];
        return Object.entries(data).map(([id, val]: [string, any]) => ({
          id,
          name: val?.name || id,
          role: val?.role || "member",
          address: val?.address,
          icon: val?.icon,
          joinedAt: val?.joinedAt,
        }));
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Lấy metadata của ngôi nhà cụ thể: /homes/{homeId}/meta
   */
  public async fetchHomeMeta(homeId?: string): Promise<HomeMeta | null> {
    if (this.config.isDemoMode || !this.config.databaseURL) return null;
    try {
      const response = await this.requestWithAuth(`${this.homePath(homeId)}/meta`, {
        method: "GET",
      });
      if (response.ok) return await response.json();
      return null;
    } catch {
      return null;
    }
  }

  /** Fallback đọc /homes nếu đang ở môi trường test/legacy */
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

  /**
   * Tạo / Cập nhật home:
   * 1. Ghi /homes/{homeId}/meta
   * 2. Ghi /users/{ownerUid}/homes/{homeId} (User Home Index)
   * 3. Ghi /homes/{homeId}/members/{ownerUid} (Role Owner)
   */
  public async saveHome(
    home: {
      id: string;
      name: string;
      address?: string;
      icon?: string;
      ownerUid?: string;
      createdAt?: string;
    },
    userUid?: string
  ): Promise<boolean> {
    if (this.config.isDemoMode || !this.config.databaseURL) return true;
    try {
      // 1. Lưu meta của home
      const response = await this.requestWithAuth(`/homes/${home.id}/meta`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(home),
      });
      if (!response.ok) return false;

      const uid = userUid || home.ownerUid;
      if (uid) {
        // 2. Ghi vào index nhà của user
        await this.requestWithAuth(`/users/${uid}/homes/${home.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: home.id,
            name: home.name,
            role: "owner",
            address: home.address || "",
            icon: home.icon || "home",
            joinedAt: home.createdAt || new Date().toISOString(),
          }),
        }).catch(() => {});

        // 3. Ghi quyền owner vào members của home
        await this.requestWithAuth(`/homes/${home.id}/members/${uid}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: uid,
            role: "owner",
            createdAt: home.createdAt || new Date().toISOString(),
          }),
        }).catch(() => {});
      }

      return true;
    } catch {
      return false;
    }
  }

  public async removeHome(homeId: string, userUid?: string): Promise<boolean> {
    if (this.config.isDemoMode || !this.config.databaseURL) return true;
    try {
      const response = await this.requestWithAuth(`/homes/${homeId}`, {
        method: "DELETE",
      });
      if (userUid) {
        await this.requestWithAuth(`/users/${userUid}/homes/${homeId}`, {
          method: "DELETE",
        }).catch(() => {});
      }
      return response.ok;
    } catch {
      return false;
    }
  }

  // ─── Alerts ──────────────────────────────────────────────────────────────

  public async logAlert(alert: AlertNotification, homeId?: string): Promise<void> {
    if (this.config.isDemoMode || !this.config.databaseURL) return;
    try {
      await this.requestWithAuth(`${this.homePath(homeId)}/alerts/${alert.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(alert),
      });
    } catch {
      // offline silent
    }
  }

  private async fetchAlertsDetailed(homeId?: string): Promise<{
    ok: boolean;
    data: Record<string, AlertNotification> | null;
  }> {
    if (this.config.isDemoMode || !this.config.databaseURL) {
      return { ok: false, data: null };
    }
    try {
      const response = await this.requestWithAuth(
        `${this.homePath(homeId)}/alerts`,
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

  public async fetchAlerts(homeId?: string): Promise<AlertNotification[] | null> {
    const result = await this.fetchAlertsDetailed(homeId);
    if (!result.ok) return null;
    return this.normalizeAlerts(result.data);
  }

  public async markAlertRead(alertId: string, homeId?: string): Promise<boolean> {
    if (this.config.isDemoMode || !this.config.databaseURL) return true;
    try {
      const response = await this.requestWithAuth(
        `${this.homePath(homeId)}/alerts/${alertId}`,
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

  public async fetchScenes(homeId?: string): Promise<Record<string, any> | null> {
    if (this.config.isDemoMode || !this.config.databaseURL) return null;
    try {
      const response = await this.requestWithAuth(
        `${this.homePath(homeId)}/scenes`,
        { method: "GET" }
      );
      if (response.ok) return await response.json();
      return null;
    } catch {
      return null;
    }
  }

  public async saveScene(scene: any, homeId?: string): Promise<boolean> {
    if (this.config.isDemoMode || !this.config.databaseURL) return true;
    try {
      const response = await this.requestWithAuth(
        `${this.homePath(homeId)}/scenes/${scene.id}`,
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

  public async removeScene(sceneId: string, homeId?: string): Promise<boolean> {
    if (this.config.isDemoMode || !this.config.databaseURL) return true;
    try {
      const response = await this.requestWithAuth(
        `${this.homePath(homeId)}/scenes/${sceneId}`,
        { method: "DELETE" }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  // ─── Automations ─────────────────────────────────────────────────────────

  public async fetchAutomations(homeId?: string): Promise<Record<string, any> | null> {
    if (this.config.isDemoMode || !this.config.databaseURL) return null;
    try {
      const response = await this.requestWithAuth(
        `${this.homePath(homeId)}/automations`,
        { method: "GET" }
      );
      if (response.ok) return await response.json();
      return null;
    } catch {
      return null;
    }
  }

  public async saveAutomation(automation: any, homeId?: string): Promise<boolean> {
    if (this.config.isDemoMode || !this.config.databaseURL) return true;
    try {
      const response = await this.requestWithAuth(
        `${this.homePath(homeId)}/automations/${automation.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(automation),
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  public async removeAutomation(automationId: string, homeId?: string): Promise<boolean> {
    if (this.config.isDemoMode || !this.config.databaseURL) return true;
    try {
      const response = await this.requestWithAuth(
        `${this.homePath(homeId)}/automations/${automationId}`,
        { method: "DELETE" }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  // ─── Audit & Activity Logs ───────────────────────────────────────────────

  public async logEvent(
    event: {
      id?: string;
      type: string;
      title: string;
      description: string;
      actor?: string;
      timestamp?: string;
      metadata?: Record<string, unknown>;
    },
    homeId?: string
  ): Promise<void> {
    if (this.config.isDemoMode || !this.config.databaseURL) return;
    try {
      const id = event.id || `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const logEntry = {
        ...event,
        id,
        timestamp: event.timestamp || new Date().toISOString(),
      };
      await this.requestWithAuth(`${this.homePath(homeId)}/logs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(logEntry),
      });
    } catch {
      // Non-blocking
    }
  }

  public async fetchLogs(limit = 50, homeId?: string): Promise<any[] | null> {
    if (this.config.isDemoMode || !this.config.databaseURL) return null;
    try {
      const response = await this.requestWithAuth(
        `${this.homePath(homeId)}/logs?orderBy="$key"&limitToLast=${limit}`,
        { method: "GET" }
      );
      if (response.ok) {
        const data = await response.json();
        if (!data) return [];
        return Object.values(data).reverse();
      }
      return null;
    } catch {
      return null;
    }
  }

  // ─── Overview ────────────────────────────────────────────────────

  public async updateOverviewField(
    field: string,
    value: unknown,
    homeId?: string
  ): Promise<void> {
    if (this.config.isDemoMode || !this.config.databaseURL) return;
    try {
      await this.requestWithAuth(`${this.homePath(homeId)}/meta`, {
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

    // Poll thiết bị mỗi 3 giây theo activeHomeId
    this.pollInterval = setInterval(async () => {
      const currentGen = this.syncGeneration;
      const targetHome = this.activeHomeId;
      const result = await this.fetchDevicesDetailed(targetHome);

      // Nếu đã chuyển home hoặc sync generation thay đổi trong lúc chờ fetch, bỏ qua response này
      if (currentGen !== this.syncGeneration || targetHome !== this.activeHomeId) {
        return;
      }

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

      const devicesList = this.normalizeDevices(result.data);
      devicesList.sort((a, b) => a.id.localeCompare(b.id));
      const snapshot = JSON.stringify(devicesList);
      if (snapshot === this.lastDeviceSnapshot) return;
      this.lastDeviceSnapshot = snapshot;
      this.notifyListeners(devicesList, targetHome);
    }, 3000);

    // Poll cảnh báo mỗi 5 giây theo activeHomeId
    this.alertPollInterval = setInterval(async () => {
      const currentGen = this.syncGeneration;
      const targetHome = this.activeHomeId;
      const result = await this.fetchAlertsDetailed(targetHome);

      if (currentGen !== this.syncGeneration || targetHome !== this.activeHomeId) {
        return;
      }

      if (!result.ok) return;
      const alerts = this.normalizeAlerts(result.data);
      const snapshot = JSON.stringify(alerts);
      if (snapshot === this.lastAlertSnapshot) return;
      this.lastAlertSnapshot = snapshot;
      this.notifyAlertListeners(alerts, targetHome);
    }, 5000);
  }

  /**
   * Chuẩn hóa thiết bị: gộp `reported` state vào flat fields và
   * tính toán `isOnline` thực dựa trên heartbeat `lastSeenAt` (<75s).
   */
  public normalizeDevices(
    data: Record<string, any> | null
  ): Device[] {
    if (!data) return [];
    const now = Date.now();
    const HEARTBEAT_TIMEOUT_MS = 75_000; // ESP32 heartbeat mỗi 30s -> ngưỡng 75s

    return Object.entries(data).map(([key, raw]) => {
      const dev = raw || {};
      const reported = dev.reported || {};
      const desired = dev.desired || {};

      // Xác định isOnline từ lastSeenAt
      let isLive = Boolean(dev.isOnline);
      if (reported.lastSeenAt) {
        const lastSeenMs =
          typeof reported.lastSeenAt === "number"
            ? reported.lastSeenAt
            : new Date(reported.lastSeenAt).getTime();
        isLive = !isNaN(lastSeenMs) && now - lastSeenMs < HEARTBEAT_TIMEOUT_MS;
      } else if (dev.lastUpdated) {
        const updatedMs = new Date(dev.lastUpdated).getTime();
        if (!isNaN(updatedMs) && now - updatedMs < HEARTBEAT_TIMEOUT_MS) {
          isLive = true;
        }
      }

      if (this.config.isDemoMode) {
        isLive = true;
      }

      return {
        id: dev.id || key,
        name: dev.name || "Thiết bị",
        type: dev.type || "switch",
        roomId: dev.roomId || "room_living",
        roomName: dev.roomName || "Phòng khách",
        isFavorite: Boolean(dev.isFavorite),
        lastUpdated: dev.lastUpdated || new Date().toISOString(),

        // Ưu tiên trạng thái thực tế từ reported của phần cứng
        isOnline: isLive,
        isOn: reported.isOn !== undefined ? Boolean(reported.isOn) : Boolean(dev.isOn),
        brightness: reported.brightness !== undefined ? reported.brightness : dev.brightness,
        color: reported.color || dev.color,
        rgbMode: reported.rgbMode || dev.rgbMode,
        temperature: reported.temperature !== undefined ? reported.temperature : dev.temperature,
        currentTemperature: reported.currentTemperature !== undefined ? reported.currentTemperature : dev.currentTemperature,
        humidity: reported.humidity !== undefined ? reported.humidity : dev.humidity,
        airQuality: reported.airQuality || dev.airQuality,
        acMode: reported.acMode || dev.acMode,
        fanSpeed: reported.fanSpeed || dev.fanSpeed,
        powerUsageWatts: reported.powerUsageWatts !== undefined ? reported.powerUsageWatts : dev.powerUsageWatts,

        desired,
        reported,
      };
    });
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
