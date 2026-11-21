/** API 응답 묶음 → 기존 화면 계산 계층(*Context)의 데이터 부분.
 *
 * 화면 상태(필터·보기·달력 위치)는 로컬 엔진 값을 그대로 쓰고, 가게·카드·할 일·알림만 API 값으로 바꾼다.
 * 판정·자동 체크·다음 할 일은 백엔드가 계산한 값을 그대로 보여 준다 (프론트에서 다시 계산하지 않는다).
 */
import { CATCOLOR, GROUPS } from "@/data/checklist";
import { D, dday, dday as dday_, diffDays, iso, realToday } from "@/lib/date";
import type {
  ApiBundle,
  ApiChecklistItem,
  ApiContact,
  ApiDocumentRequirement,
  ApiEvidence,
  ApiLawBasis,
  ApiOption,
  ApiReportItem,
} from "@/lib/api/types";
import type { ChecklistTask, CalendarEvent, TaskLawBasis } from "@/types/checklist";
import type { Contact } from "@/types/contact";
import type { DocumentViewData, ManagedDocsData, ManagedDocument, ManagedDocumentSection } from "@/types/documents";
import type { EvidenceItemData, NextStep, ReportAction, ReportCardData, ReportOption, ReportState } from "@/types/report";
import type { NotificationSummary } from "@/types/notifications";
import type { Store } from "@/types/store";

const ALERT_LABEL: Record<string, string> = {
  decision: "결정 필요",
  next: "다음 할 일",
  deadline: "마감 임박",
  change: "변경 감지",
  grant: "지원사업",
};

const NEXT_CTA: Record<string, string> = {
  report: "카드 열기",
  checklist: "체크리스트 열기",
  docs: "서류함 열기",
};

function toContact(contact: ApiContact): Contact {
  return { name: contact.agency, phone: contact.phone, ex: Boolean(contact.is_example) };
}

function toAction(action: ApiReportItem["user_action"]): ReportAction | null {
  if (!action) return null;
  return { type: action.type, text: action.text, min: action.est_minutes ?? 0 };
}

function optionChanges(option: ApiOption): string[] {
  const lines: string[] = [];
  const answers = (option.apply?.payload as { answers?: Record<string, unknown> } | undefined)?.answers;
  if (answers && "sells_alcohol" in answers)
    lines.push(answers.sells_alcohol ? "주류 판매: 아니요 → 예" : "주류 판매: 예 → 아니요 (업종은 규칙으로 다시 정해요)");
  const name = (option.apply?.payload as { name?: string } | undefined)?.name;
  if (name) lines.push(`가게 이름: “${name}”(으)로 변경`);
  if (option.apply?.adds_checklist?.length) lines.push("체크리스트에 이 선택으로 생기는 할 일이 추가돼요");
  if (option.apply?.needs_reanalyze) lines.push("바뀐 조건으로 관련 점검을 다시 실행해요");
  return lines;
}

function toOption(option: ApiOption): ReportOption {
  return {
    id: option.option_id,
    label: option.label,
    summary: option.summary,
    time: [option.time?.text ?? "확인 필요", option.time?.basis ?? null],
    cost: [option.cost?.text ?? "확인 필요", option.cost?.basis ?? null],
    fx: { changes: optionChanges(option) },
  };
}

function toCard(item: ApiReportItem): ReportCardData {
  return {
    id: item.item_id,
    check: item.check_id,
    stage: item.stage,
    contact: item.contact ? item.item_id : undefined,
    base: item.verdict,
    by: item.decided_by,
    title: item.chosen_option && item.resolved_title ? item.resolved_title : item.title,
    reason: item.reason ?? "",
    consequence: item.consequence ?? "",
    options: item.options.map(toOption),
    rec: item.recommendation ? { id: item.recommendation.option_id, reason: item.recommendation.reason } : null,
    action: toAction(item.user_action),
  };
}

