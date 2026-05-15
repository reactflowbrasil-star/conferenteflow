type StorageArea = "local" | "session";

function getStorage(area: StorageArea): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    const storage = area === "local" ? window.localStorage : window.sessionStorage;
    const testKey = "__conferflow_storage_test__";
    storage.setItem(testKey, "1");
    storage.removeItem(testKey);
    return storage;
  } catch {
    return null;
  }
}

export function readStorage(area: StorageArea, key: string): string | null {
  try {
    return getStorage(area)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeStorage(area: StorageArea, key: string, value: string): void {
  try {
    getStorage(area)?.setItem(key, value);
  } catch {
    /* storage can be unavailable in private or restricted contexts */
  }
}

export function removeStorage(area: StorageArea, key: string): void {
  try {
    getStorage(area)?.removeItem(key);
  } catch {
    /* noop */
  }
}

export function createSafeStorage(area: StorageArea) {
  const storage = getStorage(area);
  if (!storage) return undefined;
  return {
    getItem: (key: string) => readStorage(area, key),
    setItem: (key: string, value: string) => writeStorage(area, key, value),
    removeItem: (key: string) => removeStorage(area, key),
  };
}
