import { secondaryAction } from "../onboarding-styles";

export function DemoScenarioBanner() {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-0 border-l-2 border-solid border-foundy-primary bg-foundy-primary/5 px-4 py-3">
      <p className="m-0 text-sm font-medium text-neutral-700">가게 정보 입력 없이 둘러보기</p>
      <button className={secondaryAction} type="button" data-nx="demo">모노커피로 시작</button>
    </div>
  );
}
