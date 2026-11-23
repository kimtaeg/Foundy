/** 페이지별 API 응답을 화면 데이터로 변환한다. */
import { CATCOLOR } from "@/data/checklist";
import { buildDashboardPreparation } from "@/lib/dashboard/preparation";
import { addDays, D, diffDays, iso } from "@/lib/date";
import { readGrants } from "@/lib/grants/read-grants";
import { toReportNextStep } from "@/lib/report/api-next-step";
import type {
  ApiChecklist,
  ApiChecklistItem,
  ApiContact,
  ApiDashboard,
  ApiDocuments,
  ApiEvidence,
  ApiOption,
  ApiReport,
  ApiReportItem,
  ApiResources,
} from "@/lib/api/types";
import type { CalendarEvent, ChecklistContext, ChecklistTask } from "@/types/checklist";
import type { Contact } from "@/types/contact";
import type { DashboardTask, DashboardViewData } from "@/types/dashboard";
import type { DocsViewData, DocumentViewData } from "@/types/documents";
import type { Grant } from "@/types/grants";
import type { EvidenceItemData, ReportAction, ReportCardData, ReportContext, ReportOption, ReportState } from "@/types/report";
import type { NotificationSummary } from "@/types/notifications";

const ALERT_LABEL: Record<string, string> = {
  decision: "결정 필요",
  next: "다음 할 일",
  deadline: "마감 임박",
  change: "변경 감지",
  grant: "지원사업",
};

function toContact(contact: ApiContact): Contact {
  return { name: contact.agency };
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
    base: item.verdict_before ?? item.verdict,
    by: item.decided_by,
    title: item.chosen_option && item.resolved_title ? item.resolved_title : item.title,
    reason: item.reason ?? "",
    consequence: item.consequence ?? "",
    options: item.options.map((option) => {
      const view = toOption(option);
      if (option.option_id === item.chosen_option) view.fx.changes = item.applied_changes;
      return view;
    }),
    rec: item.recommendation ? { id: item.recommendation.option_id, reason: item.recommendation.reason } : null,
    action: toAction(item.user_action),
  };
}

export function toEvidence(evidence: ApiEvidence): EvidenceItemData {
  const mock = evidence.from_cache && !evidence.from_mock ? " (저장된 조회 결과)" : "";
  const value =
    evidence.type === "law"
      ? [evidence.law_name, evidence.article, evidence.text].filter(Boolean).join(" · ")
      : evidence.value ?? "";
  return {
    source: evidence.source + (evidence.from_mock ? " (예시 자료)" : mock),
    value,
    kind: evidence.type,
    url: evidence.url ?? undefined,
  };
}

function toTaskSummary(item: ApiDashboard["checklist_tasks"][number]): DashboardTask {
  return {
    id: item.item_id,
    task: item.task,
    category: item.category,
    group: item.group_label,
    due: item.due_date,
    done: item.done,
  };
}

function dashboardFromApi(data: ApiDashboard, tasks: DashboardTask[]): DashboardViewData {
  const store = data.store;
  return {
    ...buildDashboardPreparation(tasks),
    timelineTasks: tasks,
    store: {
      name: store.registered_name,
      type: store.business_type_input,
      address: store.address,
      detail: store.address_detail,
      opening: store.opening_date,
      location: "decided",
      region: store.region ?? "",
    },
    name: store.name,
    undecided: false,
    days: -store.d_day,
    decisions: data.pending_decisions.map((item) => ({
      id: item.item_id,
      stage: item.stage,
      title: item.title,
      base: item.verdict,
    })),
    taskCount: data.checklist_progress,
    actions: data.today_todos.map((todo) => ({
      id: todo.item_id,
      action: { type: "task", text: todo.task, min: todo.est_minutes ?? 0 },
    })),
    reportCounts: data.report_summary,
    asOf: iso(addDays(D(store.opening_date), store.d_day)),
  };
}

type ApiReportContext = Pick<ReportContext, "S" | "buildCards" | "ev" | "RS" |
  "curAction" | "CONTACT" | "nextSteps" | "cardShort">;

