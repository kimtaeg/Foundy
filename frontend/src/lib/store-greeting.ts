import type { StoreGreetingCopy } from "@/types/store-greeting";

type MilestoneCopy = Pick<
  StoreGreetingCopy,
  "dayLabel" | "dateLabel" | "milestoneLabel" | "openingMessage"
> & {
  nextStep: string;
};

function milestoneCopy(days: number): MilestoneCopy {
  if (!Number.isFinite(days)) {
    return {
      dayLabel: "일정 미정",
      dateLabel: "개업일",
      milestoneLabel: "일정 미정",
      openingMessage: "개업일을 정해볼까요?",
      nextStep: "일정부터 함께 정리해요.",
    };
  }

  const roundedDays = Math.round(days);
  const count = Math.abs(roundedDays).toLocaleString("ko-KR");

  if (roundedDays > 0) {
    return {
      dayLabel: `D-${count}`,
      dateLabel: "개업 예정",
      milestoneLabel: "개업까지",
      openingMessage: `개업까지 ${count}일 남았어요.`,
      nextStep: "오늘의 준비를 함께 시작해요.",
    };
  }

  if (roundedDays === 0) {
    return {
      dayLabel: "D-DAY",
      dateLabel: "개업일",
      milestoneLabel: "오늘 개업",
      openingMessage: "오늘은 가게를 여는 날이에요!",
      nextStep: "오늘 할 일을 함께 살펴볼까요?",
    };
  }

  return {
    dayLabel: `D+${count}`,
    dateLabel: "개업일",
    milestoneLabel: "개업 후",
    openingMessage: `개업한 지 ${count}일이 되었어요.`,
    nextStep: "오늘 할 일을 함께 살펴볼까요?",
  };
}

/** Uses the API-supplied day difference; positive means the opening is still ahead. */
export function buildStoreGreeting(name: string, days: number): StoreGreetingCopy {
  const storeName = name.trim() || "내 가게";
  const { nextStep, ...milestone } = milestoneCopy(days);

  return {
    name: storeName,
    ...milestone,
    messages: [
      `${storeName} 사장님, 환영합니다!`,
      milestone.openingMessage,
      nextStep,
    ],
  };
}
