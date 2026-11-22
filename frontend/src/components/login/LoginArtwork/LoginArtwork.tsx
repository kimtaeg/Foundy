import Image from "next/image";

export function LoginArtwork() {
  return (
    <div data-testid="login-artwork" className="relative hidden min-h-dvh min-w-0 overflow-hidden bg-neutral-950 md:block">
      <Image
        src="/images/login/foundy-preview.png"
        alt="FOUNDY — 주소만 넣으면, 계약 전 확인할 것과 개업 일정까지. 상권 분석 화면 미리보기."
        width={1017}
        height={1472}
        quality={95}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </div>
  );
}
