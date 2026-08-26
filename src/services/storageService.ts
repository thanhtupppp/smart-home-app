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
}

/**
 * Dữ liệu nhạy cảm (token đăng nhập, database secret...).
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
