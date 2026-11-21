/** 백엔드 API 호출. 주소는 NEXT_PUBLIC_API_BASE_URL, 토큰은 예시 계정 세션에서 읽는다. */

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");

/** 주소가 설정되어 있을 때만 API를 쓴다. 없으면 기존 로컬 데모로 동작한다. */
export const apiEnabled = () => API_BASE_URL.length > 0;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /** 응답 error 객체 전체 (예: 주소 후보 candidates) */
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.");
  }
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = data?.error ?? {};
    throw new ApiError(
      response.status,
      error.code ?? "HTTP_ERROR",
      error.message ?? "요청을 처리하지 못했어요.",
      error,
    );
  }
  return data as T;
}
