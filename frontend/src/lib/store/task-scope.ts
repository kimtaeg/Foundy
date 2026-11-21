/** Owns asynchronous work so logout/unmount cannot publish stale callbacks. */
export function createTaskScope(onChange: () => void) {
  const pending = new Set<ReturnType<typeof globalThis.setTimeout>>();
  let disposed = false;
  let generation = 0;
  const notify = () => {
    if (!disposed) onChange();
  };
  const cancelPending = () => {
    generation += 1;
    pending.forEach(globalThis.clearTimeout);
    pending.clear();
  };
  const setTimeout = (callback: () => void, delay?: number) => {
    const scheduledGeneration = generation;
    const timer = globalThis.setTimeout(() => {
      pending.delete(timer);
      if (disposed || scheduledGeneration !== generation) return;
      callback();
      notify();
    }, delay);
    pending.add(timer);
    return timer;
  };
  const clearTimeout = (timer: ReturnType<typeof globalThis.setTimeout>) => {
    globalThis.clearTimeout(timer);
    pending.delete(timer);
  };
  return {
    notify,
    cancelPending,
    setTimeout,
    clearTimeout,
    get disposed() {
      return disposed;
    },
    destroy() {
      disposed = true;
      cancelPending();
    },
  };
}
