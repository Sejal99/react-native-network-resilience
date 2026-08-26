import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { MockedFunction } from 'jest-mock';

import { RetryPolicy } from '../retry/RetryPolicy';
import { NetworkError } from '../errors/NetworkError';
import { OfflineQueue } from '../queue/OfflineQueue';
import { QueueProcessor } from '../queue/QueueProcessor';
import { RequestManager } from '../request/RequestManager';
import { NetworkEventEmitter } from '../events/NetworkEventEmitter';

import type { ConnectivityProvider } from '../connectivity/ConnectivityProvider';
import type { HttpTransport } from '../transport/HttpTransport';
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
