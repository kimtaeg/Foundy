"use client";
import { useFeatureData } from "@/hooks/useFeatureData";
import { type CalendarDay, type ChecklistViewData } from "@/types/checklist";

export function useChecklist(): ChecklistViewData | null {
  const { context } = useFeatureData("checklist");
  if (!context) return null;
  const model = context;
  const tasks = model.allTasks();
  const groupNames =
    model.checkView === "timeline"
      ? model.GROUPS
      : [...new Set(tasks.map((task) => task.category))];
  const groups = groupNames
    .map((title) => ({
      title,
      tasks: tasks
        .filter(
          (task) =>
            (model.checkView === "timeline" ? task.group : task.category) === title,
        )
        .map((task) => ({
          task,
          contact: model.contactOfAgency(task.agency),
          documentCount: model.documentCount(task.id),
          deadline: model.dday(task.due),
        })),
    }))
    .filter((group) => group.tasks.length);
  const { y: year, m: month, sel: selected } = model.CAL;
  const events = model.calEvents();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = model.iso(model.realToday());
  const days: Array<CalendarDay | null> = Array.from(
    { length: 42 },
    (_, index) => {
      const day = index - firstDay + 1;
      if (day < 1 || day > daysInMonth) return null;
      const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return {
        date,
        day,
        selected: selected === date,
        opening: date === model.S.opening,
        today: today === date,
        events: events[date] ?? [],
      };
    },
  );
  return {
    opening: model.S.opening,
    employees: model.S.employees,
    view: model.checkView,
    colors: model.CATCOLOR,
    groups,
    count: model.taskCount(),
    kinds: model.typeCounts?.() ?? null,
    reviewCount: tasks.filter((task) => task.review).length,
    calendar: {
      year,
      month,
      selected,
      days,
      selectedEvents: selected ? (events[selected] ?? []) : [],
    },
  };
}
