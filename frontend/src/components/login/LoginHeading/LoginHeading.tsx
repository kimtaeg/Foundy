import { TypewriterText } from "@/components/ui/TypewriterText";

const welcomeMessages = [
  "반가워요, 사장님",
  "가게의 내일을 준비해요",
  "시작부터 함께할게요",
] as const;

export interface LoginHeadingProps {
  signingUp?: boolean;
}

export function LoginHeading({ signingUp = false }: LoginHeadingProps) {
  return (
    <header className="flex flex-col gap-3">
      <h1 className="m-0 break-keep text-[28px] font-bold leading-tight tracking-tight text-neutral-900 sm:text-[32px]">
        {signingUp ? "계정을 만들어 시작하세요" : (
          <TypewriterText
            texts={welcomeMessages}
            typingMs={75}
            deletingMs={35}
            holdMs={2600}
            accessibleText="반가워요, 사장님"
            cursorClassName="text-foundy-primary"
          />
        )}
      </h1>
      <p className="m-0 break-keep text-sm leading-relaxed text-neutral-600">{signingUp ? "회원가입 후 내 가게를 등록할 수 있어요." : "로그인하고 내 가게의 준비를 이어가세요."}</p>
    </header>
  );
}
