import NetworkResilience from './NativeNetworkResilience';

export function multiply(a: number, b: number): number {
  return NetworkResilience.multiply(a, b);
}
