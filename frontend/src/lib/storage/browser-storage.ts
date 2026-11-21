import type { BrowserStorage } from "@/types/storage";

/** Memory fallback keeps the demo usable when browser storage is unavailable. */
export function createBrowserStorage(): BrowserStorage {
  const memory: Record<string, string> = {};
  return {
    get(key) {
      try {
        const value = localStorage.getItem(key);
        if (value !== null) return value;
      } catch {
        /* Browser storage can be disabled. */
      }
      return memory[key] ?? null;
    },
    set(key, value) {
      memory[key] = value;
      try {
        localStorage.setItem(key, value);
      } catch {
        /* Keep the memory copy. */
      }
    },
    del(key) {
      delete memory[key];
      try {
        localStorage.removeItem(key);
      } catch {
        /* No persistent copy available. */
      }
    },
  };
}
