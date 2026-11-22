import { dialogActionRow, dialogDangerAction, dialogSecondaryAction } from "@/components/feedback/Modal/dialog-styles";

export function StoreResetDialog() {
  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <p className="m-0 text-[15px] leading-relaxed text-neutral-700">
          이 계정의 가게 정보, 점검 결과, 체크리스트 진행 상태를 지우고 자리 선택부터 다시 시작해요.
        </p>
        <p className="m-0 text-sm font-semibold text-[var(--red)]">지운 정보는 되돌릴 수 없어요.</p>
      </div>
      <div className={dialogActionRow}>
        <button type="button" data-dialog-dismiss="" className={dialogSecondaryAction}>취소</button>
        <button type="button" data-nx="mpwipego" className={dialogDangerAction}>지우고 다시 설정</button>
      </div>
    </div>
  );
}
