import { addDays, D, iso } from "@/lib/date";
import type { ChecklistTask } from "@/types/checklist";

export function downloadChecklistCalendar(storeId: string, opening: string, tasks: Pick<ChecklistTask, "id" | "task" | "due">[]) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const entries = [...tasks, { id: "opening", task: "개업일", due: opening }];
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Foundy//Checklist//KO"];
  for (const { id, task, due } of entries) {
    if (!due) continue;
    const title = task.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([,;])/g, "\\$1");
    lines.push("BEGIN:VEVENT", `UID:${storeId}-${id}@foundy`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${due.replaceAll("-", "")}`,
      `DTEND;VALUE=DATE:${iso(addDays(D(due), 1)).replaceAll("-", "")}`,
      `SUMMARY:${title}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR", "");
  const file = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = file;
  link.download = "foundy-checklist.ics";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(file), 500);
}