export function toEvidence(evidence: ApiEvidence): EvidenceItemData {
  // 예시 자료 여부는 근거 창이 "모의 응답" 표시로 따로 보여 준다.
  const mock = evidence.from_cache && !evidence.from_mock ? " (저장된 조회 결과)" : "";
  const value =
    evidence.type === "law"
      ? [evidence.law_name, evidence.article, evidence.text].filter(Boolean).join(" · ")
      : evidence.value ?? "";
  return {
    source: evidence.source + mock,
    value,
    kind: evidence.type,
    url: evidence.url ?? undefined,
    mock: Boolean(evidence.from_mock),
  };
}

function toLawBasis(basis: ApiLawBasis | null | undefined): TaskLawBasis | null {
  if (!basis?.law_name) return null;
  return { label: [basis.law_name, basis.article].filter(Boolean).join(" "), url: basis.url ?? undefined };
}

/** 작업에 필요한 서류 이름. 서류함 응답이 있으면 그 기준(법령 규칙이 더한 서류 포함, 해당 없음 제외)이고, 없으면 체크리스트에 붙은 안내다. */
function toTask(item: ApiChecklistItem, documentNames?: string[]): ChecklistTask {
  return {
    id: item.item_id,
    task: item.task,
    category: item.category,
    group: item.group_label,
    due: item.due_date,
    documents: (documentNames ?? item.documents.map((d) => d.name)).join(", "),
    agency: item.agency ?? item.contact?.agency ?? "",
    done: item.done,
    kind: item.task_type,
    aiAdded: item.added_by_ai ?? false,
    reason: item.reason ?? null,
    lawBasis: toLawBasis(item.law_basis),
    statutory:
      item.statutory_deadline && item.statutory_basis
        ? { date: item.statutory_deadline, basis: item.statutory_basis }
        : null,
    review: item.review_needed ? (item.review_reason ?? "다시 확인이 필요해요") : null,
  };
}

/** 서류함 응답 → 화면 데이터. 서류는 연결된 첫 작업의 카테고리로 묶고, 기한이 빠른 순으로 둔다. */
function toManagedDocs(bundle: ApiBundle): ManagedDocsData | null {
  const documents = bundle.documents;
  if (!documents) return null;
  const dday = (date: string | null) => (date ? dday_(date) : null);
  const toDoc = (req: ApiDocumentRequirement): ManagedDocument => ({
    id: req.doc_key,
    name: req.name,
    type: req.type,
    typeLabel: req.type_label,
    status: req.status,
    statusLabel: req.status_label,
    applicability: req.applicability,
    aiAdded: req.added_by_ai,
    reason: req.reason,
    lawBasis: toLawBasis(req.law_basis),
    agency: req.agency,
    guide: req.guide,
    sites: req.links.map((link) => ({ label: link.label, url: link.url })),
    form: req.form
      ? {
          title: req.form.title ?? req.name,
          pdfUrl: req.form.pdf_url,
          fileUrl: req.form.file_url,
          revision: req.form.revision_date,
        }
      : null,
    tasks: req.tasks.map((task) => ({ id: task.item_id, task: task.task, done: task.done })),
    anchors: [],
    due: req.due_date,
    deadline: dday(req.due_date),
    statutoryDate: req.statutory_deadline,
    review: req.review_needed ? (req.review_reason ?? "다시 확인이 필요해요") : null,
  });
  const sections = new Map<string, ManagedDocumentSection>();
  const claimed = new Set<string>();
  const firstCategory = (req: ApiDocumentRequirement) => req.tasks.find((task) => task.category)?.category ?? "기타";
  for (const req of documents.requirements) {
    const title = firstCategory(req);
    const section = sections.get(title) ?? { title, documents: [] };
    const doc = toDoc(req);
    doc.anchors = doc.tasks.map((task) => task.id).filter((id) => !claimed.has(id));
    doc.anchors.forEach((id) => claimed.add(id));
    section.documents.push(doc);
    sections.set(title, section);
  }
  const summary = documents.summary;
  return {
    total: summary.total,
    finished: summary.finished,
    remaining: summary.remaining,
    notApplicable: summary.not_applicable,
    toObtain: summary.to_obtain,
    toWrite: summary.to_write_or_keep,
    reviewCount: summary.review_needed,
    byStatus: summary.by_status,
    sections: [...sections.values()],
  };
}

