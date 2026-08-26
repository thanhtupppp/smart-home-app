import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Device,
  Room,
  Scene,
  Automation,
  AlertNotification,
  HomeOverview,
  FirebaseConfig,
  HomeConnectionStatus,
  DeviceCommand,
  PendingCommandRecord,
} from '../types';
import { initialDevices, initialRooms, initialScenes, initialAutomations, initialAlerts, initialHomeOverview } from '../services/mockData';
import { firebaseService } from '../services/firebaseService';
import { safeStorage, getScopedCacheKey } from '../services/storageService';
import { authService } from '../services/authService';
import { commandQueueService } from '../services/commandQueueService';
import { notificationService } from '../services/notificationService';

/** Timeout (ms) trước khi rollback optimistic state nếu thiết bị không ack */
const COMMAND_TIMEOUT_MS = 15_000;

interface HomeContextType {
  overview: HomeOverview;
  devices: Device[];
  rooms: Room[];
  scenes: Scene[];
  automations: Automation[];
  alerts: AlertNotification[];
  firebaseConfig: FirebaseConfig;
  unreadAlertCount: number;
  connectionStatus: HomeConnectionStatus;
  activeHomeId: string;
  /** deviceId → commandId đang chờ ack */
  commandPending: Record<string, string>;
  updateHomeName: (name: string) => Promise<void>;
  toggleDevice: (id: string) => void;
  updateDevice: (id: string, updates: Partial<Device>) => void;
  turnAllDevices: (isOn: boolean, roomId?: string) => void;
  activateScene: (id: string) => void;
  addScene: (scene: Scene) => Promise<void>;
  updateScene: (sceneId: string, updates: Partial<Scene>) => Promise<void>;
  removeScene: (sceneId: string) => Promise<void>;
  toggleAutomation: (id: string) => void;
  addAutomation: (automation: Automation) => Promise<void>;
  updateAutomation: (automationId: string, updates: Partial<Automation>) => Promise<void>;
  removeAutomation: (automationId: string) => Promise<void>;
  addDevice: (device: Device) => Promise<void>;
  removeDevice: (deviceId: string) => Promise<boolean>;
  clearAllDevices: () => Promise<boolean>;
  addRoom: (room: Room) => Promise<void>;
  updateRoom: (roomId: string, updates: Partial<Room>) => Promise<void>;
  removeRoom: (roomId: string) => Promise<void>;
  updateFirebaseConfig: (config: FirebaseConfig) => void;
  markAlertAsRead: (id: string) => Promise<void>;
  markAllAlertsAsRead: () => Promise<void>;
  setActiveHomeId: (homeId: string) => Promise<void>;
  flushOfflineQueue: () => Promise<void>;
}

const HomeContext = createContext<HomeContextType | undefined>(undefined);

