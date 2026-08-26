import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { MockedFunction } from 'jest-mock';

import { RetryPolicy } from '../retry/RetryPolicy';
import { NetworkError } from '../errors/NetworkError';
import { OfflineQueue } from '../queue/OfflineQueue';
import { QueueProcessor } from '../queue/QueueProcessor';
import { RequestManager } from '../request/RequestManager';
import { RequestRegistry } from '../request/RequestRegistry';
import { NetworkClient } from '../client/NetworkClient';
import { NetworkEventEmitter } from '../events/NetworkEventEmitter';
import { CancellationManager } from '../cancellation/CancellationManager';

import type { ConnectivityProvider } from '../connectivity/ConnectivityProvider';
import type { HttpTransport } from '../transport/HttpTransport';
import type { NetworkEvent } from '../events/NetworkEvent';
import type { RequestConfig, RetryConfig } from '../types';

const mockStorage = {
  getString: jest.fn(),
  set: jest.fn(),
};

jest.mock('react-native-mmkv', () => ({
  createMMKV: jest.fn(() => mockStorage),
}));

const retryConfig: RetryConfig = {
  maxAttempts: 3,
  backoff: 'exponential',
  initialDelay: 0,
  maxDelay: 1000,
  jitter: false,
};

describe('RetryPolicy', () => {
  it('should retry a network error', () => {
    const policy = new RetryPolicy(retryConfig);

    const error = new NetworkError('Network failed', {
      code: 'NETWORK_ERROR',
    });

    expect(policy.shouldRetry(error, 1)).toBe(true);
  });

  it('should retry a timeout error', () => {
    const policy = new RetryPolicy(retryConfig);

    const error = new NetworkError('Request timed out', {
      code: 'TIMEOUT',
    });

    expect(policy.shouldRetry(error, 1)).toBe(true);
  });

  it('should not retry a cancelled request', () => {
    const policy = new RetryPolicy(retryConfig);

    const error = new NetworkError('Request cancelled', {
      code: 'CANCELLED',
    });

    expect(policy.shouldRetry(error, 1)).toBe(false);
  });

  it('should not retry after max attempts', () => {
    const policy = new RetryPolicy(retryConfig);

    const error = new NetworkError('Network failed', {
      code: 'NETWORK_ERROR',
    });

    expect(policy.shouldRetry(error, 3)).toBe(false);
  });
});

describe('BackoffStrategy', () => {
  it('should calculate exponential backoff', () => {
    const policy = new RetryPolicy({
      maxAttempts: 5,
      backoff: 'exponential',
      initialDelay: 100,
      maxDelay: 1000,
      jitter: false,
    });

    expect(policy.getDelay(1)).toBe(100);
    expect(policy.getDelay(2)).toBe(200);
    expect(policy.getDelay(3)).toBe(400);
  });

  it('should respect the maximum delay', () => {
    const policy = new RetryPolicy({
      maxAttempts: 5,
      backoff: 'exponential',
      initialDelay: 100,
      maxDelay: 500,
      jitter: false,
    });

    expect(policy.getDelay(4)).toBe(500);
    expect(policy.getDelay(5)).toBe(500);
  });
});

describe('OfflineQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.getString.mockReturnValue(undefined);
  });

  it('should start with an empty queue', () => {
    const queue = new OfflineQueue();

    expect(queue.size).toBe(0);
    expect(queue.getAll()).toEqual([]);
  });

  it('should add a request to the queue', () => {
    const queue = new OfflineQueue();

    const requestConfig: RequestConfig = {
      url: '/users',
      method: 'GET',
    };

    const id = queue.add(requestConfig);
    const requests = queue.getAll();

    expect(id).toMatch(/^queued-/);
    expect(queue.size).toBe(1);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.config).toEqual(requestConfig);
    expect(mockStorage.set).toHaveBeenCalled();
  });

  it('should remove a queued request', () => {
    const queue = new OfflineQueue();

    const id = queue.add({
      url: '/users',
      method: 'GET',
    });

    queue.remove(id);

    expect(queue.size).toBe(0);
    expect(queue.getAll()).toEqual([]);
  });

  it('should clear all queued requests', () => {
    const queue = new OfflineQueue();

    queue.add({
      url: '/users',
      method: 'GET',
    });

    queue.add({
      url: '/posts',
      method: 'GET',
    });

    expect(queue.size).toBe(2);

    queue.clear();

    expect(queue.size).toBe(0);
    expect(queue.getAll()).toEqual([]);
  });

  it('should load persisted requests', () => {
    const persistedQueue = [
      {
        id: 'queued-test-123',
        config: {
          url: '/users',
          method: 'GET' as const,
        },
        createdAt: Date.now(),
      },
    ];

    mockStorage.getString.mockReturnValue(JSON.stringify(persistedQueue));

    const queue = new OfflineQueue();

    expect(queue.size).toBe(1);
    expect(queue.getAll()).toEqual(persistedQueue);
  });
});

