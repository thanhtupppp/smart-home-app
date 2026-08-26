import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const memoryStore: Record<string, string> = {};

/**
 * Cache thông thường (danh sách thiết bị, phòng, cảnh báo...).
 * Dùng AsyncStorage vì lưu được dữ liệu lớn (SecureStore giới hạn ~2KB mỗi key).
 */
class LocalStorageService {
  public async getItem(key: string): Promise<string | null> {
    try {
      const val = await AsyncStorage.getItem(key);
      if (val !== null && val !== undefined) return val;
    } catch (e) {
      // Fallback
    }
    return memoryStore[key] || null;
  }

  public async setItem(key: string, value: string): Promise<void> {
    memoryStore[key] = value;
    try {
      await AsyncStorage.setItem(key, value);
    } catch (e) {
      // Đã có memoryStore làm fallback
    }
  }

  public async removeItem(key: string): Promise<void> {
    delete memoryStore[key];
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      // Ignore
    }
  }

  public async clear(): Promise<void> {
    for (const key of Object.keys(memoryStore)) {
      delete memoryStore[key];
    }
    try {
      await AsyncStorage.clear();
    } catch (e) {
      // Ignore
    }
  }

  /**
   * Xóa có chọn lọc các cache thuộc về một user cụ thể khi logout,
   * giữ lại cấu hình hệ thống (Theme, Firebase Config, Developer Mode, Onboarding).
   */
  public async clearUserScopedData(uid: string): Promise<void> {
    const userPrefix = `tusmarthome:${uid}:`;

    // 1. Xóa trong memoryStore và xóa các key đã biết từ AsyncStorage
    const memKeys = Object.keys(memoryStore);
    const removals: Promise<unknown>[] = [];

    for (const key of memKeys) {
      if (
        key.startsWith(userPrefix) ||
        key.startsWith('tu_smarthome_devices') ||
        key.startsWith('tu_smarthome_rooms') ||
        key.startsWith('tu_smarthome_scenes') ||
        key.startsWith('tu_smarthome_automations') ||
        key.startsWith('tu_smarthome_members')
      ) {
        delete memoryStore[key];
        removals.push(AsyncStorage.removeItem(key).catch(() => {}));
      }
    }

    // 2. Xóa trong AsyncStorage thông qua getAllKeys nếu có key khác chưa được nạp vào memoryStore
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      if (Array.isArray(allKeys)) {
        const keysToRemove = allKeys.filter(
          (k) =>
            k.startsWith(userPrefix) ||
            k === 'tu_smarthome_devices_cache' ||
            k === 'tu_smarthome_rooms_cache' ||
            k === 'tu_smarthome_scenes_cache' ||
            k === 'tu_smarthome_automations_cache' ||
            k === 'tu_smarthome_members_cache'
        );
        removals.push(...keysToRemove.map((k) => AsyncStorage.removeItem(k).catch(() => {})));
      }
    } catch {
      // Ignore
    }

    await Promise.all(removals);
  }
}

/**
 * Sinh cache key có namespace theo user & home để tránh xung đột dữ liệu (data bleed)
 */
export function getScopedCacheKey(
  entity: string,
  uid?: string,
  homeId?: string
): string {
  const safeUid = uid || 'anon';
  const safeHome = homeId || 'home_main';
  return `tusmarthome:${safeUid}:${safeHome}:${entity}`;
}

/**
 * Dữ liệu nhạy cảm (ID tokens, refresh tokens, API keys...).
 * Ưu tiên SecureStore (Keychain/Keystore), fallback localStorage trên web, cuối cùng là memory.
 */
class SecureStorageService {
  public async getItem(key: string): Promise<string | null> {
    // 1. Try SecureStore on Native platforms (Android/iOS/Expo Go)
    if (Platform.OS !== 'web') {
      try {
        const val = await SecureStore.getItemAsync(key);
        if (val !== null && val !== undefined) return val;
      } catch (e) {
        // Fallback
      }
    }

    // 2. Try window / web localStorage
    if (typeof localStorage !== 'undefined' && localStorage.getItem) {
      try {
        const val = localStorage.getItem(key);
        if (val !== null && val !== undefined) return val;
      } catch (e) {
        // Fallback
      }
    }

    // 3. In-memory fallback
    return memoryStore[key] || null;
  }

  public async setItem(key: string, value: string): Promise<void> {
    memoryStore[key] = value;

    if (Platform.OS !== 'web') {
      try {
        await SecureStore.setItemAsync(key, value);
        return;
      } catch (e) {
        // Fallback
      }
    }

    if (typeof localStorage !== 'undefined' && localStorage.setItem) {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        // Ignore
      }
    }
  }

  public async removeItem(key: string): Promise<void> {
    delete memoryStore[key];

    if (Platform.OS !== 'web') {
      try {
        await SecureStore.deleteItemAsync(key);
        return;
      } catch (e) {
        // Fallback
      }
    }

    if (typeof localStorage !== 'undefined' && localStorage.removeItem) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        // Ignore
      }
    }
  }
}

export const safeStorage = new LocalStorageService();
export const secureStorage = new SecureStorageService();
