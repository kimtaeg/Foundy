import { dialogActionRow, dialogField, dialogPrimaryAction, dialogSecondaryAction } from "@/components/feedback/Modal/dialog-styles";

export interface LocationPickDialogProps { areaId: string }

export function LocationPickDialog({ areaId }: LocationPickDialogProps) {
  return (
    <form id="nxPick" data-area={areaId} className="grid gap-4">
      <p className="m-0 text-sm leading-relaxed text-neutral-600">
        이 상권에서 알아본 자리의 주소를 입력하면 점검 리포트가 시작돼요.
      </p>
      <label className="grid gap-1.5 text-sm font-semibold text-neutral-800">
        <span>후보 주소 <span className="text-xs font-medium text-neutral-500">(필수)</span></span>
        <input id="pickAddr" required autoComplete="street-address" placeholder="예: 서울 성동구 성수이로 00" className={dialogField} />
      </label>
      <label className="grid gap-1.5 text-sm font-semibold text-neutral-800">
        층
        <input id="pickFloor" defaultValue="1층" className={dialogField} />
      </label>
      <div className={dialogActionRow}>
        <button type="button" data-dialog-dismiss="" className={dialogSecondaryAction}>취소</button>
        <button type="submit" className={dialogPrimaryAction}>주소 확정하고 점검 시작</button>
      </div>
    </form>
  );
}
