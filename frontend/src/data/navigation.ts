import { type NavigationDestination } from "@/types/navigation";

export const destinations: NavigationDestination[] = [
  { id: "dashboard", label: "홈" },
  { id: "report", label: "점검 리포트", description: "계약 전 확인할 내용", group: "preparation" },
  { id: "checklist", label: "체크리스트", description: "일정에 맞춰 하나씩 준비", group: "preparation" },
  { id: "docs", label: "서류함", description: "준비할 서류와 제출 안내", group: "preparation" },
  { id: "sites", label: "상권 분석" },
  { id: "grants", label: "지원사업" },
];

export const preparationNavigationLabel = "개업 준비";
