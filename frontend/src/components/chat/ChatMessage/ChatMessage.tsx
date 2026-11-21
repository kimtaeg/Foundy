import { CallPreparation } from "@/components/chat/CallPreparation";
import { ChatActionCard } from "@/components/chat/ChatActionCard";
import { ChatProcessing } from "@/components/chat/ChatProcessing";
import { MessageCitations } from "@/components/chat/MessageCitations";
import { MessageText } from "@/components/chat/MessageText";
import { QuestionSuggestions } from "@/components/chat/QuestionSuggestions";
import { PhoneContact } from "@/components/common/PhoneContact";
import {
  type CallGuide,
  type ChatMessageModel,
  type CitationItem,
  type ConsultationCard,
} from "@/types/chat";
import type { Contact } from "@/types/contact";

export interface ChatMessageProps {
  message: ChatMessageModel;
  index: number;
  last: boolean;
  busy?: boolean;
  cards: ConsultationCard[];
  contacts: Record<string, Contact>;
  actionLabels: Record<string, string>;
  callGuides: Record<string, CallGuide>;
  memo: Record<string, string>;
}

export function ChatMessage({
  message,
  index,
  last,
  busy = false,
  cards,
  contacts,
  actionLabels,
  callGuides,
  memo,
}: ChatMessageProps) {
  if (message.role === "u")
    return (
      <article className="flex justify-end" aria-label="내 질문" data-chat-role="user">
        <div className="max-w-[90%] rounded-2xl rounded-br-md bg-neutral-100 px-4 py-3 text-sm leading-6 text-neutral-900 [overflow-wrap:anywhere]">
          <MessageText text={message.text} />
        </div>
      </article>
    );

  const call = message.call
    ? cards.find((card) => card.id === message.call)
    : undefined;
  const status =
    message.kind === "oos"
      ? { label: "확인이 필요해요", tone: "bg-neutral-100 text-neutral-600" }
      : message.kind === "grounded"
        ? { label: "점검 결과 기반", tone: "bg-neutral-100 text-foundy-primary-ink" }
        : message.kind === "change"
          ? { label: "변경 제안", tone: "bg-amber-50 text-amber-800" }
          : null;
  const citations: CitationItem[] = (message.cites || []).flatMap<CitationItem>(
    (citation) => {
      if (typeof citation !== "string")
        return [{ page: citation.p, label: citation.label }];
      const card = cards.find((item) => item.id === citation);
      return card
        ? card.evidence.slice(0, 3).map((evidence) => ({
            cardId: card.id,
            label: evidence.source.replace(/ ?\(.*?\)/g, ""),
          }))
        : [];
    },
  );

  return (
    <article className="min-w-0 space-y-3" aria-label="파운디 답변" data-chat-role="assistant">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-foundy-primary text-xs font-bold text-white" aria-hidden="true">
          f
        </span>
        <span className="text-sm font-semibold text-neutral-900">파운디</span>
        {status && (
          <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${status.tone}`}>
            {status.label}
          </span>
        )}
      </div>
      {message.processing && (
        <ChatProcessing
          processing={message.processing}
          actions={message.acts}
          messageIndex={index}
        />
      )}
      <div className="space-y-3 text-sm leading-6 text-neutral-800 [overflow-wrap:anywhere]">
        {message.text && (
          <div>
            <MessageText text={message.text} />
          </div>
        )}
        {call && callGuides[call.id] && (
          <CallPreparation
            cardId={call.id}
            guide={callGuides[call.id]}
            contact={call.contact ? contacts[call.contact] : undefined}
            memo={memo[call.id] || ""}
          />
        )}
        {(message.contacts || []).map((key, position) => (
          <PhoneContact key={`${key}-${position}`} contact={contacts[key]} />
        ))}
        <MessageCitations citations={citations} />
        {(message.acts || []).map((action, actionIndex) => (
          <ChatActionCard
            key={actionIndex}
            action={action}
            messageIndex={index}
            actionIndex={actionIndex}
            typeLabel={actionLabels[action.type]}
          />
        ))}
        {message.kind === "grounded" && (
          <p className="m-0 text-sm leading-6 text-neutral-600">
            이 가게의 점검 결과 안에서 답했어요. 최종 판단은 관할 기관에 확인하세요.
          </p>
        )}
      </div>
      {last && !!message.follow?.length && (
        <QuestionSuggestions questions={message.follow} busy={busy} />
      )}
    </article>
  );
}
