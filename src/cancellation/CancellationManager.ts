export class CancellationManager {
  private controllers = new Map<string, AbortController>();

  register(requestId: string, controller: AbortController): void {
    this.controllers.set(requestId, controller);
  }

  unregister(requestId: string): void {
    this.controllers.delete(requestId);
  }

  cancel(requestId: string): boolean {
    const controller = this.controllers.get(requestId);

    if (!controller) {
      return false;
    }

    controller.abort();
    this.controllers.delete(requestId);

    return true;
  }

  cancelAll(): number {
    let count = 0;

    for (const controller of this.controllers.values()) {
      controller.abort();
      count++;
    }

    this.controllers.clear();

    return count;
  }

  get activeCount(): number {
    return this.controllers.size;
  }
}
