import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Device,
  Room,
  Scene,
  Automation,
  AlertNotification,
  HomeOverview,
  FirebaseConfig,
} from '../types';
import { initialDevices, initialRooms, initialScenes, initialAutomations, initialAlerts, initialHomeOverview } from '../services/mockData';
import { firebaseService } from '../services/firebaseService';
import { safeStorage } from '../services/storageService';

const ROOMS_STORAGE_KEY = 'tu_smarthome_rooms_cache';
const DEVICES_STORAGE_KEY = 'tu_smarthome_devices_cache';

interface HomeContextType {
  overview: HomeOverview;
  devices: Device[];
  rooms: Room[];
  scenes: Scene[];
  automations: Automation[];
  alerts: AlertNotification[];
  firebaseConfig: FirebaseConfig;
  unreadAlertCount: number;
  updateHomeName: (name: string) => Promise<void>;
  toggleDevice: (id: string) => void;
  updateDevice: (id: string, updates: Partial<Device>) => void;
  turnAllDevices: (isOn: boolean, roomId?: string) => void;
  activateScene: (id: string) => void;
  toggleAutomation: (id: string) => void;
  addDevice: (device: Device) => void;
  removeDevice: (deviceId: string) => Promise<boolean>;
  clearAllDevices: () => Promise<boolean>;
  addRoom: (room: Room) => void;
  updateRoom: (roomId: string, updates: Partial<Room>) => void;
  removeRoom: (roomId: string) => void;
  updateFirebaseConfig: (config: FirebaseConfig) => void;
  markAlertAsRead: (id: string) => void;
  markAllAlertsAsRead: () => void;
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

