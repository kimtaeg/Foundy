"use client";
import { MypageView } from "@/components/mypage/MypageView";
import { useProfile } from "@/hooks/useProfile";
import { useFoundy } from "@/hooks/useFoundy";

/** Connects the local demo store; the view also accepts API data independently. */
export function MypagePage() {
  const data = useProfile();
  const { onEvent } = useFoundy();
  return <MypageView data={data ?? undefined} loading={data === null} onEvent={onEvent} />;
}
