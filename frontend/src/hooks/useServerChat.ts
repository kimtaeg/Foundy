"use client";
import { createChatApi, type ApiChatMessage } from "@/lib/api/chat";
import type { ApiSession } from "@/lib/api/foundy-api";
import { runChatTurn } from "@/lib/chat/run-turn";
import { toChatMessage } from "@/lib/chat/server-message";
import type { ChatMessageModel, ChatProcessing, ChatViewData } from "@/types/chat";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 서버 AI 상담. 상담방은 가게마다 가장 최근 것을 이어 쓰고, 없으면 첫 질문 때 만든다.
 * 답은 SSE로 받아 도구 실행 단계(법령 검색 등)와 답변 글자를 차례로 보여 준다.
 */
export function useServerChat(session: ApiSession | null, open: boolean, storeName: string) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageModel[]>([]);
  const [request, setRequest] = useState<ChatProcessing | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const lastQuestion = useRef("");
  const token = session?.token ?? null;
  const storeId = session?.storeId ?? null;

  // 가게가 바뀌면 처음부터 다시 불러온다
  useEffect(() => {
    setSessionId(null);
    setMessages([]);
    setLoaded(false);
  }, [token, storeId]);

  // 처음 열 때 가장 최근 상담방의 대화를 불러온다
  useEffect(() => {
    if (!open || loaded || !token || !storeId) return;
    let current = true;
    const api = createChatApi(token);
    api
      .list(storeId)
      .then(async ({ items }) => {
        const latest = items[0];
        if (!latest) return;
        const body = await api.messages(latest.session_id);
        if (!current) return;
        setSessionId(latest.session_id);
        setMessages(body.items.map((m: ApiChatMessage) => toChatMessage(m)));
      })
      .catch(() => undefined)
      .finally(() => {
        if (current) setLoaded(true);
      });
    return () => {
      current = false;
    };
  }, [open, loaded, token, storeId]);

  const send = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text || busy || !token || !storeId) return;
      lastQuestion.current = text;
      const controller = new AbortController();
      abort.current = controller;
      setBusy(true);
      setMessages((list) => [...list, { role: "u", text }]);
      // 진행 중인 답변(마지막 a 메시지의 처리 상태가 processing)은 새 글자나 최종 답으로 바꾼다
      const withoutPartial = (list: ChatMessageModel[]) =>
        list.at(-1)?.role === "a" && list.at(-1)?.processing?.status === "processing" ? list.slice(0, -1) : list;
      await runChatTurn(createChatApi(token), { sessionId, storeId, text, signal: controller.signal }, {
        onSession: setSessionId,
        onRequest: setRequest,
        onPartial: (message) => setMessages((list) => (message ? [...withoutPartial(list), message] : withoutPartial(list))),
        onFinish: (message) => {
          // 서버는 답을 보낸 뒤 기록을 저장하느라 스트림을 조금 늦게 닫는다. 답이 오면 바로 다음 질문을 받을 수 있게 한다
          setMessages((list) => [...withoutPartial(list), message]);
          setBusy(false);
        },
      });
      // 그사이 다음 질문을 시작했으면 그 질문의 상태를 건드리지 않는다
      if (abort.current === controller) {
        abort.current = null;
        setBusy(false);
      }
    },
    [busy, token, storeId, sessionId],
  );

  /** 상담 화면의 입력·버튼 이벤트. 처리했으면 true */
  const handleEvent = useCallback(
    (type: string, event: { target: EventTarget; preventDefault(): void }): boolean => {
      const target = event.target as HTMLElement;
      if (type === "submit" && (target as HTMLFormElement).id === "nxChat") {
        event.preventDefault();
        const input = target.querySelector<HTMLTextAreaElement>("#chatIn");
        const value = input?.value ?? "";
        if (input) input.value = "";
        void send(value);
        return true;
      }
      if (type !== "click") return false;
      const button = target.closest?.("[data-nx]") as HTMLElement | null;
      const action = button?.dataset.nx;
      if (action === "cask") {
        void send(button?.dataset.q ?? "");
        return true;
      }
      if (action === "cstop") {
        abort.current?.abort();
        return true;
      }
      if (action === "cretry") {
        void send(lastQuestion.current);
        return true;
      }
      return false;
    },
    [send],
  );

  const data: ChatViewData = {
    storeName,
    undecided: false,
    messages,
    busy,
    request,
    draft: "",
    memo: {},
    cards: [],
    contacts: {},
    actionLabels: {},
    callGuides: {},
  };
  return { data, loading: open && !loaded, handleEvent };
}
