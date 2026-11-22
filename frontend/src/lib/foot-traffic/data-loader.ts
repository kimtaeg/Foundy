import type { PopFile, Quality } from "@/types/foot-traffic";

export const DATA_ROOT = "/data/foot-traffic";

export async function fetchData<T>(relativePath: string): Promise<T> {
  const response = await fetch(`${DATA_ROOT}/${relativePath}`);
  if (!response.ok) throw new Error(`생활인구 데이터를 불러오지 못했어요. (${response.status})`);
  return response.json() as Promise<T>;
}

const populationCache = new Map<string, Promise<PopFile>>();

async function fetchPopulation(name: string): Promise<PopFile> {
  const data = await fetchData<Partial<PopFile> | null>(`pop-${name}.json`);
  const values = data?.values;
  if (!values || typeof values !== "object" || Array.isArray(values)
    || Object.values(values).some((hours) => !Array.isArray(hours))) {
    throw new Error("생활인구 데이터 형식이 올바르지 않아요.");
  }
  return data as PopFile;
}

export function loadPop(name: string): Promise<PopFile> {
  const cached = populationCache.get(name);
  if (cached) return cached;
  const request = fetchPopulation(name).catch((error: unknown) => {
    populationCache.delete(name);
    throw error;
  });
  populationCache.set(name, request);
  return request;
}

export async function loadQuality(): Promise<Quality | null> {
  const response = await fetch(`${DATA_ROOT}/quality.json`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`데이터 기준 정보를 불러오지 못했어요. (${response.status})`);
  return response.json() as Promise<Quality>;
}