/** API 묶음에서 화면들이 함께 쓰는 값을 한 번만 계산한다. */
export function createApiModel(bundle: ApiBundle) {
  const items = bundle.report.groups.flatMap((group) => group.items);
  const byId = new Map(items.map((item) => [item.item_id, item]));
  const cards = items.map(toCard);
  const checklistItems = bundle.checklist.groups.flatMap((group) => group.items);
  const documentNames = new Map<string, string[]>();
  for (const req of bundle.documents?.requirements ?? []) {
    if (req.applicability === "not_applicable" || req.status === "not_applicable") continue;
    for (const task of req.tasks) documentNames.set(task.item_id, [...(documentNames.get(task.item_id) ?? []), req.name]);
  }
  const namesOf = (id: string) => (bundle.documents ? (documentNames.get(id) ?? []) : undefined);
  const tasks = checklistItems.map((item) => toTask(item, namesOf(item.item_id))).sort((a, b) => (a.due < b.due ? -1 : 1));
  const taskById = new Map(checklistItems.map((item) => [item.item_id, item]));

  const RS: Record<string, ReportState> = Object.fromEntries(
    items.map((item) => [
      item.item_id,
      {
        chosen: item.chosen_option ?? undefined,
        action: item.action_status,
        reply: item.action_reply ?? "",
      },
    ]),
  );
  const CONTACT: Record<string, Contact> = Object.fromEntries(
    items.flatMap((item) => (item.contact ? [[item.item_id, toContact(item.contact)]] : [])),
  );
  const TASK_LINKS: Record<string, string[]> = Object.fromEntries(
    checklistItems.map((item) => [item.item_id, item.report_item_ids]),
  );
  const AUTO: Record<string, boolean> = Object.fromEntries(
    checklistItems.map((item) => [item.item_id, item.auto_checked]),
  );
  const AR: Record<string, boolean> = Object.fromEntries(bundle.alerts.map((a) => [a.alert_id, a.read]));

  const answers = bundle.store.effective.answers;
  const S: Store = {
    name: bundle.store.name,
    type: bundle.store.business_type_input,
    address: bundle.store.address,
    detail: bundle.store.address_detail,
    opening: bundle.store.opening_date,
    birth: bundle.store.owner_birth_year,
    location: "decided",
    region: bundle.store.region ?? "",
    alcohol: Boolean(answers.sells_alcohol),
    terrace: Boolean(bundle.store.answers.uses_terrace),
    employees: Boolean(answers.has_employees),
    funds: bundle.store.answers.funds_krw,
    area: bundle.store.answers.area_sqm ?? null,
    delivery: Boolean(bundle.store.answers.does_delivery),
    mainManual: null,
    onboarded: true,
  };

  const nextSteps = (excludeId: string): NextStep[] =>
    bundle.dashboard.next_steps
      .filter((step) => step.go.item_id !== excludeId)
      .slice(0, 3)
      .map((step) => ({
        k: step.kind === "new" ? "new" : undefined,
        t: step.title,
        s: step.sub,
        go: [step.go.page, step.go.item_id ?? ""],
        cta: NEXT_CTA[step.go.page] ?? "열기",
      }));

  const pendingDecisions = () => cards.filter((card) => card.options.length && !RS[card.id]?.chosen);
  const curAction = (card: ReportCardData) => card.action ?? null;
  const allTasks = () => tasks;
  const taskCount = () => bundle.checklist.progress;
  const calEvents = () => {
    const map: Record<string, CalendarEvent[]> = {};
    const add = (date: string, event: CalendarEvent) => (map[date] ??= []).push(event);
    tasks.forEach((task) =>
      add(task.due, { t: task.task, cat: task.category, id: task.id, done: task.done, kind: "task" }),
    );
    add(S.opening, { t: "개업일", cat: "개업", id: "open", done: false, kind: "open" });
    return map;
  };
  const documentsOf = (taskId: string): DocumentViewData[] =>
    (taskById.get(taskId)?.documents ?? []).map((doc) => ({
      id: doc.doc_id,
      name: doc.name,
      agency: doc.agency,
      guide: doc.guide,
      sites: doc.links.map((link) => ({ label: link.label, url: link.url })),
      contact: doc.contact ? `doc:${taskId}:${doc.doc_id}` : undefined,
    }));
  const docContacts: Record<string, Contact> = Object.fromEntries([
    ...checklistItems.flatMap((item) =>
      item.documents.flatMap((doc) =>
        doc.contact ? [[`doc:${item.item_id}:${doc.doc_id}`, toContact(doc.contact)] as const] : [],
      ),
    ),
  ]);
  const managedDocs = toManagedDocs(bundle);
  // 체크리스트 행은 기관 이름으로 연락처를 찾는다. 같은 기관이면 서버가 준 관할 연락처를 쓴다.
  const contactOfAgency = (agency: string) => {
    const contact = checklistItems.find((item) => (item.agency ?? item.contact?.agency) === agency && item.contact)?.contact;
    return contact ? { phone: contact.phone, ex: Boolean(contact.is_example) } : null;
  };

  const notifications: NotificationSummary[] = bundle.alerts.map((alert) => ({
    id: alert.alert_id,
    title: alert.title,
    body: alert.body ?? "",
    category: ALERT_LABEL[alert.type] ?? "",
    read: alert.read,
    destination: alert.cta?.page ?? "dashboard",
    focus: alert.cta?.item_id ?? "",
  }));

  return {
    bundle,
    byId,
    cards,
    RS,
    S,
    CONTACT: { ...CONTACT, ...docContacts },
    TASK_LINKS,
    AUTO,
    AR,
    notifications,
    pendingDecisions,
    curAction,
    allTasks,
    taskCount,
    calEvents,
    documentsOf,
    nextSteps,
    dashboard: {
      S,
      RS,
      SIM: "now",
      AR,
      eff: () => ({ name: bundle.store.effective.name }),
      pendingDecisions,
      taskCount,
      alertsFor: () => bundle.alerts.map((a) => ({ id: a.alert_id })),
      diffDays,
      D,
      realToday,
      buildCards: () => cards,
      curAction,
      allTasks,
    },
    report: {
      obligations: bundle.obligations,
      // 근거에 모의·예시 자료(from_mock)가 쓰인 점검 항목: 실제 조회로 판정한 결과가 아니라는 뜻이다
      exampleItems: items.filter((item) => item.evidence.some((e) => e.from_mock)).map((item) => item.title),
      S,
      buildCards: () => cards,
      ev: (card: ReportCardData) => card.base,
      RS,
      curAction,
      CONTACT,
      allTasks,
      TASK_LINKS,
      cardDone: (id: string) => RS[id]?.action === "done",
      AUTO,
      nextSteps,
      cardShort: (card: ReportCardData) => card.title,
    },
    checklist: {
      allTasks,
      taskCount,
      GROUPS,
      typeCounts: () => bundle.checklist.type_counts ?? null,
      documentCount: (taskId: string) => namesOf(taskId)?.length ?? taskById.get(taskId)?.documents.length ?? 0,
      contactOfAgency,
      dday,
      S,
      calEvents,
      CATCOLOR,
      iso,
      realToday,
      TASK_LINKS,
      AUTO,
    },
    docs: {
      allTasks,
      dday,
      documentsOf,
      managedDocuments: () => managedDocs,
    },
  };
}

export type ApiModel = ReturnType<typeof createApiModel>;
