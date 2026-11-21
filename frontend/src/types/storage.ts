export interface BrowserStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  del(key: string): void;
}
