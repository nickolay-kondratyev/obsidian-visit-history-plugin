/** Test-only promise handle resolved from the outside — orders async steps without sleeps. */
export class Deferred<T = void> {
  readonly promise: Promise<T>;
  private resolveFn: (value: T) => void = () => undefined;

  constructor() {
    this.promise = new Promise<T>((resolve) => {
      this.resolveFn = resolve;
    });
  }

  resolve(value: T): void {
    this.resolveFn(value);
  }
}
