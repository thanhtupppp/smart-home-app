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
  addDevice: (device: Device) => void;
  removeDevice: (deviceId: string) => Promise<boolean>;
  clearAllDevices: () => Promise<boolean>;
  addRoom: (room: Room) => void;
  updateRoom: (roomId: string, updates: Partial<Room>) => void;
  removeRoom: (roomId: string) => void;
  updateFirebaseConfig: (config: FirebaseConfig) => void;
  markAlertAsRead: (id: string) => void;
  markAllAlertsAsRead: () => void;
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

  /** Ref giữ snapshot devices để rollback optimistic state */
  const devicesSnapshotRef = useRef<Record<string, Device>>({});
  /** Ref giữ timeout handles để clear khi ack đến */
  const commandTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
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
        safeStorage.setItem(devStorageKey, JSON.stringify(remoteDevices));

        // Kiểm tra ack: clear timeouts nếu reported.lastAppliedCommandId khớp
        for (const dev of remoteDevices) {
          const pendingCmdId = commandPendingRef.current[dev.id];
          if (pendingCmdId && dev.reported?.lastAppliedCommandId === pendingCmdId) {
            if (commandTimeoutsRef.current[pendingCmdId]) {
              clearTimeout(commandTimeoutsRef.current[pendingCmdId]);
              delete commandTimeoutsRef.current[pendingCmdId];
            }
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
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isConfigReady, activeHomeId]);

  // Snapshot devices để rollback khi command timeout
  useEffect(() => {
    const map: Record<string, Device> = {};
    for (const d of devices) map[d.id] = d;
    devicesSnapshotRef.current = map;
  }, [devices]);

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
   * Gửi command qua firebaseService.sendCommand() với optimistic update + offline queue.
   */
  const sendDeviceCommand = useCallback(
    async (deviceId: string, command: DeviceCommand) => {
      const user = authService.getCurrentUser();
      const uid = user?.uid || 'demo';

      // Nếu đang offline -> đưa vào offline command queue
      if (connectionStatus === 'offline') {
        await commandQueueService.enqueue(deviceId, command, uid);
        return;
      }

      const commandId = await firebaseService.sendCommand(deviceId, command, uid);
      if (!commandId) {
        // Fallback: đưa vào queue để thử lại khi có mạng
        await commandQueueService.enqueue(deviceId, command, uid);
        return;
      }

      // Log event
      firebaseService.logEvent({
        type: 'device_command',
        title: `Lệnh ${command.type}`,
        description: `Người dùng ${user?.displayName || 'User'} gửi lệnh ${command.type} tới ${deviceId}`,
        actor: user?.displayName || 'App',
      });

      // Track pending
      setCommandPending((prev) => ({ ...prev, [deviceId]: commandId }));

      // Đặt timeout rollback sau 15s nếu thiết bị không ack
      const timeoutHandle = setTimeout(async () => {
        if (commandPendingRef.current[deviceId] === commandId) {
          setCommandPending((prev) => {
            if (prev[deviceId] !== commandId) return prev;
            const updated = { ...prev };
            delete updated[deviceId];
            return updated;
          });

          // Rollback về trạng thái trước lệnh bên ngoài state updater
          const snapshot = devicesSnapshotRef.current[deviceId];
          if (snapshot) {
            setDevices((prevDevs) =>
              prevDevs.map((d) => (d.id === deviceId ? snapshot : d))
            );
          }
          await firebaseService.updateCommandStatus(commandId, 'timeout');
        }

        delete commandTimeoutsRef.current[commandId];
      }, COMMAND_TIMEOUT_MS);

      commandTimeoutsRef.current[commandId] = timeoutHandle;
    },
    [connectionStatus]
  );

  const toggleDevice = useCallback((id: string) => {
    const currentDev = devices.find((d) => d.id === id);
    if (!currentDev) return;
    const nextState = !currentDev.isOn;

    setDevices((prev) =>
      prev.map((dev) => (dev.id === id ? { ...dev, isOn: nextState } : dev))
    );
    sendDeviceCommand(id, { type: 'power', value: nextState });
  }, [devices, sendDeviceCommand]);

  const updateDevice = useCallback((id: string, updates: Partial<Device>) => {
    setDevices((prev) =>
      prev.map((dev) => (dev.id === id ? { ...dev, ...updates } : dev))
    );

    if (updates.isOn !== undefined) {
      sendDeviceCommand(id, { type: 'power', value: updates.isOn });
    } else if (updates.brightness !== undefined) {
      commandQueueService.debounce(`brightness_${id}`, () => {
        sendDeviceCommand(id, { type: 'brightness', value: updates.brightness! });
      }, 250);
    } else if (updates.temperature !== undefined) {
      commandQueueService.debounce(`temp_${id}`, () => {
        sendDeviceCommand(id, { type: 'temperature', value: updates.temperature! });
      }, 300);
    } else if (updates.color !== undefined) {
      commandQueueService.debounce(`color_${id}`, () => {
        sendDeviceCommand(id, {
          type: 'rgb',
          color: updates.color!,
          brightness: updates.brightness,
          mode: updates.rgbMode,
        });
      }, 300);
    } else if (updates.acMode !== undefined) {
      sendDeviceCommand(id, { type: 'acMode', value: updates.acMode });
    } else if (updates.fanSpeed !== undefined) {
      sendDeviceCommand(id, { type: 'fanSpeed', value: updates.fanSpeed });
    } else {
      firebaseService.syncDeviceState({ id, ...updates });
    }
  }, [sendDeviceCommand]);

  const turnAllDevices = useCallback((isOn: boolean, roomId?: string) => {
    const targetDevices = devices.filter((d) => !roomId || d.roomId === roomId);

    setDevices((prev) =>
      prev.map((dev) => {
        if (!roomId || dev.roomId === roomId) {
          return { ...dev, isOn };
        }
        return dev;
      })
    );

    for (const dev of targetDevices) {
      sendDeviceCommand(dev.id, { type: 'power', value: isOn });
    }
  }, [devices, sendDeviceCommand]);

  const activateScene = useCallback((sceneId: string) => {
    setScenes((prev) =>
      prev.map((s) => ({ ...s, isActive: s.id === sceneId }))
    );

    setTimeout(() => {
      setScenes((prev) =>
        prev.map((s) => (s.id === sceneId ? { ...s, isActive: false } : s))
      );
    }, 3000);

    const scene = scenes.find((s) => s.id === sceneId);
    firebaseService.logEvent({
      type: 'scene_activated',
      title: `Kích hoạt Ngữ cảnh`,
      description: `Ngữ cảnh "${scene?.name || sceneId}" đã được kích hoạt`,
      actor: authService.getCurrentUser()?.displayName || 'User',
    });

    if (scene?.actions && scene.actions.length > 0) {
      setDevices((prevDevs) =>
        prevDevs.map((d) => {
          const matchingAction = scene.actions?.find((a) => a.deviceId === d.id);
          if (!matchingAction) return d;
          return { ...d, ...matchingAction.patch };
        })
      );

      for (const action of scene.actions) {
        const patch = action.patch;
        if (patch.isOn !== undefined) {
          sendDeviceCommand(action.deviceId, { type: 'power', value: patch.isOn });
        }
        if (patch.brightness !== undefined) {
          sendDeviceCommand(action.deviceId, { type: 'brightness', value: patch.brightness });
        }
        if (patch.temperature !== undefined) {
          sendDeviceCommand(action.deviceId, { type: 'temperature', value: patch.temperature });
        }
        if (patch.color !== undefined) {
          sendDeviceCommand(action.deviceId, {
            type: 'rgb',
            color: patch.color,
            brightness: patch.brightness,
            mode: patch.rgbMode,
          });
        }
        if (patch.acMode !== undefined) {
          sendDeviceCommand(action.deviceId, { type: 'acMode', value: patch.acMode });
        }
      }
    } else {
      if (sceneId === 'scene_arrive_home') {
        const targetDevs = devices.filter(
          (d) => d.roomId === 'room_living' && (d.type === 'light' || d.type === 'ac' || d.type === 'rgb_light')
        );
        setDevices((prevDevs) =>
          prevDevs.map((d) => {
            if (d.roomId === 'room_living' && (d.type === 'light' || d.type === 'ac' || d.type === 'rgb_light')) {
              return { ...d, isOn: true };
            }
            return d;
          })
        );
        for (const d of targetDevs) {
          sendDeviceCommand(d.id, { type: 'power', value: true });
        }
      } else if (sceneId === 'scene_leave_home') {
        turnAllDevices(false);
      } else if (sceneId === 'scene_sleep') {
        const livingLights = devices.filter(
          (d) => (d.type === 'light' || d.type === 'rgb_light') && d.roomId === 'room_living'
        );
        const masterAc = devices.find(
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
        for (const d of livingLights) {
          sendDeviceCommand(d.id, { type: 'power', value: false });
        }
        if (masterAc) {
          sendDeviceCommand(masterAc.id, { type: 'temperature', value: 26 });
          sendDeviceCommand(masterAc.id, { type: 'power', value: true });
        }
      } else if (sceneId === 'scene_movie') {
        const rgbLights = devices.filter((d) => d.type === 'rgb_light');
        const livingNormalLights = devices.filter(
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
        for (const d of rgbLights) {
          sendDeviceCommand(d.id, { type: 'rgb', color: '#7c4dff', brightness: 25, mode: 'breathing' });
          sendDeviceCommand(d.id, { type: 'power', value: true });
        }
        for (const d of livingNormalLights) {
          sendDeviceCommand(d.id, { type: 'power', value: false });
        }
      }
    }
  }, [devices, scenes, sendDeviceCommand, turnAllDevices]);

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
      let localRooms: Room[] = initialRooms;
      try {
        const cached = await safeStorage.getItem(roomStorageKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
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
        } else {
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
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isConfigReady, activeHomeId]);

  const addDevice = useCallback((newDevice: Device) => {
    const user = authService.getCurrentUser();
    const devStorageKey = getScopedCacheKey('devices', user?.uid, activeHomeId);
    const updated = [...devices.filter((d) => d.id !== newDevice.id), newDevice];
    setDevices(updated);
    safeStorage.setItem(devStorageKey, JSON.stringify(updated));
    firebaseService.saveDevice(newDevice, activeHomeId);
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

  const addRoom = useCallback((newRoom: Room) => {
    const user = authService.getCurrentUser();
    const roomStorageKey = getScopedCacheKey('rooms', user?.uid, activeHomeId);
    const updated = [...rooms, newRoom];
    setRooms(updated);
    safeStorage.setItem(roomStorageKey, JSON.stringify(updated));
    firebaseService.saveRoom(newRoom, activeHomeId);
  }, [rooms, activeHomeId]);

  const updateRoom = useCallback((roomId: string, updates: Partial<Room>) => {
    const user = authService.getCurrentUser();
    const roomStorageKey = getScopedCacheKey('rooms', user?.uid, activeHomeId);
    const updated = rooms.map((r) => (r.id === roomId ? { ...r, ...updates } : r));
    setRooms(updated);
    safeStorage.setItem(roomStorageKey, JSON.stringify(updated));
    const target = updated.find((r) => r.id === roomId);
    if (target) firebaseService.saveRoom(target, activeHomeId);
  }, [rooms, activeHomeId]);

  const removeRoom = useCallback((roomId: string) => {
    const user = authService.getCurrentUser();
    const roomStorageKey = getScopedCacheKey('rooms', user?.uid, activeHomeId);
    const updated = rooms.filter((r) => r.id !== roomId);
    setRooms(updated);
    safeStorage.setItem(roomStorageKey, JSON.stringify(updated));
    firebaseService.removeRoom(roomId, activeHomeId);
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

  const markAlertAsRead = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isRead: true } : a))
    );
    firebaseService.markAlertRead(id, activeHomeId);
  }, [activeHomeId]);

  const markAllAlertsAsRead = useCallback(() => {
    for (const a of alerts) {
      if (!a.isRead) {
        firebaseService.markAlertRead(a.id, activeHomeId);
      }
    }
    setAlerts((prev) => prev.map((a) => (a.isRead ? a : { ...a, isRead: true })));
  }, [alerts, activeHomeId]);

  /** Chuyển sang nhà khác — hủy timeouts, reset cache và restart Firebase sync */
  const setActiveHomeId = useCallback(async (homeId: string) => {
    if (homeId === activeHomeId) return;

    // 1. Hủy các command timeout pending của nhà cũ
    Object.values(commandTimeoutsRef.current).forEach(clearTimeout);
    commandTimeoutsRef.current = {};
    setCommandPending({});

    // 2. Chuyển active home trong context & firebaseService
    setActiveHomeIdState(homeId);
    await firebaseService.setActiveHome(homeId);

    // 3. Nạp cache scoped theo (user, newHomeId)
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
      setRooms(cachedRooms ? JSON.parse(cachedRooms) : initialRooms);
      setScenes(cachedScenes ? JSON.parse(cachedScenes) : initialScenes);
      setAutomations(cachedAutos ? JSON.parse(cachedAutos) : initialAutomations);
    } catch {
      setDevices([]);
      setRooms(initialRooms);
    }
  }, [activeHomeId]);

  const flushOfflineQueue = useCallback(async () => {
    await commandQueueService.flush();
  }, []);

  useEffect(() => {
    return () => {
      Object.values(commandTimeoutsRef.current).forEach(clearTimeout);
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