describe('QueueProcessor', () => {
  it('should process queued requests when online', async () => {
    const queuedRequest = {
      id: 'queued-1',
      config: {
        url: '/users',
        method: 'GET' as const,
      },
      createdAt: Date.now(),
    };

    const getAll = jest.fn(() => [queuedRequest]);
    const remove = jest.fn();

    const queue = {
      getAll,
      remove,
    } as Pick<OfflineQueue, 'getAll' | 'remove'>;

    const execute = jest.fn() as MockedFunction<RequestManager['execute']>;

    execute.mockResolvedValue({});

    const requestManager = {
      execute,
    } as Pick<RequestManager, 'execute'>;

    const isOnline: MockedFunction<ConnectivityProvider['isOnline']> =
      jest.fn();

    isOnline.mockReturnValue(true);

    const subscribe: MockedFunction<ConnectivityProvider['subscribe']> =
      jest.fn();

    const connectivityProvider: ConnectivityProvider = {
      isOnline,
      subscribe,
    };

    const processor = new QueueProcessor(
      queue as OfflineQueue,
      requestManager as RequestManager,
      connectivityProvider
    );

    await processor.process();

    expect(execute).toHaveBeenCalledWith(queuedRequest.config);

    expect(remove).toHaveBeenCalledWith('queued-1');
  });

  it('should keep the request in the queue when processing fails', async () => {
    const queuedRequest = {
      id: 'queued-2',
      config: {
        url: '/users',
        method: 'GET' as const,
      },
      createdAt: Date.now(),
    };

    const getAll = jest.fn(() => [queuedRequest]);
    const remove = jest.fn();

    const queue = {
      getAll,
      remove,
    } as Pick<OfflineQueue, 'getAll' | 'remove'>;

    const execute = jest.fn() as MockedFunction<RequestManager['execute']>;

    execute.mockRejectedValue(new Error('Request failed'));

    const requestManager = {
      execute,
    } as Pick<RequestManager, 'execute'>;

    const isOnline: MockedFunction<ConnectivityProvider['isOnline']> =
      jest.fn();

    isOnline.mockReturnValue(true);

    const subscribe: MockedFunction<ConnectivityProvider['subscribe']> =
      jest.fn();

    const connectivityProvider: ConnectivityProvider = {
      isOnline,
      subscribe,
    };

    const processor = new QueueProcessor(
      queue as OfflineQueue,
      requestManager as RequestManager,
      connectivityProvider
    );

    await processor.process();

    expect(execute).toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('should not process requests when offline', async () => {
    const queuedRequest = {
      id: 'queued-3',
      config: {
        url: '/users',
        method: 'GET' as const,
      },
      createdAt: Date.now(),
    };

    const getAll = jest.fn(() => [queuedRequest]);
    const remove = jest.fn();

    const queue = {
      getAll,
      remove,
    } as Pick<OfflineQueue, 'getAll' | 'remove'>;

    const execute = jest.fn() as MockedFunction<RequestManager['execute']>;

    const requestManager = {
      execute,
    } as Pick<RequestManager, 'execute'>;

    const isOnline: MockedFunction<ConnectivityProvider['isOnline']> =
      jest.fn();

    isOnline.mockReturnValue(false);

    const subscribe: MockedFunction<ConnectivityProvider['subscribe']> =
      jest.fn();

    const connectivityProvider: ConnectivityProvider = {
      isOnline,
      subscribe,
    };

    const processor = new QueueProcessor(
      queue as OfflineQueue,
      requestManager as RequestManager,
      connectivityProvider
    );

    await processor.process();

    expect(execute).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
});

describe('RequestManager', () => {
  it('should successfully execute a request', async () => {
    const request = jest.fn() as MockedFunction<HttpTransport['request']>;

    request.mockResolvedValue({
      id: 1,
      name: 'Test',
    });

    const transport: HttpTransport = {
      request,
    };

    const retryPolicy = new RetryPolicy(retryConfig);

    const manager = new RequestManager(transport, retryPolicy);

    const result = await manager.execute({
      url: '/users/1',
      method: 'GET',
    });

    expect(result).toEqual({
      id: 1,
      name: 'Test',
    });

    expect(request).toHaveBeenCalledTimes(1);
  });

  it('should retry a failed request', async () => {
    const networkError = new NetworkError('Network failed', {
      code: 'NETWORK_ERROR',
    });

    const request = jest.fn() as MockedFunction<HttpTransport['request']>;

    request.mockRejectedValueOnce(networkError).mockResolvedValueOnce({
      success: true,
    });

    const transport: HttpTransport = {
      request,
    };

    const retryPolicy = new RetryPolicy({
      maxAttempts: 3,
      backoff: 'exponential',
      initialDelay: 0,
      maxDelay: 1000,
      jitter: false,
    });

    const manager = new RequestManager(transport, retryPolicy);

    const result = await manager.execute({
      url: '/users',
      method: 'GET',
    });

    expect(result).toEqual({
      success: true,
    });

    expect(request).toHaveBeenCalledTimes(2);
  });

  it('should never retry a cancelled request', async () => {
    const cancellationError = new NetworkError('Request cancelled', {
      code: 'CANCELLED',
    });

    const request = jest.fn() as MockedFunction<HttpTransport['request']>;

    request.mockRejectedValue(cancellationError);

    const transport: HttpTransport = {
      request,
    };

    const retryPolicy = new RetryPolicy({
      maxAttempts: 3,
      backoff: 'exponential',
      initialDelay: 0,
      maxDelay: 1000,
      jitter: false,
    });

    const manager = new RequestManager(transport, retryPolicy);

    await expect(
      manager.execute({
        url: '/users',
        method: 'GET',
      })
    ).rejects.toBe(cancellationError);

    expect(request).toHaveBeenCalledTimes(1);
  });

  it('should wait for connectivity when offline', async () => {
    const request = jest.fn() as MockedFunction<HttpTransport['request']>;

    request.mockResolvedValue({
      success: true,
    });

    const transport: HttpTransport = {
      request,
    };

    const retryPolicy = new RetryPolicy(retryConfig);

    const isOnline: MockedFunction<ConnectivityProvider['isOnline']> =
      jest.fn();

    isOnline.mockReturnValue(false);

    const subscribe: MockedFunction<ConnectivityProvider['subscribe']> =
      jest.fn((callback) => {
        setTimeout(() => {
          isOnline.mockReturnValue(true);
          callback(true);
        }, 0);

        return jest.fn();
      });

    const connectivityProvider: ConnectivityProvider = {
      isOnline,
      subscribe,
    };

    const manager = new RequestManager(
      transport,
      retryPolicy,
      connectivityProvider,
      true,
      1000
    );

    const result = await manager.execute({
      url: '/users',
      method: 'GET',
    });

    expect(result).toEqual({
      success: true,
    });

    expect(request).toHaveBeenCalledTimes(1);
  });

  it('should emit request success events', async () => {
    const request = jest.fn() as MockedFunction<HttpTransport['request']>;

    request.mockResolvedValue({
      success: true,
    });

    const transport: HttpTransport = {
      request,
    };

    const retryPolicy = new RetryPolicy(retryConfig);
    const eventEmitter = new NetworkEventEmitter();

    const manager = new RequestManager(
      transport,
      retryPolicy,
      undefined,
      false,
      30000,
      eventEmitter
    );

    await manager.execute({
      url: '/users',
      method: 'GET',
    });

    const metrics = manager.getMetrics();

    expect(metrics.length).toBeGreaterThan(0);
  });
});

describe('RequestManager events', () => {
  const collectEvents = () => {
    const events: NetworkEvent[] = [];

    const eventEmitter = new NetworkEventEmitter((event) => {
      events.push(event);
    });

    const transport = {
      request: jest.fn(),
    } as unknown as HttpTransport;

    const requestManager = new RequestManager(
      transport,
      new RetryPolicy(retryConfig),
      undefined,
      false,
      30000,
      eventEmitter
    );

    return { events, transport, requestManager };
  };

  it('emits REQUEST_START and REQUEST_SUCCESS with a generated request id', async () => {
    const { events, transport, requestManager } = collectEvents();

    (
      transport.request as jest.Mock<
        (config: RequestConfig) => Promise<unknown>
      >
    ).mockResolvedValue({
      ok: true,
    });

    const result = await requestManager.execute({
      url: '/users/1',
      method: 'GET',
    });

    expect(result).toEqual({ ok: true });

    const start = events.find((e) => e.type === 'REQUEST_START');
    const success = events.find((e) => e.type === 'REQUEST_SUCCESS');

    expect(start).toBeDefined();
    expect(success).toBeDefined();
    expect(start?.requestId).toMatch(/^request-\d+$/);
    expect(success?.requestId).toBe(start?.requestId);
  });

  it('emits REQUEST_RETRY on a retryable failure', async () => {
    const { events, transport, requestManager } = collectEvents();

    (
      transport.request as jest.Mock<
        (config: RequestConfig) => Promise<unknown>
      >
    )
      .mockRejectedValueOnce(
        new NetworkError('Network failed', { code: 'NETWORK_ERROR' })
      )
      .mockResolvedValueOnce({ ok: true });

    await requestManager.execute({ url: '/users', method: 'GET' });

    expect(events.some((e) => e.type === 'REQUEST_RETRY')).toBe(true);
    expect(events.some((e) => e.type === 'REQUEST_SUCCESS')).toBe(true);
  });

  it('emits REQUEST_CANCELLED and never retries a cancelled request', async () => {
    const { events, transport, requestManager } = collectEvents();

    (
      transport.request as jest.Mock<
        (config: RequestConfig) => Promise<unknown>
      >
    ).mockRejectedValue(
      new NetworkError('Request cancelled', { code: 'CANCELLED' })
    );

    const controller = new AbortController();

    await expect(
      requestManager.execute({
        url: '/users',
        method: 'GET',
        signal: controller.signal,
      })
    ).rejects.toThrow();

    expect(events.some((e) => e.type === 'REQUEST_CANCELLED')).toBe(true);
    expect(events.some((e) => e.type === 'REQUEST_RETRY')).toBe(false);
    expect(transport.request).toHaveBeenCalledTimes(1);
  });

  it('emits REQUEST_ERROR on a non-retryable failure', async () => {
    const { events, transport, requestManager } = collectEvents();

    (
      transport.request as jest.Mock<
        (config: RequestConfig) => Promise<unknown>
      >
    ).mockRejectedValue(
      new NetworkError('Forbidden', { code: 'HTTP_ERROR', status: 403 })
    );

    await expect(
      requestManager.execute({ url: '/users', method: 'GET' })
    ).rejects.toThrow();

    expect(events.some((e) => e.type === 'REQUEST_ERROR')).toBe(true);
    expect(transport.request).toHaveBeenCalledTimes(1);
  });
});

describe('BackoffStrategy fixed', () => {
  it('should use a constant delay for fixed backoff', () => {
    const policy = new RetryPolicy({
      maxAttempts: 5,
      backoff: 'fixed',
      initialDelay: 200,
      maxDelay: 1000,
      jitter: false,
    });

    expect(policy.getDelay(1)).toBe(200);
    expect(policy.getDelay(2)).toBe(200);
    expect(policy.getDelay(3)).toBe(200);
  });
});

describe('Request deduplication', () => {
  it('should coalesce concurrent identical GET requests', async () => {
    const transport = {
      request: jest.fn(),
    } as unknown as HttpTransport;

    (
      transport.request as jest.Mock<
        (config: RequestConfig) => Promise<unknown>
      >
    ).mockResolvedValue({
      id: 1,
    });

    const requestManager = new RequestManager(
      transport,
      new RetryPolicy(retryConfig)
    );

    const requestRegistry = new RequestRegistry();

    const client = new NetworkClient(
      { deduplication: true },
      requestManager,
      requestRegistry
    );

    const [a, b] = await Promise.all([
      client.get('/todos/1'),
      client.get('/todos/1'),
    ]);

    expect(transport.request).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
  });

  it('should not deduplicate when disabled', async () => {
    const transport = {
      request: jest.fn(),
    } as unknown as HttpTransport;

    (
      transport.request as jest.Mock<
        (config: RequestConfig) => Promise<unknown>
      >
    ).mockResolvedValue({
      id: 1,
    });

    const requestManager = new RequestManager(
      transport,
      new RetryPolicy(retryConfig)
    );

    const requestRegistry = new RequestRegistry();

    const client = new NetworkClient(
      { deduplication: false },
      requestManager,
      requestRegistry
    );

    await Promise.all([client.get('/todos/1'), client.get('/todos/1')]);

    expect(transport.request).toHaveBeenCalledTimes(2);
  });
});

describe('QueueProcessor drain on launch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.getString.mockReturnValue(undefined);
  });

  it('should process persisted requests when launched while online', async () => {
    const offlineQueue = new OfflineQueue();

    offlineQueue.add({ url: '/posts', method: 'POST' });

    const execute = jest.fn() as unknown as jest.Mock<
      (config: RequestConfig) => Promise<unknown>
    >;

    execute.mockResolvedValue({});

    const requestManager = {
      execute,
    } as unknown as RequestManager;

    const connectivityProvider: ConnectivityProvider = {
      isOnline: jest.fn(() => true),
      subscribe: jest.fn(() => jest.fn()),
    };

    const processor = new QueueProcessor(
      offlineQueue,
      requestManager,
      connectivityProvider
    );

    processor.start();

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(execute).toHaveBeenCalledTimes(1);
    expect(offlineQueue.size).toBe(0);
  });
});

describe('CancellationManager', () => {
  it('registers, cancels and unregisters controllers', () => {
    const manager = new CancellationManager();
    const controller = new AbortController();

    manager.register('r1', controller);

    expect(manager.activeCount).toBe(1);
    expect(manager.cancel('r1')).toBe(true);
    expect(controller.signal.aborted).toBe(true);
    expect(manager.activeCount).toBe(0);
    expect(manager.cancel('r1')).toBe(false);
  });

  it('cancelAll aborts every active controller', () => {
    const manager = new CancellationManager();
    const a = new AbortController();
    const b = new AbortController();

    manager.register('a', a);
    manager.register('b', b);

    expect(manager.cancelAll()).toBe(2);
    expect(a.signal.aborted).toBe(true);
    expect(b.signal.aborted).toBe(true);
    expect(manager.activeCount).toBe(0);
  });
});

describe('NetworkClient cancellation', () => {
  it('cancelAll aborts in-flight requests and emits REQUEST_CANCELLED', async () => {
    const cancellationManager = new CancellationManager();

    const events: NetworkEvent[] = [];
    const eventEmitter = new NetworkEventEmitter((e) => events.push(e));

    const transport = {
      request: jest.fn(
        (config: RequestConfig) =>
          new Promise<unknown>((_resolve, reject) => {
            config.signal?.addEventListener('abort', () => {
              reject(
                new NetworkError('Request cancelled', { code: 'CANCELLED' })
              );
            });
          })
      ),
    } as unknown as HttpTransport;

    const requestManager = new RequestManager(
      transport,
      new RetryPolicy(retryConfig),
      undefined,
      false,
      30000,
      eventEmitter,
      cancellationManager
    );

    const client = new NetworkClient(
      {},
      requestManager,
      new RequestRegistry(),
      undefined,
      undefined,
      cancellationManager
    );

    const promise = client.get('/slow');

    await new Promise((resolve) => setImmediate(resolve));

    expect(cancellationManager.activeCount).toBe(1);

    const cancelled = client.cancelAll();

    expect(cancelled).toBe(1);

    await expect(promise).rejects.toThrow();

    expect(events.some((e) => e.type === 'REQUEST_CANCELLED')).toBe(true);
  });
});
