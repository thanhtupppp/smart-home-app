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
import { safeStorage } from '../services/storageService';
import { authService } from '../services/authService';
import { commandQueueService } from '../services/commandQueueService';
import { notificationService } from '../services/notificationService';

const ROOMS_STORAGE_KEY = 'tu_smarthome_rooms_cache';
const DEVICES_STORAGE_KEY = 'tu_smarthome_devices_cache';
const SCENES_STORAGE_KEY = 'tu_smarthome_scenes_cache';
const AUTOMATIONS_STORAGE_KEY = 'tu_smarthome_automations_cache';

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
  const [firebaseConfig, setFirebaseConfig] = useState<FirebaseConfig>(firebaseService.getConfig());
  const [isConfigReady, setIsConfigReady] = useState<boolean>(firebaseService.isConfigLoaded());
  const [connectionStatus, setConnectionStatus] = useState<HomeConnectionStatus>('offline');
  const [activeHomeId, setActiveHomeIdState] = useState<string>(firebaseService.getActiveHomeId());
  /** deviceId → commandId đang chờ ack từ thiết bị */
  const [commandPending, setCommandPending] = useState<Record<string, string>>({});
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
          }).catch(() => {});
        }
      });
    }
  }, []);

  // Load cached devices and listen to remote Firebase changes
  useEffect(() => {
    if (!isConfigReady) return;
    let isMounted = true;
    const initDevices = async () => {
      try {
        const cached = await safeStorage.getItem(DEVICES_STORAGE_KEY);
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
        const result = await firebaseService.fetchDevicesDetailed();
        if (!isMounted) return;
        if (result.ok) {
          const list: Device[] = firebaseService.normalizeDevices(result.data);
          setDevices(list);
          await safeStorage.setItem(DEVICES_STORAGE_KEY, JSON.stringify(list));
        }
      } catch {
        // Ignore
      }
    };

    initDevices();

    const unsubscribe = firebaseService.subscribe((remoteDevices) => {
      if (isMounted) {
        setDevices(remoteDevices);
        safeStorage.setItem(DEVICES_STORAGE_KEY, JSON.stringify(remoteDevices));

        // Kiểm tra ack: nếu reported.lastAppliedCommandId khớp với commandId đang pending
        setCommandPending((prev) => {
          const updates: Record<string, string> = { ...prev };
          let changed = false;
          const timeoutsToClear: string[] = [];

          for (const dev of remoteDevices) {
            const pendingCmdId = prev[dev.id];
            if (pendingCmdId && dev.reported?.lastAppliedCommandId === pendingCmdId) {
              delete updates[dev.id];
              changed = true;
              timeoutsToClear.push(pendingCmdId);
            }
          }

          if (timeoutsToClear.length > 0) {
            setTimeout(() => {
              for (const cmdId of timeoutsToClear) {
                if (commandTimeoutsRef.current[cmdId]) {
                  clearTimeout(commandTimeoutsRef.current[cmdId]);
                  delete commandTimeoutsRef.current[cmdId];
                }
              }
            }, 0);
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
        setCommandPending((prev) => {
          if (prev[deviceId] !== commandId) return prev;
          const updated = { ...prev };
          delete updated[deviceId];

          // Rollback về trạng thái trước lệnh
          const snapshot = devicesSnapshotRef.current[deviceId];
          if (snapshot) {
            setDevices((prevDevs) =>
              prevDevs.map((d) => (d.id === deviceId ? snapshot : d))
            );
          }
          return updated;
        });

        await firebaseService.updateCommandStatus(commandId, 'timeout');
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
    const updated = [...scenes.filter((s) => s.id !== newScene.id), newScene];
    setScenes(updated);
    await safeStorage.setItem(SCENES_STORAGE_KEY, JSON.stringify(updated));
    await firebaseService.saveScene(newScene);
  }, [scenes]);

  const updateScene = useCallback(async (sceneId: string, updates: Partial<Scene>) => {
    const updated = scenes.map((s) => (s.id === sceneId ? { ...s, ...updates } : s));
    setScenes(updated);
    await safeStorage.setItem(SCENES_STORAGE_KEY, JSON.stringify(updated));
    const target = updated.find((s) => s.id === sceneId);
    if (target) await firebaseService.saveScene(target);
  }, [scenes]);

  const removeScene = useCallback(async (sceneId: string) => {
    const updated = scenes.filter((s) => s.id !== sceneId);
    setScenes(updated);
    await safeStorage.setItem(SCENES_STORAGE_KEY, JSON.stringify(updated));
    await firebaseService.removeScene(sceneId);
  }, [scenes]);

  // ─── Automation CRUD ─────────────────────────────────────────────────────

  const toggleAutomation = useCallback(async (id: string) => {
    const target = automations.find((a) => a.id === id);
    if (!target) return;
    const updatedItem = { ...target, isEnabled: !target.isEnabled };
    const updatedList = automations.map((a) => (a.id === id ? updatedItem : a));
    setAutomations(updatedList);
    await safeStorage.setItem(AUTOMATIONS_STORAGE_KEY, JSON.stringify(updatedList));
    await firebaseService.saveAutomation(updatedItem);
  }, [automations]);

  const addAutomation = useCallback(async (newAutomation: Automation) => {
    const updated = [...automations.filter((a) => a.id !== newAutomation.id), newAutomation];
    setAutomations(updated);
    await safeStorage.setItem(AUTOMATIONS_STORAGE_KEY, JSON.stringify(updated));
    await firebaseService.saveAutomation(newAutomation);
  }, [automations]);

  const updateAutomation = useCallback(async (automationId: string, updates: Partial<Automation>) => {
    const updated = automations.map((a) => (a.id === automationId ? { ...a, ...updates } : a));
    setAutomations(updated);
    await safeStorage.setItem(AUTOMATIONS_STORAGE_KEY, JSON.stringify(updated));
    const target = updated.find((a) => a.id === automationId);
    if (target) await firebaseService.saveAutomation(target);
  }, [automations]);

  const removeAutomation = useCallback(async (automationId: string) => {
    const updated = automations.filter((a) => a.id !== automationId);
    setAutomations(updated);
    await safeStorage.setItem(AUTOMATIONS_STORAGE_KEY, JSON.stringify(updated));
    await firebaseService.removeAutomation(automationId);
  }, [automations]);

  // Sync Scenes & Automations from Firebase
  useEffect(() => {
    if (!isConfigReady) return;
    let isMounted = true;

    const initScenesAndAutomations = async () => {
      try {
        const remoteScenes = await firebaseService.fetchScenes();
        if (remoteScenes && Object.keys(remoteScenes).length > 0 && isMounted) {
          const list: Scene[] = Object.values(remoteScenes);
          setScenes(list);
          await safeStorage.setItem(SCENES_STORAGE_KEY, JSON.stringify(list));
        }

        const remoteAutomations = await firebaseService.fetchAutomations();
        if (remoteAutomations && Object.keys(remoteAutomations).length > 0 && isMounted) {
          const list: Automation[] = Object.values(remoteAutomations);
          setAutomations(list);
          await safeStorage.setItem(AUTOMATIONS_STORAGE_KEY, JSON.stringify(list));
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
    const initRooms = async () => {
      let localRooms: Room[] = initialRooms;
      try {
        const cached = await safeStorage.getItem(ROOMS_STORAGE_KEY);
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
        const remote = await firebaseService.fetchRooms();
        if (remote && Object.keys(remote).length > 0) {
          const list: Room[] = Object.values(remote);
          if (isMounted) {
            setRooms(list);
            await safeStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(list));
          }
        } else {
          for (const r of localRooms) {
            await firebaseService.saveRoom(r);
          }
          await safeStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(localRooms));
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
      const list = await firebaseService.fetchAlerts();
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
    const updated = [...devices.filter((d) => d.id !== newDevice.id), newDevice];
    setDevices(updated);
    safeStorage.setItem(DEVICES_STORAGE_KEY, JSON.stringify(updated));
    firebaseService.saveDevice(newDevice);
    firebaseService.logEvent({
      type: 'device_added',
      title: 'Thêm thiết bị mới',
      description: `Thiết bị ${newDevice.name} đã được thêm vào ${newDevice.roomName}`,
      actor: authService.getCurrentUser()?.displayName || 'User',
    });
  }, [devices]);

  const removeDevice = useCallback(async (deviceId: string) => {
    const updated = devices.filter((d) => d.id !== deviceId);
    setDevices(updated);
    await safeStorage.setItem(DEVICES_STORAGE_KEY, JSON.stringify(updated));
    return await firebaseService.removeDevice(deviceId);
  }, [devices]);

  const clearAllDevices = useCallback(async () => {
    setDevices([]);
    await safeStorage.removeItem(DEVICES_STORAGE_KEY);
    return await firebaseService.clearAllDevices();
  }, []);

  const addRoom = useCallback((newRoom: Room) => {
    const updated = [...rooms, newRoom];
    setRooms(updated);
    safeStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(updated));
    firebaseService.saveRoom(newRoom);
  }, [rooms]);

  const updateRoom = useCallback((roomId: string, updates: Partial<Room>) => {
    const updated = rooms.map((r) => (r.id === roomId ? { ...r, ...updates } : r));
    setRooms(updated);
    safeStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(updated));
    const target = updated.find((r) => r.id === roomId);
    if (target) firebaseService.saveRoom(target);
  }, [rooms]);

  const removeRoom = useCallback((roomId: string) => {
    const updated = rooms.filter((r) => r.id !== roomId);
    setRooms(updated);
    safeStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(updated));
    firebaseService.removeRoom(roomId);
  }, [rooms]);

  const updateFirebaseConfig = useCallback((config: FirebaseConfig) => {
    setFirebaseConfig(config);
    firebaseService.setConfig(config);
  }, []);

  const updateHomeName = useCallback(async (name: string) => {
    const trimmed = name.trim() || 'Nhà của tôi';
    setOverview((prev) => ({ ...prev, homeName: trimmed }));
    await firebaseService.updateOverviewField('homeName', trimmed);
  }, []);

  const markAlertAsRead = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isRead: true } : a))
    );
    firebaseService.markAlertRead(id);
  }, []);

  const markAllAlertsAsRead = useCallback(() => {
    alerts
      .filter((a) => !a.isRead)
      .forEach((a) => firebaseService.markAlertRead(a.id));
    setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
  }, [alerts]);

  /** Chuyển sang nhà khác — reset cache và restart Firebase sync */
  const setActiveHomeId = useCallback(async (homeId: string) => {
    setActiveHomeIdState(homeId);
    await firebaseService.setActiveHome(homeId);
    await safeStorage.removeItem(DEVICES_STORAGE_KEY);
    await safeStorage.removeItem(ROOMS_STORAGE_KEY);
    setDevices([]);
    setRooms(initialRooms);
  }, []);

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

