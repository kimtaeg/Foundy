/** Authorization 헤더가 필요해서 EventSource 대신 fetch 스트림으로 SSE를 읽는다. */
import { ApiError, API_BASE_URL } from "@/lib/api/client";

export type SseHandler = (event: string, data: unknown) => void;

export async function readEventStream(path: string, token: string, onEvent: SseHandler): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Accept: "text/event-stream", Authorization: `Bearer ${token}` },
  });
  if (!response.ok || !response.body) {
    throw new ApiError(response.status, "STREAM_FAILED", "진행 상황을 받을 수 없어요.");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      dispatch(buffer.slice(0, boundary), onEvent);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");
    }
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
  try {
    onEvent(event, JSON.parse(dataLines.join("\n")));
  } catch {
    // 해석할 수 없는 조각은 건너뛴다.
  }
}
