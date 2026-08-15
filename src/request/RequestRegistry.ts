export class RequestRegistry {
  private readonly requests = new Map<string, Promise<unknown>>();

  has(key: string): boolean {
    return this.requests.has(key);
  }

  get<T>(key: string): Promise<T> | undefined {
    return this.requests.get(key) as Promise<T> | undefined;
  }

  set<T>(key: string, promise: Promise<T>): void {
    this.requests.set(key, promise);

    promise.then(
      () => {
        this.requests.delete(key);
      },
      () => {
        this.requests.delete(key);
      }
    );
  }

  delete(key: string): void {
    this.requests.delete(key);
  }

  clear(): void {
    this.requests.clear();
  }
}
