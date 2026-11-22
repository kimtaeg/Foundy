/** Authorization 헤더가 필요해서 EventSource 대신 fetch 스트림으로 SSE를 읽는다. */
import { ApiError, API_BASE_URL, readApiError } from "@/lib/api/client";

export type SseHandler = (event: string, data: unknown) => void;

interface StreamOptions {
  method?: "GET" | "POST";
  body?: unknown;
  signal?: AbortSignal;
}

export async function readEventStream(path: string, token: string, onEvent: SseHandler, options: StreamOptions = {}): Promise<void> {
  const headers: Record<string, string> = { Accept: "text/event-stream", Authorization: `Bearer ${token}` };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers,
    method: options.method ?? "GET",
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
    cache: "no-store",
  });
  if (!response.ok) throw await readApiError(response, token);
  if (!response.body || !response.headers.get("content-type")?.includes("text/event-stream"))
    throw new ApiError(response.status, "STREAM_FAILED", "진행 상황을 받을 수 없어요.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let trailingCR = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      const chunk = trailingCR + decoder.decode(value, { stream: !done });
      trailingCR = !done && chunk.endsWith("\r") ? "\r" : "";
      buffer += chunk.slice(0, chunk.length - trailingCR.length).replace(/\r\n?/g, "\n");
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        dispatch(buffer.slice(0, boundary), onEvent);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf("\n\n");
      }
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
}

function dispatch(block: string, onEvent: SseHandler) {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith(":")) continue; // keep-alive 주석
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }
  if (!dataLines.length) return;
  let data: unknown;
  try {
    data = JSON.parse(dataLines.join("\n"));
  } catch {
    return;
  }
  onEvent(event, data);
}