  // Load persisted Firebase config (custom project URL, API key, demo mode) before any sync
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
          // Remote là nguồn chuẩn: cập nhật KỂ CẢ khi node trống
          // (mọi thiết bị đã bị xóa trên Firebase -> app phải trống theo)
          const list: Device[] = result.data ? Object.values(result.data) : [];
          setDevices(list);
          await safeStorage.setItem(DEVICES_STORAGE_KEY, JSON.stringify(list));
        }
        // result.ok === false (lỗi mạng/auth): giữ nguyên cache đã load ở trên
      } catch {
        // Ignore
      }
    };

    initDevices();

    const unsubscribe = firebaseService.subscribe((remoteDevices) => {
      if (isMounted) {
        setDevices(remoteDevices);
        safeStorage.setItem(DEVICES_STORAGE_KEY, JSON.stringify(remoteDevices));
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isConfigReady]);

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

  const toggleDevice = (id: string) => {
    setDevices((prev) =>
      prev.map((dev) => {
        if (dev.id === id) {
          const nextState = !dev.isOn;
          const updated = { ...dev, isOn: nextState };
          firebaseService.syncDeviceState({ id, isOn: nextState });
          return updated;
        }
        return dev;
      })
    );
  };

  const updateDevice = (id: string, updates: Partial<Device>) => {
    setDevices((prev) =>
      prev.map((dev) => {
        if (dev.id === id) {
          const updated = { ...dev, ...updates };
          firebaseService.syncDeviceState({ id, ...updates });
          return updated;
        }
        return dev;
      })
    );
  };

  const turnAllDevices = (isOn: boolean, roomId?: string) => {
    setDevices((prev) =>
      prev.map((dev) => {
        if (!roomId || dev.roomId === roomId) {
          firebaseService.syncDeviceState({ id: dev.id, isOn });
          return { ...dev, isOn };
        }
        return dev;
      })
    );
  };

  const activateScene = (sceneId: string) => {
    setScenes((prev) =>
      prev.map((s) => ({ ...s, isActive: s.id === sceneId }))
    );

    // Scene là hành động tức thời: sau vài giây thì bỏ trạng thái "đang chạy"
    setTimeout(() => {
      setScenes((prev) =>
        prev.map((s) => (s.id === sceneId ? { ...s, isActive: false } : s))
      );
    }, 3000);

    if (sceneId === 'scene_arrive_home') {
      // Turn on living room devices
      setDevices((prev) =>
        prev.map((d) => {
          if (d.roomId === 'room_living' && (d.type === 'light' || d.type === 'ac' || d.type === 'rgb_light')) {
            firebaseService.syncDeviceState({ id: d.id, isOn: true });
            return { ...d, isOn: true };
          }
          return d;
        })
      );
    } else if (sceneId === 'scene_leave_home') {
      // Turn off all devices
      turnAllDevices(false);
    } else if (sceneId === 'scene_sleep') {
      // Tắt đèn phòng khách, đưa điều hòa phòng ngủ Master về 26°C
      setDevices((prev) =>
        prev.map((d) => {
          if ((d.type === 'light' || d.type === 'rgb_light') && d.roomId === 'room_living') {
            firebaseService.syncDeviceState({ id: d.id, isOn: false });
            return { ...d, isOn: false };
          }
          if (d.type === 'ac' && d.roomId === 'room_bedroom_master') {
            const updates = { isOn: true, temperature: 26, acMode: 'cool' as const };
            firebaseService.syncDeviceState({ id: d.id, ...updates });
            return { ...d, ...updates };
          }
          return d;
        })
      );
    } else if (sceneId === 'scene_movie') {
      // RGB movie mode
      setDevices((prev) =>
        prev.map((d) => {
          if (d.type === 'rgb_light') {
            const updates = { isOn: true, color: '#7c4dff', brightness: 25, rgbMode: 'breathing' as const };
            firebaseService.syncDeviceState({ id: d.id, ...updates });
            return { ...d, ...updates };
          }
          if (d.type === 'light' && d.roomId === 'room_living') {
            firebaseService.syncDeviceState({ id: d.id, isOn: false });
            return { ...d, isOn: false };
          }
          return d;
        })
      );
    }
  };

  const toggleAutomation = (id: string) => {
    setAutomations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isEnabled: !a.isEnabled } : a))
    );
  };

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
          // Initialize rooms to Firebase
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
  }, [isConfigReady]);

  // Nạp cảnh báo từ Firebase (ESP32 đẩy lên /alerts) và lắng nghe cập nhật.
  // Chế độ demo giữ bộ cảnh báo mẫu; fetch lỗi thì giữ nguyên dữ liệu hiện tại.
  useEffect(() => {
    if (!isConfigReady) return;
    let isMounted = true;

    const initAlerts = async () => {
      if (firebaseService.getConfig().isDemoMode) return;
      const list = await firebaseService.fetchAlerts();
      // list === null nghĩa là fetch lỗi -> giữ nguyên bộ cảnh báo hiện tại
      if (!isMounted || list === null) return;
      setAlerts(list);
    };

    initAlerts();

    const unsubscribe = firebaseService.subscribeAlerts((remoteAlerts) => {
      if (isMounted) setAlerts(remoteAlerts);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isConfigReady]);

  const addDevice = (newDevice: Device) => {
    setDevices((prev) => {
      const updated = [...prev.filter((d) => d.id !== newDevice.id), newDevice];
      safeStorage.setItem(DEVICES_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
    firebaseService.saveDevice(newDevice);
  };

  const removeDevice = async (deviceId: string) => {
    setDevices((prev) => {
      const updated = prev.filter((d) => d.id !== deviceId);
      safeStorage.setItem(DEVICES_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
    return await firebaseService.removeDevice(deviceId);
  };

  const clearAllDevices = async () => {
    setDevices([]);
    await safeStorage.removeItem(DEVICES_STORAGE_KEY);
    return await firebaseService.clearAllDevices();
  };

  const addRoom = (newRoom: Room) => {
    setRooms((prev) => {
      const updated = [...prev, newRoom];
      safeStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
    firebaseService.saveRoom(newRoom);
  };

  const updateRoom = (roomId: string, updates: Partial<Room>) => {
    setRooms((prev) => {
      const updated = prev.map((r) => (r.id === roomId ? { ...r, ...updates } : r));
      safeStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(updated));
      const target = updated.find((r) => r.id === roomId);
      if (target) firebaseService.saveRoom(target);
      return updated;
    });
  };

  const removeRoom = (roomId: string) => {
    setRooms((prev) => {
      const updated = prev.filter((r) => r.id !== roomId);
      safeStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
    firebaseService.removeRoom(roomId);
  };

  const updateFirebaseConfig = (config: FirebaseConfig) => {
    setFirebaseConfig(config);
    firebaseService.setConfig(config);
  };

  const updateHomeName = async (name: string) => {
    const trimmed = name.trim() || 'Nhà của tôi';
    setOverview((prev) => ({ ...prev, homeName: trimmed }));
    if (!firebaseConfig.isDemoMode && firebaseConfig.databaseURL) {
      try {
        const url = `${firebaseConfig.databaseURL.replace(/\/+$/, '')}/overview.json${await firebaseService.getAuthParamAsync()}`;
        await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ homeName: trimmed }),
        });
      } catch {
        // Fallback
      }
    }
  };

  const markAlertAsRead = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isRead: true } : a))
    );
    // Đồng bộ lên Firebase để thiết bị khác cũng thấy trạng thái đã đọc
    firebaseService.markAlertRead(id);
  };

  const markAllAlertsAsRead = () => {
    alerts
      .filter((a) => !a.isRead)
      .forEach((a) => firebaseService.markAlertRead(a.id));
    setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
  };

  const unreadAlertCount = alerts.filter((a) => !a.isRead).length;

  return (
    <HomeContext.Provider
      value={{
        overview,
        devices,
        rooms,
        scenes,
        automations,
        alerts,
        firebaseConfig,
        unreadAlertCount,
        updateHomeName,
        toggleDevice,
        updateDevice,
        turnAllDevices,
        activateScene,
        toggleAutomation,
        addDevice,
        removeDevice,
        clearAllDevices,
        addRoom,
        updateRoom,
        removeRoom,
        updateFirebaseConfig,
        markAlertAsRead,
        markAllAlertsAsRead,
      }}
    >
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