export const HomeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [overview, setOverview] = useState<HomeOverview>({
    homeName: 'Tú SmartHome',
    totalDevices: 0,
    onlineDevices: 0,
    activeDevices: 0,
    avgTemperature: 26,
    avgHumidity: 60,
    powerConsumptionWatts: 0,
    securityStatus: 'armed',
  });
  const [devices, setDevices] = useState<Device[]>([]);
  const [rooms, setRooms] = useState<Room[]>(initialRooms);
  const [scenes, setScenes] = useState<Scene[]>(initialScenes);
  const [automations, setAutomations] = useState<Automation[]>(initialAutomations);
  const [alerts, setAlerts] = useState<AlertNotification[]>(initialAlerts);
  const [firebaseConfig, setFirebaseConfig] = useState<FirebaseConfig>(() => firebaseService.getConfig());
  const [isConfigReady, setIsConfigReady] = useState<boolean>(() => firebaseService.isConfigLoaded());
  const [connectionStatus, setConnectionStatus] = useState<HomeConnectionStatus>('offline');
  const [activeHomeId, setActiveHomeIdState] = useState<string>(() => firebaseService.getActiveHomeId());
  /** deviceId → commandId đang chờ ack từ thiết bị */
  const [commandPending, setCommandPending] = useState<Record<string, string>>({});
  const commandPendingRef = useRef<Record<string, string>>({});
  useEffect(() => {
    commandPendingRef.current = commandPending;
  }, [commandPending]);

  /** Ref lưu thiết bị mới nhất để đọc đồng bộ */
  const devicesRef = useRef<Device[]>([]);
  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

  /** Ref lưu snapshot trạng thái thiết bị TRƯỚC KHI thực hiện từng lệnh để rollback chính xác khi timeout */
  const pendingCommandsRef = useRef<Record<string, PendingCommandRecord>>({});
  /** Ref theo dõi alerts đã thông báo để không spam push */
  const notifiedAlertIdsRef = useRef<Set<string>>(new Set());

  // Load persisted Firebase config before any sync
  useEffect(() => {
    let isMounted = true;
    if (firebaseService.isConfigLoaded()) return;
    firebaseService.loadPersistedConfig().then((cfg) => {
      if (isMounted) {
        setFirebaseConfig(cfg);
        setIsConfigReady(true);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Subscribe connection status từ firebaseService & tự động flush offline queue khi online
  useEffect(() => {
    const unsub = firebaseService.subscribeConnectionStatus((status) => {
      setConnectionStatus(status);
      if (status === 'connected') {
        commandQueueService.flush();
      }
    });
    return unsub;
  }, []);

  // Register push notifications and save push token if logged in
  useEffect(() => {
    const user = authService.getCurrentUser();
    if (user && !user.isDemo) {
      notificationService.registerForPushNotifications().then((token) => {
        if (token) {
          firebaseService.saveMember({
            id: user.uid,
            name: user.displayName,
            email: user.email,
            role: user.role,
            lastLoginAt: new Date().toISOString(),
          }, activeHomeId).catch(() => {});
        }
      });
    }
  }, [activeHomeId]);

  // Load cached devices and listen to remote Firebase changes (scoped theo activeHomeId)
  // react-doctor-disable-next-line react-doctor/advanced-event-handler-refs
  // react-doctor-disable-next-line react-doctor/no-set-state-after-await-in-effect
  useEffect(() => {
    if (!isConfigReady) return;
    let isMounted = true;
    const user = authService.getCurrentUser();
    const devStorageKey = getScopedCacheKey('devices', user?.uid, activeHomeId);

    const initDevices = async () => {
      try {
        const cached = await safeStorage.getItem(devStorageKey);
        if (!isMounted) return;
        if (cached) {
          const parsed: Device[] = JSON.parse(cached);
          if (Array.isArray(parsed) && isMounted) {
            setDevices(parsed);
          }
        }
      } catch {
        // Ignore
      }

      try {
        const result = await firebaseService.fetchDevicesDetailed(activeHomeId);
        if (!isMounted) return;
        if (result.ok) {
          const list: Device[] = firebaseService.normalizeDevices(result.data);
          if (!isMounted) return;
          setDevices(list);
          await safeStorage.setItem(devStorageKey, JSON.stringify(list));
        }
      } catch {
        // Ignore
      }
    };

    initDevices();

    const unsubscribe = firebaseService.subscribe((remoteDevices) => {
      if (isMounted) {
        setDevices(remoteDevices);
        safeStorage.setItem(devStorageKey, JSON.stringify(remoteDevices)).catch(() => {});

        // Kiểm tra ACK: nếu thiết bị báo lastAppliedCommandId thì clear timeout và xóa pending snapshot tương ứng
        for (const dev of remoteDevices) {
          const appliedCmdId = dev.reported?.lastAppliedCommandId;
          if (appliedCmdId && pendingCommandsRef.current[appliedCmdId]) {
            const pendingRec = pendingCommandsRef.current[appliedCmdId];
            if (pendingRec.timeoutHandle) {
              clearTimeout(pendingRec.timeoutHandle);
            }
            delete pendingCommandsRef.current[appliedCmdId];
          }
        }

        // Pure updater function without side effects
        setCommandPending((prev) => {
          const updates: Record<string, string> = { ...prev };
          let changed = false;
          for (const dev of remoteDevices) {
            const pendingCmdId = prev[dev.id];
            if (pendingCmdId && dev.reported?.lastAppliedCommandId === pendingCmdId) {
              delete updates[dev.id];
              changed = true;
            }
          }
          return changed ? updates : prev;
        });
      }
    }, activeHomeId);

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isConfigReady, activeHomeId]);

  // Update room active counts and overview whenever devices change
  useEffect(() => {
    const activeCount = devices.filter((d) => d.isOn).length;
    const onlineCount = devices.filter((d) => d.isOnline).length;
    const powerWatts = devices.reduce(
      (sum, d) => sum + (d.isOn ? d.powerUsageWatts || 0 : 0),
      0
    );

    setOverview((prev) => ({
      ...prev,
      totalDevices: devices.length,
      onlineDevices: onlineCount,
      activeDevices: activeCount,
      powerConsumptionWatts: powerWatts,
    }));

    setRooms((prevRooms) =>
      prevRooms.map((r) => {
        const roomDevs = devices.filter((d) => d.roomId === r.id);
        const roomActive = roomDevs.filter((d) => d.isOn).length;
        return {
          ...r,
          deviceCount: roomDevs.length,
          activeCount: roomActive,
        };
      })
    );
  }, [devices]);

  /**
   * Thực thi lệnh nguyên tử: Chụp previousState -> Optimistic update UI -> Gửi cloud/queue -> Rollback chính xác khi timeout
   */
  const executeOptimisticCommand = useCallback(
    async (
      deviceId: string,
      command: DeviceCommand,
      optimisticPatch: Partial<Device>
    ) => {
      const user = authService.getCurrentUser();
      const uid = user?.uid || 'demo';
      const currentDev = devicesRef.current.find((d) => d.id === deviceId);
      if (!currentDev) return;

      const previousState: Device = { ...currentDev };

      // 1. Cập nhật UI optimistic
      setDevices((prev) =>
        prev.map((dev) => (dev.id === deviceId ? { ...dev, ...optimisticPatch } : dev))
      );

      // 2. Nếu offline -> đưa vào offline command queue
      if (connectionStatus === 'offline') {
        await commandQueueService.enqueue(deviceId, command, uid, activeHomeId);
        return;
      }

      // 3. Gửi lệnh tới Firebase RTDB
      const commandId = await firebaseService.sendCommand(
        deviceId,
        command,
        uid,
        activeHomeId
      );

      if (!commandId) {
        // Gửi thất bại -> fallback đưa vào queue offline
        await commandQueueService.enqueue(deviceId, command, uid, activeHomeId);
        return;
      }

      // 4. Log event
      firebaseService.logEvent(
        {
          type: 'device_command',
          title: `Lệnh ${command.type}`,
          description: `Người dùng ${user?.displayName || 'User'} gửi lệnh ${command.type} tới ${deviceId}`,
          actor: user?.displayName || 'App',
        },
        activeHomeId
      ).catch(() => {});

      // 5. Đánh dấu pending trên UI
      setCommandPending((prev) => ({ ...prev, [deviceId]: commandId }));

      // 6. Đặt timeout rollback sau 15s nếu thiết bị không ACK
      const timeoutHandle = setTimeout(async () => {
        const pending = pendingCommandsRef.current[commandId];
        if (pending) {
          delete pendingCommandsRef.current[commandId];

          // Rollback chính xác về previousState đã chụp trước lệnh này
          setDevices((prevDevs) =>
            prevDevs.map((d) => (d.id === deviceId ? pending.previousState : d))
          );

          setCommandPending((prev) => {
            if (prev[deviceId] !== commandId) return prev;
            const updated = { ...prev };
            delete updated[deviceId];
            return updated;
          });

          await firebaseService.updateCommandStatus(commandId, 'timeout', activeHomeId);
        }
      }, COMMAND_TIMEOUT_MS);

      pendingCommandsRef.current[commandId] = {
        commandId,
        deviceId,
        previousState,
        expiresAt: Date.now() + COMMAND_TIMEOUT_MS,
        timeoutHandle,
      };
    },
    [connectionStatus, activeHomeId]
  );

  const toggleDevice = useCallback(
    (id: string) => {
      const currentDev = devicesRef.current.find((d) => d.id === id);
      if (!currentDev) return;
      const nextState = !currentDev.isOn;
      executeOptimisticCommand(id, { type: 'power', value: nextState }, { isOn: nextState });
    },
    [executeOptimisticCommand]
  );

  const updateDevice = useCallback(
    (id: string, updates: Partial<Device>) => {
      if (updates.isOn !== undefined) {
        executeOptimisticCommand(id, { type: 'power', value: updates.isOn }, updates);
      } else if (updates.brightness !== undefined) {
        setDevices((prev) =>
          prev.map((dev) => (dev.id === id ? { ...dev, ...updates } : dev))
        );
        commandQueueService.debounce(`brightness_${id}`, () => {
          executeOptimisticCommand(
            id,
            { type: 'brightness', value: updates.brightness! },
            updates
          );
        }, 250);
      } else if (updates.temperature !== undefined) {
        setDevices((prev) =>
          prev.map((dev) => (dev.id === id ? { ...dev, ...updates } : dev))
        );
        commandQueueService.debounce(`temp_${id}`, () => {
          executeOptimisticCommand(
            id,
            { type: 'temperature', value: updates.temperature! },
            updates
          );
        }, 300);
      } else if (updates.color !== undefined) {
        setDevices((prev) =>
          prev.map((dev) => (dev.id === id ? { ...dev, ...updates } : dev))
        );
        commandQueueService.debounce(`color_${id}`, () => {
          executeOptimisticCommand(
            id,
            {
              type: 'rgb',
              color: updates.color!,
              brightness: updates.brightness,
              mode: updates.rgbMode,
            },
            updates
          );
        }, 300);
      } else if (updates.acMode !== undefined) {
        executeOptimisticCommand(id, { type: 'acMode', value: updates.acMode }, updates);
      } else if (updates.fanSpeed !== undefined) {
        executeOptimisticCommand(id, { type: 'fanSpeed', value: updates.fanSpeed }, updates);
      } else {
        setDevices((prev) =>
          prev.map((dev) => (dev.id === id ? { ...dev, ...updates } : dev))
        );
        firebaseService.syncDeviceState({ id, ...updates }, activeHomeId);
      }
    },
    [executeOptimisticCommand, activeHomeId]
  );

  const turnAllDevices = useCallback(
    async (isOn: boolean, roomId?: string) => {
      const targetDevices = devicesRef.current.filter(
        (d) => !roomId || d.roomId === roomId
      );
      if (targetDevices.length === 0) return;

      // Optimistic update all targets
      setDevices((prev) =>
        prev.map((dev) => {
          if (!roomId || dev.roomId === roomId) {
            return { ...dev, isOn };
          }
          return dev;
        })
      );

      const user = authService.getCurrentUser();
      const uid = user?.uid || 'demo';

      const batchItems = targetDevices.map((dev) => ({
        deviceId: dev.id,
        command: { type: 'power' as const, value: isOn },
      }));

      await firebaseService.sendBatchCommands(batchItems, uid, activeHomeId);
    },
    [activeHomeId]
  );

  const activateScene = useCallback(
    async (sceneId: string) => {
      setScenes((prev) =>
        prev.map((s) => ({ ...s, isActive: s.id === sceneId }))
      );

      setTimeout(() => {
        setScenes((prev) =>
          prev.map((s) => (s.id === sceneId ? { ...s, isActive: false } : s))
        );
      }, 3000);

      const scene = scenes.find((s) => s.id === sceneId);
      const user = authService.getCurrentUser();
      const uid = user?.uid || 'demo';

      firebaseService.logEvent(
        {
          type: 'scene_activated',
          title: `Kích hoạt Ngữ cảnh`,
          description: `Ngữ cảnh "${scene?.name || sceneId}" đã được kích hoạt`,
          actor: user?.displayName || 'User',
        },
        activeHomeId
      ).catch(() => {});

      if (scene?.actions && scene.actions.length > 0) {
        setDevices((prevDevs) =>
          prevDevs.map((d) => {
            const matchingAction = scene.actions?.find((a) => a.deviceId === d.id);
            if (!matchingAction) return d;
            return { ...d, ...matchingAction.patch };
          })
        );

        const batchItems: { deviceId: string; command: DeviceCommand }[] = [];
        for (const action of scene.actions) {
          const patch = action.patch;
          if (patch.isOn !== undefined) {
            batchItems.push({ deviceId: action.deviceId, command: { type: 'power', value: patch.isOn } });
          }
          if (patch.brightness !== undefined) {
            batchItems.push({ deviceId: action.deviceId, command: { type: 'brightness', value: patch.brightness } });
          }
          if (patch.temperature !== undefined) {
            batchItems.push({ deviceId: action.deviceId, command: { type: 'temperature', value: patch.temperature } });
          }
          if (patch.color !== undefined) {
            batchItems.push({
              deviceId: action.deviceId,
              command: {
                type: 'rgb',
                color: patch.color,
                brightness: patch.brightness,
                mode: patch.rgbMode,
              },
            });
          }
          if (patch.acMode !== undefined) {
            batchItems.push({ deviceId: action.deviceId, command: { type: 'acMode', value: patch.acMode } });
          }
        }
        await firebaseService.sendBatchCommands(batchItems, uid, activeHomeId);
      } else {
        if (sceneId === 'scene_arrive_home') {
          const targetDevs = devicesRef.current.filter(
            (d) =>
              d.roomId === 'room_living' &&
              (d.type === 'light' || d.type === 'ac' || d.type === 'rgb_light')
          );
          setDevices((prevDevs) =>
            prevDevs.map((d) => {
              if (
                d.roomId === 'room_living' &&
                (d.type === 'light' || d.type === 'ac' || d.type === 'rgb_light')
              ) {
                return { ...d, isOn: true };
              }
              return d;
            })
          );
          const batchItems = targetDevs.map((d) => ({
            deviceId: d.id,
            command: { type: 'power' as const, value: true },
          }));
          await firebaseService.sendBatchCommands(batchItems, uid, activeHomeId);
        } else if (sceneId === 'scene_leave_home') {
          await turnAllDevices(false);
        } else if (sceneId === 'scene_sleep') {
          const livingLights = devicesRef.current.filter(
            (d) => (d.type === 'light' || d.type === 'rgb_light') && d.roomId === 'room_living'
          );
          const masterAc = devicesRef.current.find(
            (d) => d.type === 'ac' && d.roomId === 'room_bedroom_master'
          );
          setDevices((prevDevs) =>
            prevDevs.map((d) => {
              if ((d.type === 'light' || d.type === 'rgb_light') && d.roomId === 'room_living') {
                return { ...d, isOn: false };
              }
              if (d.type === 'ac' && d.roomId === 'room_bedroom_master') {
                return { ...d, isOn: true, temperature: 26, acMode: 'cool' };
              }
              return d;
            })
          );
          const batchItems: { deviceId: string; command: DeviceCommand }[] = livingLights.map((d) => ({
            deviceId: d.id,
            command: { type: 'power' as const, value: false },
          }));
          if (masterAc) {
            batchItems.push(
              { deviceId: masterAc.id, command: { type: 'temperature', value: 26 } },
              { deviceId: masterAc.id, command: { type: 'power', value: true } }
            );
          }
          await firebaseService.sendBatchCommands(batchItems, uid, activeHomeId);
        } else if (sceneId === 'scene_movie') {
          const rgbLights = devicesRef.current.filter((d) => d.type === 'rgb_light');
          const livingNormalLights = devicesRef.current.filter(
            (d) => d.type === 'light' && d.roomId === 'room_living'
          );
          setDevices((prevDevs) =>
            prevDevs.map((d) => {
              if (d.type === 'rgb_light') {
                return { ...d, isOn: true, color: '#7c4dff', brightness: 25, rgbMode: 'breathing' };
              }
              if (d.type === 'light' && d.roomId === 'room_living') {
                return { ...d, isOn: false };
              }
              return d;
            })
          );
          const batchItems: { deviceId: string; command: DeviceCommand }[] = [
            ...rgbLights.map((d) => ({
              deviceId: d.id,
              command: {
                type: 'rgb' as const,
                color: '#7c4dff',
                brightness: 25,
                mode: 'breathing' as const,
              },
            })),
            ...rgbLights.map((d) => ({
              deviceId: d.id,
              command: { type: 'power' as const, value: true },
            })),
            ...livingNormalLights.map((d) => ({
              deviceId: d.id,
              command: { type: 'power' as const, value: false },
            })),
          ];
          await firebaseService.sendBatchCommands(batchItems, uid, activeHomeId);
        }
      }
    },
    [scenes, activeHomeId, turnAllDevices]
  );

  // ─── Scene CRUD ──────────────────────────────────────────────────────────

  const addScene = useCallback(async (newScene: Scene) => {
    const user = authService.getCurrentUser();
    const sceneStorageKey = getScopedCacheKey('scenes', user?.uid, activeHomeId);
    const updated = [...scenes.filter((s) => s.id !== newScene.id), newScene];
    setScenes(updated);
    await safeStorage.setItem(sceneStorageKey, JSON.stringify(updated));
    await firebaseService.saveScene(newScene, activeHomeId);
  }, [scenes, activeHomeId]);

  const updateScene = useCallback(async (sceneId: string, updates: Partial<Scene>) => {
    const user = authService.getCurrentUser();
    const sceneStorageKey = getScopedCacheKey('scenes', user?.uid, activeHomeId);
    const updated = scenes.map((s) => (s.id === sceneId ? { ...s, ...updates } : s));
    setScenes(updated);
    await safeStorage.setItem(sceneStorageKey, JSON.stringify(updated));
    const target = updated.find((s) => s.id === sceneId);
    if (target) await firebaseService.saveScene(target, activeHomeId);
  }, [scenes, activeHomeId]);

  const removeScene = useCallback(async (sceneId: string) => {
    const user = authService.getCurrentUser();
    const sceneStorageKey = getScopedCacheKey('scenes', user?.uid, activeHomeId);
    const updated = scenes.filter((s) => s.id !== sceneId);
    setScenes(updated);
    await safeStorage.setItem(sceneStorageKey, JSON.stringify(updated));
    await firebaseService.removeScene(sceneId, activeHomeId);
  }, [scenes, activeHomeId]);

  // ─── Automation CRUD ─────────────────────────────────────────────────────

  const toggleAutomation = useCallback(async (id: string) => {
    const target = automations.find((a) => a.id === id);
    if (!target) return;
    const user = authService.getCurrentUser();
    const autoStorageKey = getScopedCacheKey('automations', user?.uid, activeHomeId);
    const updatedItem = { ...target, isEnabled: !target.isEnabled };
    const updatedList = automations.map((a) => (a.id === id ? updatedItem : a));
    setAutomations(updatedList);
    await safeStorage.setItem(autoStorageKey, JSON.stringify(updatedList));
    await firebaseService.saveAutomation(updatedItem, activeHomeId);
  }, [automations, activeHomeId]);

  const addAutomation = useCallback(async (newAutomation: Automation) => {
    const user = authService.getCurrentUser();
    const autoStorageKey = getScopedCacheKey('automations', user?.uid, activeHomeId);
    const updated = [...automations.filter((a) => a.id !== newAutomation.id), newAutomation];
    setAutomations(updated);
    await safeStorage.setItem(autoStorageKey, JSON.stringify(updated));
    await firebaseService.saveAutomation(newAutomation, activeHomeId);
  }, [automations, activeHomeId]);

  const updateAutomation = useCallback(async (automationId: string, updates: Partial<Automation>) => {
    const user = authService.getCurrentUser();
    const autoStorageKey = getScopedCacheKey('automations', user?.uid, activeHomeId);
    const updated = automations.map((a) => (a.id === automationId ? { ...a, ...updates } : a));
    setAutomations(updated);
    await safeStorage.setItem(autoStorageKey, JSON.stringify(updated));
    const target = updated.find((a) => a.id === automationId);
    if (target) await firebaseService.saveAutomation(target, activeHomeId);
  }, [automations, activeHomeId]);

  const removeAutomation = useCallback(async (automationId: string) => {
    const user = authService.getCurrentUser();
    const autoStorageKey = getScopedCacheKey('automations', user?.uid, activeHomeId);
    const updated = automations.filter((a) => a.id !== automationId);
    setAutomations(updated);
    await safeStorage.setItem(autoStorageKey, JSON.stringify(updated));
    await firebaseService.removeAutomation(automationId, activeHomeId);
  }, [automations, activeHomeId]);

  // Sync Scenes & Automations from Firebase
  // react-doctor-disable-next-line react-doctor/no-set-state-after-await-in-effect
  useEffect(() => {
    if (!isConfigReady) return;
    let isMounted = true;
    const user = authService.getCurrentUser();
    const sceneStorageKey = getScopedCacheKey('scenes', user?.uid, activeHomeId);
    const autoStorageKey = getScopedCacheKey('automations', user?.uid, activeHomeId);

    const initScenesAndAutomations = async () => {
      try {
        const remoteScenes = await firebaseService.fetchScenes(activeHomeId);
        if (!isMounted) return;
        if (remoteScenes && Object.keys(remoteScenes).length > 0 && isMounted) {
          const list: Scene[] = Object.values(remoteScenes);
          if (!isMounted) return;
          setScenes(list);
          await safeStorage.setItem(sceneStorageKey, JSON.stringify(list));
        }

        const remoteAutomations = await firebaseService.fetchAutomations(activeHomeId);
        if (!isMounted) return;
        if (remoteAutomations && Object.keys(remoteAutomations).length > 0 && isMounted) {
          const list: Automation[] = Object.values(remoteAutomations);
          if (!isMounted) return;
          setAutomations(list);
          await safeStorage.setItem(autoStorageKey, JSON.stringify(list));
        }
      } catch {
        // Fallback
      }
    };

    initScenesAndAutomations();
    return () => {
      isMounted = false;
    };
  }, [isConfigReady, activeHomeId]);

  // Sync rooms from cache & Firebase
  useEffect(() => {
    if (!isConfigReady) return;
    let isMounted = true;
    const user = authService.getCurrentUser();
    const roomStorageKey = getScopedCacheKey('rooms', user?.uid, activeHomeId);

    const initRooms = async () => {
      const isDemo = !user || user.isDemo;
      let localRooms: Room[] = isDemo ? initialRooms : [];
      try {
        const cached = await safeStorage.getItem(roomStorageKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            localRooms = parsed;
            if (isMounted) setRooms(localRooms);
          }
        }
      } catch {
        // Ignore
      }

      try {
        const remote = await firebaseService.fetchRooms(activeHomeId);
        if (remote && Object.keys(remote).length > 0) {
          const list: Room[] = Object.values(remote);
          if (isMounted) {
            setRooms(list);
            await safeStorage.setItem(roomStorageKey, JSON.stringify(list));
          }
        } else if (isDemo && localRooms.length > 0) {
          await Promise.all(localRooms.map((r) => firebaseService.saveRoom(r, activeHomeId)));
          await safeStorage.setItem(roomStorageKey, JSON.stringify(localRooms));
        }
      } catch {
        // Ignore
      }
    };

    initRooms();
    return () => {
      isMounted = false;
    };
  }, [isConfigReady, activeHomeId]);

  // Load alerts từ Firebase & trigger Push Notification cho alert mới
  useEffect(() => {
    if (!isConfigReady) return;
    let isMounted = true;

    const initAlerts = async () => {
      if (firebaseService.getConfig().isDemoMode) return;
      const list = await firebaseService.fetchAlerts(activeHomeId);
      if (!isMounted || list === null) return;
      setAlerts(list);
      list.forEach((a) => notifiedAlertIdsRef.current.add(a.id));
    };

    initAlerts();

    const unsubscribe = firebaseService.subscribeAlerts((remoteAlerts) => {
      if (isMounted) {
        setAlerts(remoteAlerts);
        // Check for new unread alerts to trigger notification
        remoteAlerts.forEach((a) => {
          if (!a.isRead && !notifiedAlertIdsRef.current.has(a.id)) {
            notifiedAlertIdsRef.current.add(a.id);
            notificationService.sendLocalAlert({
              title: a.title || '🚨 Cảnh Báo SmartHome',
              body: a.message || 'Phát hiện sự kiện bất thường.',
              data: { alertId: a.id, type: a.type },
              sound: true,
            });
          }
        });
      }
    }, activeHomeId);

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isConfigReady, activeHomeId]);

  const addDevice = useCallback(async (newDevice: Device) => {
    const user = authService.getCurrentUser();
    const devStorageKey = getScopedCacheKey('devices', user?.uid, activeHomeId);
    const updated = [...devices.filter((d) => d.id !== newDevice.id), newDevice];
    setDevices(updated);
    await safeStorage.setItem(devStorageKey, JSON.stringify(updated));
    await firebaseService.saveDevice(newDevice, activeHomeId);
    firebaseService.logEvent({
      type: 'device_added',
      title: 'Thêm thiết bị mới',
      description: `Thiết bị ${newDevice.name} đã được thêm vào ${newDevice.roomName}`,
      actor: authService.getCurrentUser()?.displayName || 'User',
    }, activeHomeId);
  }, [devices, activeHomeId]);

  const removeDevice = useCallback(async (deviceId: string) => {
    const user = authService.getCurrentUser();
    const devStorageKey = getScopedCacheKey('devices', user?.uid, activeHomeId);
    const updated = devices.filter((d) => d.id !== deviceId);
    setDevices(updated);
    await safeStorage.setItem(devStorageKey, JSON.stringify(updated));
    return await firebaseService.removeDevice(deviceId, activeHomeId);
  }, [devices, activeHomeId]);

  const clearAllDevices = useCallback(async () => {
    const user = authService.getCurrentUser();
    const devStorageKey = getScopedCacheKey('devices', user?.uid, activeHomeId);
    setDevices([]);
    await safeStorage.removeItem(devStorageKey);
    return await firebaseService.clearAllDevices(activeHomeId);
  }, [activeHomeId]);

  const addRoom = useCallback(async (newRoom: Room) => {
    const user = authService.getCurrentUser();
    const roomStorageKey = getScopedCacheKey('rooms', user?.uid, activeHomeId);
    const updated = [...rooms, newRoom];
    setRooms(updated);
    await safeStorage.setItem(roomStorageKey, JSON.stringify(updated));
    await firebaseService.saveRoom(newRoom, activeHomeId);
  }, [rooms, activeHomeId]);

  const updateRoom = useCallback(async (roomId: string, updates: Partial<Room>) => {
    const user = authService.getCurrentUser();
    const roomStorageKey = getScopedCacheKey('rooms', user?.uid, activeHomeId);
    const updated = rooms.map((r) => (r.id === roomId ? { ...r, ...updates } : r));
    setRooms(updated);
    await safeStorage.setItem(roomStorageKey, JSON.stringify(updated));
    const target = updated.find((r) => r.id === roomId);
    if (target) await firebaseService.saveRoom(target, activeHomeId);
  }, [rooms, activeHomeId]);

  const removeRoom = useCallback(async (roomId: string) => {
    const user = authService.getCurrentUser();
    const roomStorageKey = getScopedCacheKey('rooms', user?.uid, activeHomeId);
    const updated = rooms.filter((r) => r.id !== roomId);
    setRooms(updated);
    await safeStorage.setItem(roomStorageKey, JSON.stringify(updated));
    await firebaseService.removeRoom(roomId, activeHomeId);
  }, [rooms, activeHomeId]);

  const updateFirebaseConfig = useCallback((config: FirebaseConfig) => {
    setFirebaseConfig(config);
    firebaseService.setConfig(config);
  }, []);

  const updateHomeName = useCallback(async (name: string) => {
    const trimmed = name.trim() || 'Nhà của tôi';
    setOverview((prev) => ({ ...prev, homeName: trimmed }));
    await firebaseService.updateOverviewField('homeName', trimmed, activeHomeId);
  }, [activeHomeId]);

  const markAlertAsRead = useCallback(async (id: string) => {
    const user = authService.getCurrentUser();
    const alertKey = getScopedCacheKey('alerts', user?.uid, activeHomeId);
    const updated = alerts.map((a) => (a.id === id ? { ...a, isRead: true } : a));
    setAlerts(updated);
    await safeStorage.setItem(alertKey, JSON.stringify(updated)).catch(() => {});
    await firebaseService.markAlertRead(id, activeHomeId);
  }, [alerts, activeHomeId]);

  const markAllAlertsAsRead = useCallback(async () => {
    const user = authService.getCurrentUser();
    const alertKey = getScopedCacheKey('alerts', user?.uid, activeHomeId);
    const updated = alerts.map((a) => ({ ...a, isRead: true }));
    setAlerts(updated);
    await safeStorage.setItem(alertKey, JSON.stringify(updated)).catch(() => {});
    const unread = alerts.filter((a) => !a.isRead);
    await Promise.all(unread.map((a) => firebaseService.markAlertRead(a.id, activeHomeId)));
  }, [alerts, activeHomeId]);

  /** Chuyển sang nhà khác — hủy timeouts, reset cache, cập nhật meta và restart Firebase sync */
  const setActiveHomeId = useCallback(async (homeId: string) => {
    if (homeId === activeHomeId) return;

    // 1. Hủy toàn bộ pending command timeouts của nhà cũ
    Object.values(pendingCommandsRef.current).forEach((p) => {
      if (p.timeoutHandle) clearTimeout(p.timeoutHandle);
    });
    pendingCommandsRef.current = {};
    setCommandPending({});

    // 2. Chuyển active home trong context & firebaseService
    setActiveHomeIdState(homeId);
    await firebaseService.setActiveHome(homeId);

    // 3. Reset overview metrics ngay lập tức để không lưu vết metrics nhà cũ
    const isDemo = authService.getCurrentUser()?.isDemo;
    setOverview((prev) => ({
      ...prev,
      totalDevices: 0,
      onlineDevices: 0,
      activeDevices: 0,
      powerConsumptionWatts: 0,
      homeName: isDemo ? 'Tú SmartHome' : 'Đang tải...',
      airQuality: undefined,
    }));

    if (!isDemo) {
      firebaseService.fetchHomeMeta(homeId).then((meta) => {
        if (meta) {
          setOverview((prev) => ({
            ...prev,
            homeName: meta.name || prev.homeName,
            airQuality: (meta as any).airQuality,
          }));
        }
      }).catch(() => {});
    }

    // 4. Nạp cache scoped theo (user, newHomeId)
    const user = authService.getCurrentUser();
    const devKey = getScopedCacheKey('devices', user?.uid, homeId);
    const roomKey = getScopedCacheKey('rooms', user?.uid, homeId);
    const sceneKey = getScopedCacheKey('scenes', user?.uid, homeId);
    const autoKey = getScopedCacheKey('automations', user?.uid, homeId);

    try {
      const [cachedDevs, cachedRooms, cachedScenes, cachedAutos] = await Promise.all([
        safeStorage.getItem(devKey),
        safeStorage.getItem(roomKey),
        safeStorage.getItem(sceneKey),
        safeStorage.getItem(autoKey),
      ]);
      setDevices(cachedDevs ? JSON.parse(cachedDevs) : []);
      setRooms(cachedRooms ? JSON.parse(cachedRooms) : (isDemo ? initialRooms : []));
      setScenes(cachedScenes ? JSON.parse(cachedScenes) : (isDemo ? initialScenes : []));
      setAutomations(cachedAutos ? JSON.parse(cachedAutos) : (isDemo ? initialAutomations : []));
    } catch {
      setDevices([]);
      setRooms(isDemo ? initialRooms : []);
    }
  }, [activeHomeId]);

  const flushOfflineQueue = useCallback(async () => {
    await commandQueueService.flush();
  }, []);

  useEffect(() => {
    return () => {
      Object.values(pendingCommandsRef.current).forEach((p) => {
        if (p.timeoutHandle) clearTimeout(p.timeoutHandle);
      });
    };
  }, []);

  const unreadAlertCount = useMemo(() => alerts.filter((a) => !a.isRead).length, [alerts]);

  const value = useMemo<HomeContextType>(
    () => ({
      overview,
      devices,
      rooms,
      scenes,
      automations,
      alerts,
      firebaseConfig,
      unreadAlertCount,
      connectionStatus,
      activeHomeId,
      commandPending,
      updateHomeName,
      toggleDevice,
      updateDevice,
      turnAllDevices,
      activateScene,
      addScene,
      updateScene,
      removeScene,
      toggleAutomation,
      addAutomation,
      updateAutomation,
      removeAutomation,
      addDevice,
      removeDevice,
      clearAllDevices,
      addRoom,
      updateRoom,
      removeRoom,
      updateFirebaseConfig,
      markAlertAsRead,
      markAllAlertsAsRead,
      setActiveHomeId,
      flushOfflineQueue,
    }),
    [
      overview,
      devices,
      rooms,
      scenes,
      automations,
      alerts,
      firebaseConfig,
      unreadAlertCount,
      connectionStatus,
      activeHomeId,
      commandPending,
      updateHomeName,
      toggleDevice,
      updateDevice,
      turnAllDevices,
      activateScene,
      addScene,
      updateScene,
      removeScene,
      toggleAutomation,
      addAutomation,
      updateAutomation,
      removeAutomation,
      addDevice,
      removeDevice,
      clearAllDevices,
      addRoom,
      updateRoom,
      removeRoom,
      updateFirebaseConfig,
      markAlertAsRead,
      markAllAlertsAsRead,
      setActiveHomeId,
      flushOfflineQueue,
    ]
  );

  return (
    <HomeContext.Provider value={value}>
      {children}
    </HomeContext.Provider>
  );
};

export const useHome = () => {
  const context = useContext(HomeContext);
  if (!context) {
    throw new Error('useHome must be used within a HomeProvider');
  }
  return context;
};

