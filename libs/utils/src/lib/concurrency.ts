/** Runs tasks with a cap on how many are in flight at once. */
export type ConcurrencyLimiter = {
  /** Runs `task` once a slot is free (first come, first served). Rejects without running when `maxQueue` tasks already wait. */
  run: <T>(task: () => Promise<T>) => Promise<T>;
  /** Tasks holding a slot right now. */
  readonly active: number;
  /** Tasks waiting for a slot. */
  readonly pending: number;
};

export type ConcurrencyLimiterOptions = {
  /** The longest a task keeps its slot, in ms; after that the slot moves on while the task carries on. */
  maxHoldMs?: number;
  /** The most tasks that may wait for a slot; a task arriving beyond it is rejected at once. */
  maxQueue?: number;
  /** What a task turned away by `maxQueue` rejects with; a plain `Error` when omitted. */
  queueFullError?: () => unknown;
};

/**
 * A FIFO semaphore: at most `max` tasks hold a slot at the same time, the
 * rest wait in order. A slot is freed when its task settles, however it
 * settles, or after `maxHoldMs` if that comes first.
 */
export function createConcurrencyLimiter(
  max: number,
  { maxHoldMs, maxQueue, queueFullError }: ConcurrencyLimiterOptions = {}
): ConcurrencyLimiter {
  const limit = Math.max(1, Math.floor(max));
  let active = 0;
  const queue: Array<() => void> = [];

  const release = () => {
    active -= 1;
    queue.shift()?.();
  };

  const acquire = () =>
    new Promise<void>((resolve, reject) => {
      if (active < limit) {
        active += 1;
        resolve();
        return;
      }
      if (maxQueue !== undefined && queue.length >= maxQueue) {
        reject(queueFullError ? queueFullError() : new Error("Too many tasks waiting for a slot"));
        return;
      }
      queue.push(() => {
        active += 1;
        resolve();
      });
    });

  const holdSlot = () => {
    let released = false;
    const releaseOnce = () => {
      if (released) return;
      released = true;
      release();
    };
    if (maxHoldMs === undefined) return releaseOnce;
    const timer = setTimeout(releaseOnce, maxHoldMs);
    (timer as { unref?: () => void }).unref?.();
    return () => {
      clearTimeout(timer);
      releaseOnce();
    };
  };

  return {
    async run(task) {
      await acquire();
      const free = holdSlot();
      try {
        return await task();
      } finally {
        free();
      }
    },
    get active() {
      return active;
    },
    get pending() {
      return queue.length;
    },
  };
}
