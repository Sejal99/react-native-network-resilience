import { createMMKV } from 'react-native-mmkv';
import type { RequestConfig } from '../types';

export interface QueuedRequest {
  id: string;
  config: RequestConfig;
  createdAt: number;
}

const QUEUE_STORAGE_KEY = 'network-resilience:offline-queue';

export class OfflineQueue {
  private readonly storage;
  private queue: QueuedRequest[] = [];

  constructor() {
    this.storage = createMMKV({
      id: 'network-resilience-queue',
    });

    this.load();
  }

  add(config: RequestConfig): string {
    const id = `queued-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    this.queue.push({
      id,
      config,
      createdAt: Date.now(),
    });

    this.persist();

    return id;
  }

  getAll(): QueuedRequest[] {
    return [...this.queue];
  }

  remove(id: string): void {
    this.queue = this.queue.filter((request) => request.id !== id);

    this.persist();
  }

  clear(): void {
    this.queue = [];
    this.persist();
  }

  get size(): number {
    return this.queue.length;
  }

  private load(): void {
    const stored = this.storage.getString(QUEUE_STORAGE_KEY);

    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored);

      if (Array.isArray(parsed)) {
        this.queue = parsed;
      }
    } catch {
      this.queue = [];
    }
  }

  private persist(): void {
    this.storage.set(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
  }
}
