import type { Contact } from "./contact";
export interface ConsultationCard {
  id: string;
  base: string;
  title: string;
  check: string;
  contact?: string;
  options: unknown[];
  evidence: { source: string }[];
}
export interface ChatAction {
  type: string;
  label: string;
  payload: { p?: string; focus?: string };
  summary: string[];
  state?: string;
  result?: string[];
}
export type ChatCitation = string | { p?: string; label: string; url?: string; focus?: string };
export interface ChatFocus {
  id: string;
  title: string;
  verdict: string;
  verdictLabel: string;
}
export interface ChatLaunch {
  id: number;
  question?: string;
  focus?: ChatFocus;
}
export interface ChatProcessingStep {
  id: string;
  label: string;
  detail?: string;
}
export interface ChatProcessing {
  status: "processing" | "completed" | "canceled" | "error";
  question: string;
  focus: string | null;
  startedAt: number;
  finishedAt?: number;
  steps: ChatProcessingStep[];
}
export interface ChatMessageModel {
  role: string;
  kind?: string;
  text: string;
  call?: string;
  contacts?: string[];
  cites?: ChatCitation[];
  acts?: ChatAction[];
  follow?: string[];
  processing?: ChatProcessing;
}
export interface ChatState {
  draft: string;
  focus: string | null;
  msgs: ChatMessageModel[];
  busy: boolean;
  memo: Record<string, string>;
  request: ChatProcessing | null;
}
export interface CallGuide {
  who: string;
  steps: string[];
  qs: string[];
}
/** Serializable chat presentation data; commands are supplied by the view's caller. */
export interface ChatViewData {
  storeName: string;
  undecided: boolean;
  focus?: Omit<ChatFocus, "id">;
  messages: ChatMessageModel[];
  busy: boolean;
  request: ChatProcessing | null;
  draft: string;
  memo: Record<string, string>;
  cards: ConsultationCard[];
  contacts: Record<string, Contact>;
  actionLabels: Record<string, string>;
  callGuides: Record<string, CallGuide>;
}
export interface ChatContext {
  S: { location: string };
  CH: ChatState;
  buildCards: () => ConsultationCard[];
  eff: () => { name: string };
  cardShort: (card: ConsultationCard) => string;
  VL: Record<string, string>;
  ev: (card: ConsultationCard) => string;
  suggestions: () => string[];
  callSteps: (card: ConsultationCard) => CallGuide;
  CONTACT: Record<string, Contact>;
  ACTLBL: Record<string, string>;
}
export interface FocusOption {
  id: string;
  label: string;
  verdict: string;
}
export interface CitationItem {
  label: string;
  cardId?: string;
  page?: string;
  focus?: string;
  url?: string;
}
