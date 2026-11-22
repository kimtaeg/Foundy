import { OpeningCountdown } from "@/components/dashboard/OpeningCountdown";
import { TypewriterText } from "@/components/ui/TypewriterText";
import type { StoreGreetingCopy } from "@/types/store-greeting";

export interface DashboardGreetingProps {
  copy: StoreGreetingCopy;
  paused?: boolean;
}

export function DashboardGreeting({ copy, paused }: DashboardGreetingProps) {
  return (
    <div className="min-w-0 space-y-3">
      <OpeningCountdown dayLabel={copy.dayLabel} label={copy.milestoneLabel} />
      <h1 className="m-0 break-keep text-[28px] font-bold leading-snug tracking-tight text-neutral-900 sm:text-[34px]">
        <TypewriterText texts={copy.messages} paused={paused} accessibleText={`${copy.name} 사장님, 환영합니다! ${copy.openingMessage}`} />
      </h1>
    </div>
  );
}
