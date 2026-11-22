"use client";

import { createChatApi } from "@/lib/api/chat";
import { ApiError } from "@/lib/api/client";
import type { ApiSession } from "@/lib/api/foundy-api";
import { runChatTurn, type ChatQuestion } from "@/lib/chat/run-turn";
import { toChatMessage } from "@/lib/chat/server-message";
import type { ChatLaunch, ChatMessageModel, ChatProcessing, ChatViewData } from "@/types/chat";
import type { ViewEventType } from "@/types/events";
import { useCallback, useEffect, useMemo, useRef, useState, type SyntheticEvent } from "react";

interface History {
  sessionId: string | null;
  messages: ChatMessageModel[];
}

async function readHistory(api: ReturnType<typeof createChatApi>, storeId: string): Promise<History> {
  const { items, messages } = await api.list(storeId, true);
  const sessionId = items[0]?.session_id;
  if (!sessionId) return { sessionId: null, messages: [] };
  const history = messages ?? (await api.messages(sessionId)).items;
  return { sessionId, messages: history.map((message) => toChatMessage(message)) };
}

/** 화면이 알고 있는 마지막 서버 메시지 id. 다른 기기에서 대화가 늘었는지 비교하는 데 쓴다 */
function serverTail(messages: ChatMessageModel[]) {
  return messages.findLast((message) => message.id)?.id;
}

export function useServerChat(
  { token, storeId }: ApiSession & { storeId: string },
  open: boolean,
  storeName: string,
  launch: ChatLaunch | null,
) {
  const api = useMemo(() => createChatApi(token), [token]);
  const [history, setHistory] = useState<History | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ processing: ChatProcessing; partial: string } | null>(null);
  const [dismissedLaunch, setDismissedLaunch] = useState<number>();
  const historyRequest = useRef<Promise<History> | null>(null);
  const turn = useRef<AbortController | null>(null);
  const consumedLaunch = useRef<number | undefined>(undefined);
  const retryable = useRef(new Map<ChatProcessing, ChatQuestion>());
  const turnCount = useRef(0);
  const refreshing = useRef(false);
  const wasOpen = useRef(open);
  const focus = dismissedLaunch === launch?.id ? undefined : launch?.focus;

  useEffect(() => {
    if (!open || history || error) return;
    let active = true;
    historyRequest.current ??= readHistory(api, storeId);
    const request = historyRequest.current;
    void request.then((result) => {
      if (active) setHistory(result);
    }, (error: unknown) => {
      if (historyRequest.current === request) historyRequest.current = null;
      if (active) {
        setError(error instanceof ApiError && error.message
          ? error.message
          : "상담 기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
    });
    return () => { active = false; };
  }, [api, storeId, open, history, error]);

  // 같은 계정을 다른 기기·탭에서 쓰면 서버 기록이 늘어난다. 다시 열거나 탭이 다시 보일 때 서버 기록을 읽고,
  // 화면이 아는 마지막 서버 메시지와 다를 때만 바꾼다 (같으면 '다시 요청' 같은 화면 상태를 그대로 둔다).
  const refresh = useCallback(() => {
    if (!history || turn.current || refreshing.current) return;
    const started = turnCount.current;
    refreshing.current = true;
    void readHistory(api, storeId).then((latest) => {
      if (turn.current || turnCount.current !== started) return; // 그사이 질문을 보냈으면 이 결과는 버린다
      setHistory((current) => (current && serverTail(current.messages) !== serverTail(latest.messages) ? latest : current));
    }, () => {
      // 다시 읽기에 실패하면 지금 보이는 기록을 그대로 둔다
    }).finally(() => {
      refreshing.current = false;
    });
  }, [api, storeId, history]);

  useEffect(() => {
    const opened = open && !wasOpen.current;
    wasOpen.current = open;
    if (opened && history) refresh();
  }, [open, history, refresh]);

  useEffect(() => {
    if (!open) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [open, refresh]);

  useEffect(() => () => {
    const current = turn.current;
    turn.current = null;
    current?.abort();
  }, []);

  const send = useCallback((question: ChatQuestion) => {
    const text = question.text.trim().slice(0, 300);
    if (!text || !history || turn.current) return false;
    const controller = new AbortController();
    turn.current = controller;
    turnCount.current += 1;
    setDraft("");
    setBusy(true);
    setHistory((current) => current && { ...current, messages: [...current.messages, { role: "u", text }] });

    void runChatTurn(api, { sessionId: history.sessionId, storeId, question: { ...question, text }, signal: controller.signal }, {
      onSession(id) {
        if (turn.current === controller) setHistory((current) => current && { ...current, sessionId: id });
      },
      onProgress(processing, partial) {
        if (turn.current === controller) setProgress({ processing, partial });
      },
      onFinish(message) {
        if (turn.current !== controller) return;
        const processing = message.processing;
        if (processing && (processing.status === "error" || processing.status === "canceled")) {
          retryable.current.set(processing, { ...question, text });
        }
        setProgress(null);
        setHistory((current) => current && { ...current, messages: [...current.messages, message] });
      },
    }).finally(() => {
      // The server writes history before closing the stream.
      if (turn.current !== controller) return;
      turn.current = null;
      setBusy(false);
    });
    return true;
  }, [api, history, storeId]);

  useEffect(() => {
    if (!open || busy || !launch?.question || consumedLaunch.current === launch.id) return;
    if (send({ text: launch.question, focus })) consumedLaunch.current = launch.id;
  }, [open, busy, launch, focus, send]);

  const handleEvent = (type: ViewEventType, event: SyntheticEvent<HTMLElement>) => {
    const target = event.target;
    if (!(target instanceof Element)) return false;
    if (type === "input" && target instanceof HTMLTextAreaElement && target.id === "chatIn") {
      setDraft(target.value);
      return true;
    }
    if (type === "submit" && target instanceof HTMLFormElement && target.id === "nxChat") {
      event.preventDefault();
      send({ text: target.querySelector<HTMLTextAreaElement>("#chatIn")?.value ?? "", focus });
      return true;
    }
    if (type !== "click") return false;
    const button = target.closest<HTMLElement>("[data-nx]");
    switch (button?.dataset.nx) {
      case "cask":
        send({ text: button.dataset.q ?? "", focus });
        break;
      case "cstop":
        turn.current?.abort();
        break;
      case "cretry": {
        const failed = history?.messages[Number(button.dataset.m)]?.processing;
        const question = failed && retryable.current.get(failed);
        if (question) send(question);
        break;
      }
      case "cfocus":
        setDismissedLaunch(launch?.id);
        break;
      default:
        return false;
    }
    return true;
  };

  const data: ChatViewData | undefined = history ? {
    storeName,
    undecided: false,
    focus,
    messages: progress?.partial
      ? [...history.messages, { role: "a", text: progress.partial, processing: progress.processing }]
      : history.messages,
    request: progress && !progress.partial ? progress.processing : null,
    busy,
    draft,
    memo: {},
    cards: [],
    contacts: {},
    actionLabels: {},
    callGuides: {},
  } : undefined;
  return { data, error, loading: !history && !error, retry: () => setError(null), handleEvent };
}