function reportFromApi(data: ApiReport) {
  const items = data.groups.flatMap((group) => group.items);
  const cards = items.map(toCard);
  const byId = new Map(items.map((item) => [item.item_id, item]));
  const RS: Record<string, ReportState> = Object.fromEntries(items.map((item) => [
    item.item_id,
    { chosen: item.chosen_option ?? undefined, action: item.action_status, reply: item.action_reply ?? "" },
  ]));
  const context: ApiReportContext = {
    S: { location: "decided" },
    buildCards: () => cards,
    ev: (card) => byId.get(card.id)?.verdict ?? card.base,
    RS,
    curAction: (card) => card.action ?? null,
    CONTACT: Object.fromEntries(items.flatMap((item) =>
      item.contact ? [[item.item_id, toContact(item.contact)]] : [])),
    nextSteps: (excludeId) => data.next_steps.filter((step) => step.go.item_id !== excludeId).slice(0, 3).map(toReportNextStep),
    cardShort: (card) => card.title,
  };
  return { byId, cards, RS, context };
}

function documentNames(item: ApiChecklistItem): string[] {
  return item.document_names ?? item.documents.map((document) => document.name);
}

function deadlineLabel(days: number): string {
  return days >= 0 ? `D-${days}` : `D+${Math.abs(days)}`;
}

function checklistFromApi(data: ApiChecklist, grants: Grant[]): Omit<ChecklistContext, "checkView" | "CAL"> {
  const items = data.groups.flatMap((group) => group.items);
  const today = D(data.as_of);
  const namesByTask = new Map(items.map((item) => [item.item_id, documentNames(item)]));
  const tasks: ChecklistTask[] = items.map((item) => ({
    ...toTaskSummary(item),
    documents: (namesByTask.get(item.item_id) ?? []).join(", "),
    agency: item.agency ?? item.contact?.agency ?? "",
  })).sort((a, b) => a.due.localeCompare(b.due));

  return {
    allTasks: () => tasks,
    taskCount: () => data.progress,
    GROUPS: data.groups.map((group) => group.group_label),
    documentCount: (taskId) => namesByTask.get(taskId)?.length ?? 0,
    dday: (date) => deadlineLabel(diffDays(D(date), today)),
    S: { opening: data.opening_date, employees: data.has_employees },
    calEvents: () => {
      const events: Record<string, CalendarEvent[]> = {};
      for (const task of tasks) {
        (events[task.due] ??= []).push({ t: task.task, cat: task.category, id: task.id, done: task.done, kind: "task" });
      }
      (events[data.opening_date] ??= []).push({ t: "개업일", cat: "개업", id: "open", done: false, kind: "open" });
      for (const grant of grants) {
        if (grant.deadline && grant.deadline >= data.as_of && grant.res !== "unknown") {
          (events[grant.deadline] ??= []).push({
            t: `지원사업 마감 · ${grant.title}`, cat: "정책", id: grant.id, done: false, kind: "grant",
          });
        }
      }
      return events;
    },
    CATCOLOR,
    iso,
    realToday: () => new Date(today),
    TASK_LINKS: Object.fromEntries(items.map((item) => [item.item_id, item.report_item_ids])),
    AUTO: Object.fromEntries(items.map((item) => [item.item_id, item.auto_checked])),
  };
}

function docsFromApi(data: ApiDocuments): DocsViewData {
  return {
    summaryBasis: "documents",
    total: data.summary.total,
    remaining: data.summary.remaining,
    finished: data.summary.finished,
    rows: data.groups.map((group) => {
      const documents: DocumentViewData[] = group.documents.map((doc) => ({
        id: doc.doc_key, name: doc.name, agency: doc.agency, guide: doc.guide, sites: doc.links, status: doc.status,
      }));
      return {
        task: {
          ...toTaskSummary(group),
          documents: documents.map((doc) => doc.name).join(", "),
          agency: group.agency ?? "",
        },
        deadline: deadlineLabel(group.dday),
        documents,
      };
    }),
  };
}

export function createApiModel(bundle: Partial<ApiResources>) {
  const dashboardTasks = bundle.dashboard?.checklist_tasks.map(toTaskSummary) ?? [];
  const report = bundle.report && reportFromApi(bundle.report);
  const grants = bundle.grants ? readGrants(bundle.grants, bundle.me?.user.provider === "demo").catalog : [];
  const checklist = bundle.checklist && checklistFromApi(bundle.checklist, grants);
  const notifications: NotificationSummary[] = (bundle.alerts ?? []).map((alert) => ({
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
    dashboard: bundle.dashboard && dashboardFromApi(bundle.dashboard, dashboardTasks),
    report: report?.context,
    checklist,
    docsView: bundle.documents && docsFromApi(bundle.documents),
    byId: report?.byId ?? new Map<string, ApiReportItem>(),
    cards: report?.cards ?? [],
    RS: report?.RS ?? {},
    notifications,
    allTasks: () => checklist?.allTasks() ?? dashboardTasks,
  };
}

export type ApiModel = ReturnType<typeof createApiModel>;
