import { useSyncExternalStore } from "react";

/**
 * In-memory cache of the last data each screen loaded, keyed by user. Screens
 * show it straight away when revisited and refresh in the background, instead
 * of replacing the page with a loader.
 */
const cache = new Map<string, unknown>();

export function readCache<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

export function writeCache<T>(key: string, value: T): void {
  cache.set(key, value);
}

/** Drop everything cached, e.g. when the signed-in user changes. */
export function clearCache(): void {
  cache.clear();
}

// Count of loads in flight, shown as a thin progress bar under the header.
let busyCount = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export function trackBusy<T>(work: Promise<T>): Promise<T> {
  busyCount += 1;
  emit();
  return work.finally(() => {
    busyCount -= 1;
    emit();
  });
}

export function useBusy(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => busyCount > 0,
  );
}
