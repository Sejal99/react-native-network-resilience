# react-native-network-resilience

A React Native networking layer that makes API requests resilient to transient failures, flaky connectivity, timeouts, and duplicate requests.

It provides automatic **retries with backoff**, **timeouts**, **request deduplication**, an **offline queue** (persisted with MMKV), **connectivity-aware waiting**, **cancellation** via `AbortController`, and a unified **event/metrics** stream.

## Features

- 🔁 Automatic retry with fixed or exponential backoff (with optional jitter)
- ⏱ Request timeouts (via `AbortController`)
- 🔂 Request deduplication (coalesces identical in-flight GETs)
- 📥 Offline queue for writes (persisted across app restarts)
- 📡 Connectivity-aware waiting (holds requests until the network returns)
- 🚫 First-class cancellation (`AbortController`/`AbortSignal`)
- 📊 Event emitter + metrics collector (`REQUEST_START`, `REQUEST_SUCCESS`, `REQUEST_RETRY`, `REQUEST_ERROR`, `REQUEST_CANCELLED`)
- 📱 iOS & Android (New Architecture / TurboModules)

## Installation

```sh
npm install react-native-network-resilience
# or
yarn add react-native-network-resilience
```

This library depends on:

- [`@react-native-community/netinfo`](https://github.com/react-native-netinfo/react-native-netinfo) (connectivity detection)
- [`react-native-mmkv`](https://github.com/mrousavy/react-native-mmkv) (offline-queue persistence)

Both ship native code. With the New Architecture, React Native auto-links them, so **no manual native setup is required**. If you are on an older RN version or see a missing native module, run:

```sh
# iOS
cd ios && pod install
```

## Basic usage

```ts
import { createNetworkClient } from 'react-native-network-resilience';

const client = createNetworkClient({
  baseURL: 'https://api.example.com',
  timeout: 10000,
  deduplication: true,
  waitForConnectivity: true,
});

const user = await client.get<User>('/users/1');
const created = await client.post<User>('/users', { name: 'Ada' });
```

## Configuration

`createNetworkClient(config?: NetworkClientConfig)` accepts:

| Option                | Type                        | Default                              | Description                                                                 |
| --------------------- | --------------------------- | ------------------------------------ | --------------------------------------------------------------------------- |
| `baseURL`             | `string`                    | —                                    | Prefix added to relative request URLs.                                      |
| `timeout`             | `number` (ms)               | —                                    | Default per-request timeout.                                                |
| `retry`               | `Partial<RetryConfig>`      | see [Retry](#retry-configuration)    | Retry behaviour.                                                            |
| `deduplication`       | `boolean`                   | `false`                              | Coalesce identical in-flight `GET` requests.                                |
| `waitForConnectivity` | `boolean`                   | `false`                              | Hold requests while offline and resume when connectivity returns.           |
| `connectivityTimeout` | `number` (ms)               | `30000`                              | Max time to wait for connectivity before rejecting with `NETWORK_UNAVAILABLE`. |
| `connectivityProvider`| `ConnectivityProvider`      | `NetInfoConnectivityProvider`        | Override the connectivity source (e.g. for tests).                          |
| `onEvent`             | `(event: NetworkEvent) => void` | —                                | Global listener for all request lifecycle events.                           |

## Retry configuration

```ts
interface RetryConfig {
  maxAttempts: number;          // total attempts before giving up
  backoff: 'fixed' | 'exponential';
  initialDelay: number;         // ms
  maxDelay: number;             // ms (cap)
  jitter: boolean;              // randomize delay in [0, delay]
}
```

Default retry config:

```ts
{
  maxAttempts: 3,
  backoff: 'exponential',
  initialDelay: 1000,
  maxDelay: 10000,
  jitter: true,
}
```

**Retryable errors:** timeouts (`TIMEOUT`), network failures (`NETWORK_ERROR`), and HTTP statuses `408`, `429`, `500`, `502`, `503`, `504` (`HTTP_ERROR`).

**Never retried:** `CANCELLED` and any non-`NetworkError`. When retries are exhausted, the original error is re-thrown.

```ts
const client = createNetworkClient({
  retry: {
    maxAttempts: 5,
    backoff: 'exponential',
    initialDelay: 500,
    maxDelay: 8000,
    jitter: false,
  },
});
```

## Timeout

Set a default timeout in the client config, or per request:

```ts
await client.get('/slow', { timeout: 3000 });
```

A timeout aborts the underlying `fetch` and surfaces as a `NetworkError` with `code: 'TIMEOUT'`, which is retried according to the retry policy.

## Deduplication

When `deduplication: true`, identical in-flight `GET` requests (same method + URL + body) are coalesced into a single network call. Callers receive the same promise, so duplicate requests never hit the network twice while one is pending.

```ts
const client = createNetworkClient({ deduplication: true });

// Only one network request is made:
const [a, b] = await Promise.all([
  client.get('/todos/1'),
  client.get('/todos/1'),
]);
```

## Offline queue

When the device is offline and `waitForConnectivity` is **not** enabled (or the request is a write), non-`GET` requests are automatically queued and persisted to disk (MMKV). The queue is drained automatically when connectivity is restored — including requests that were queued before the app was restarted.

```ts
// While offline, this is queued and throws "Request queued because device is offline".
await client.post('/posts', { title: 'Saved later' });
// Once back online, QueueProcessor sends it and removes it from the queue.
```

> Note: only non-`GET` requests are queued (GET responses are not side-effecting and are not persisted).

## Connectivity waiting

With `waitForConnectivity: true`, a request that starts while offline will wait (instead of failing) until connectivity returns, then proceed. `connectivityTimeout` bounds the wait.

```ts
const client = createNetworkClient({ waitForConnectivity: true });

await client.get('/users/1'); // waits for the network, then runs
```

## Cancellation

Every request accepts an `AbortSignal`. Cancelling a request throws a `NetworkError` with `code: 'CANCELLED'`, which is **never retried**, and emits a `REQUEST_CANCELLED` event.

```ts
const controller = new AbortController();

const promise = client.get('/report', { signal: controller.signal });

// later
controller.abort();

try {
  await promise;
} catch (err) {
  if (err instanceof NetworkError && err.code === 'CANCELLED') {
    // handled
  }
}
```

## Events & metrics

Pass `onEvent` to observe the full lifecycle, or call `client.getMetrics()` to read collected metrics.

```ts
type NetworkEvent =
  | { type: 'REQUEST_START'; requestId: string; url: string; method: string }
  | { type: 'REQUEST_RETRY'; requestId: string; url: string; method: string; attempt: number; delay: number }
  | { type: 'REQUEST_SUCCESS'; requestId: string; url: string; method: string; duration: number }
  | { type: 'REQUEST_ERROR'; requestId: string; url: string; method: string; duration: number; error: unknown }
  | { type: 'REQUEST_CANCELLED'; requestId: string; url: string; method: string; duration: number };
```

```ts
const client = createNetworkClient({
  onEvent: (event) => console.log('[network]', event.type, event.requestId),
});

// later
const metrics = client.getMetrics();
// => RequestMetrics[] { requestId, duration, attempts, retries, success }
```

## API

```ts
createNetworkClient(config?: NetworkClientConfig): NetworkClient

class NetworkClient {
  get<T>(url, options?): Promise<T>
  post<T>(url, body?, options?): Promise<T>
  put<T>(url, body?, options?): Promise<T>
  patch<T>(url, body?, options?): Promise<T>
  delete<T>(url, options?): Promise<T>
  getMetrics(): RequestMetrics[]
}

class NetworkError extends Error {
  code: 'TIMEOUT' | 'NETWORK_ERROR' | 'HTTP_ERROR' | 'CANCELLED' | 'MAX_RETRIES_EXCEEDED' | 'NETWORK_UNAVAILABLE'
  status?: number
  url?: string
  attempt?: number
}
```

## Supported platforms

- iOS (New Architecture)
- Android (New Architecture)

## Example

A runnable example app lives in [`example/`](./example). It demonstrates success, retry, cancellation, deduplication, offline queue, connectivity status, events, and metrics.

```sh
yarn example ios
# or
yarn example android
```

## License

MIT
