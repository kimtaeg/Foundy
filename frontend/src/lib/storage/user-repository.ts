import { type BrowserStorage } from "@/types/storage";

/** Restores only compatible persisted values and namespaces records per account. */
export function createUserRepository(
  storage: BrowserStorage,
  getUserId: () => string | null,
) {
  const take = (k: any, f: any) => {
    try {
      const v: any = storage.get("foundy-v5-" + getUserId() + "-" + k);
      if (v == null) return f;
      const value: any = JSON.parse(v);
      if (Array.isArray(f)) {
        if (!Array.isArray(value)) return f;
        if (k === "candx")
          return value.filter((item: unknown) => typeof item === "string");
        if (k === "nextlog")
          return value.filter(
            (item: any) =>
              item && typeof item === "object" && typeof item.id === "string",
          );
        if (k === "chglog")
          return value.filter(
            (item: any) =>
              item && typeof item === "object" && Array.isArray(item.lines),
          );
        return value;
      }
      if (f === null)
        return value && typeof value === "object" && !Array.isArray(value)
          ? value
          : f;
      if (typeof f === "object") {
        if (!value || typeof value !== "object" || Array.isArray(value))
          return f;
        const restored: any = { ...f, ...value };
        for (const field of Object.keys(f)) {
          // Nullable store fields stay nullable even when the demo default is a number.
          if (k === "store" && (field === "funds" || field === "birth")) {
            if (restored[field] !== null &&
                (typeof restored[field] !== "number" || !Number.isFinite(restored[field])))
              restored[field] = f[field];
            continue;
          }
          if (f[field] !== null && typeof restored[field] !== typeof f[field])
            restored[field] = f[field];
        }
        return restored;
      }
      return typeof value === typeof f ? value : f;
    } catch {
      return f;
    }
  };
  const put = (k: any, v: any) => {
    storage.set("foundy-v5-" + getUserId() + "-" + k, JSON.stringify(v));
  };
  return { take, put };
}
