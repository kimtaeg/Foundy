import type {
  ApiChecklist, ApiChecklistState, ApiDashboard, ApiDocumentRequirement, ApiDocuments, ApiDocumentState,
} from "@/lib/api/types";

export function patchChecklistTask(data: ApiChecklist, state: ApiChecklistState): ApiChecklist {
  const previous = data.groups.flatMap(group => group.items).find(item => item.item_id === state.item_id);
  if (!previous) return data;
  if (previous.done === state.done && previous.auto_checked === state.auto_checked &&
      (state.review_needed === undefined || (previous.review_needed === state.review_needed && previous.review_reason === state.review_reason))) {
    return data;
  }
  const reviewChange = state.review_needed === undefined ? 0 : Number(state.review_needed) - Number(!!previous.review_needed);
  return {
    ...data,
    groups: data.groups.map(group => ({
      ...group,
      items: group.items.map(item => item.item_id === state.item_id ? { ...item, ...state } : item),
    })),
    progress: { ...data.progress, done: data.progress.done + Number(state.done) - Number(previous.done) },
    review_needed: data.review_needed === undefined ? undefined : data.review_needed + reviewChange,
  };
}

export function patchDashboardTask(data: ApiDashboard, state: ApiChecklistState): ApiDashboard {
  const previous = data.checklist_tasks.find(item => item.item_id === state.item_id);
  if (!previous || previous.done === state.done) return data;
  return {
    ...data,
    checklist_tasks: data.checklist_tasks.map(item => item.item_id === state.item_id ? { ...item, done: state.done } : item),
    checklist_progress: {
      ...data.checklist_progress,
      done: data.checklist_progress.done + Number(state.done) - Number(previous.done),
    },
  };
}

export function patchDocumentTask(data: ApiDocuments, state: ApiChecklistState): ApiDocuments {
  const changed = (item: { item_id: string; done: boolean }) => item.item_id === state.item_id && item.done !== state.done;
  if (!data.requirements.some(document => document.tasks.some(changed))) return data;
  const patch = <T extends { item_id: string; done: boolean }>(item: T): T =>
    changed(item) ? { ...item, done: state.done } : item;
  const patchLinks = (document: ApiDocumentRequirement): ApiDocumentRequirement => document.tasks.some(changed)
    ? { ...document, tasks: document.tasks.map(patch) }
    : document;
  return {
    ...data,
    groups: data.groups.map(group => ({ ...patch(group), documents: group.documents.map(patchLinks) })),
    requirements: data.requirements.map(patchLinks),
  };
}

type DocumentStatePatch = Pick<ApiDocumentState, "doc_key" | "status"> & Partial<ApiDocumentState>;

export function patchDocumentStatus(data: ApiDocuments, state: DocumentStatePatch): ApiDocuments {
  const previous = data.requirements.find(document => document.doc_key === state.doc_key);
  if (!previous) return data;
  const next = { ...previous, ...state };
  const replace = (document: ApiDocumentRequirement) => document.doc_key === next.doc_key ? next : document;
  const counted = (document: ApiDocumentRequirement) => document.status !== "not_applicable" && document.applicability !== "not_applicable";
  const finished = (document: ApiDocumentRequirement) => counted(document) && (document.status === "obtained" || document.status === "submitted");
  const countChange = Number(counted(next)) - Number(counted(previous));
  const summary = data.summary;
  const total = summary.total + countChange;
  const completed = summary.finished + Number(finished(next)) - Number(finished(previous));
  const byStatus = { ...summary.by_status };
  byStatus[previous.status] -= 1;
  byStatus[next.status] += 1;
  return {
    ...data,
    groups: data.groups.map(group => ({ ...group, documents: group.documents.map(replace) })),
    requirements: data.requirements.map(replace),
    summary: {
      ...summary,
      total, finished: completed, remaining: total - completed,
      not_applicable: summary.not_applicable - countChange,
      by_status: byStatus,
      by_type: summary.by_type && { ...summary.by_type, [next.type]: summary.by_type[next.type] + countChange },
      to_obtain: summary.to_obtain + (next.type === "issued" || next.type === "certificate" ? countChange : 0),
      to_write_or_keep: summary.to_write_or_keep + (next.type === "application" || next.type === "kept" ? countChange : 0),
      review_needed: summary.review_needed + Number(next.review_needed) - Number(previous.review_needed),
    },
  };
}
