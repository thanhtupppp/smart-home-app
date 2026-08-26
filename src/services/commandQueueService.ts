import { DeviceCommand } from '../types';
import { safeStorage } from './storageService';
import { firebaseService } from './firebaseService';

const QUEUE_STORAGE_KEY = 'tu_smarthome_offline_command_queue';
const MAX_RETRIES = 3;

export interface QueuedCommand {
  id: string;
  deviceId: string;
  command: DeviceCommand;
  requestedBy: string;
  createdAt: number;
  retryCount: number;
}

class CommandQueueService {
  private queue: QueuedCommand[] = [];
  private isProcessing = false;
  private debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};

  constructor() {
    this.loadPersistedQueue();
  }

  private async loadPersistedQueue() {
    try {
      const data = await safeStorage.getItem(QUEUE_STORAGE_KEY);
      if (data) {
        this.queue = JSON.parse(data) || [];
      }
    } catch {
      this.queue = [];
    }
  }

  private async persistQueue() {
    try {
      await safeStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
    } catch {
      // Ignore
    }
  }

  /**
   * Đưa lệnh vào hàng đợi offline (nếu mạng yếu hoặc mất kết nối)
   */
  public async enqueue(
    deviceId: string,
    command: DeviceCommand,
    requestedBy: string
  ): Promise<string> {
    const id = `queued_cmd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const item: QueuedCommand = {
      id,
      deviceId,
      command,
      requestedBy,
      createdAt: Date.now(),
      retryCount: 0,
    };

    // Thay thế lệnh cùng deviceId và cùng type trước đó trong queue để tránh xung đột
    this.queue = this.queue.filter(
      (q) => !(q.deviceId === deviceId && q.command.type === command.type)
    );
    this.queue.push(item);
    await this.persistQueue();

    // Thử gửi ngay nếu online
    if (firebaseService.getConnectionStatus() === 'connected') {
      this.flush();
    }

    return id;
  }

  /**
   * Gửi toàn bộ các lệnh đang chờ khi kết nối mạng được khôi phục (xử lý song song / batch)
   */
  public async flush(): Promise<{ succeeded: number; failed: number }> {
    if (this.isProcessing || this.queue.length === 0) {
      return { succeeded: 0, failed: 0 };
    }

    this.isProcessing = true;
    let succeeded = 0;
    let failed = 0;
    const remaining: QueuedCommand[] = [];

    try {
      const itemsToProcess = [...this.queue];
      const results = await Promise.allSettled(
        itemsToProcess.map(async (item) => {
          try {
            const res = await firebaseService.sendCommand(
              item.deviceId,
              item.command,
              item.requestedBy
            );
            return { item, success: !!res };
          } catch {
            return { item, success: false };
          }
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          const { item, success } = result.value;
          if (success) {
            succeeded++;
          } else {
            item.retryCount++;
            if (item.retryCount < MAX_RETRIES) {
              remaining.push(item);
            } else {
              failed++;
            }
          }
        }
      }

      this.queue = remaining;
      await this.persistQueue();
    } finally {
      this.isProcessing = false;
    }

    return { succeeded, failed };
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  public clearQueue(): Promise<void> {
    this.queue = [];
    return this.persistQueue();
  }

  /**
   * Helper Debounce cho thanh trượt (Độ sáng, Nhiệt độ, Màu sắc RGB)
   */
  public debounce(key: string, callback: () => void, delayMs = 300) {
    if (this.debounceTimers[key]) {
      clearTimeout(this.debounceTimers[key]);
    }
    this.debounceTimers[key] = setTimeout(() => {
      delete this.debounceTimers[key];
      callback();
    }, delayMs);
  }
}

export const commandQueueService = new CommandQueueService();
