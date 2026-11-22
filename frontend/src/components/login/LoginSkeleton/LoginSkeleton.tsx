import { Skeleton } from "@/components/loading/Skeleton";
import { LoginBrand } from "@/components/login/LoginBrand";

export function LoginSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="로그인 화면을 불러오는 중"
      data-skeleton="login"
      data-page-skeleton="login"
      className="grid min-h-dvh w-full bg-white md:grid-cols-2"
    >
      <div aria-hidden="true" className="relative hidden min-h-dvh overflow-hidden bg-neutral-950 md:block">
        <div className="absolute inset-0 bg-linear-to-tr from-teal-900/80 via-transparent to-teal-900" />
        <Skeleton className="absolute top-[32%] left-[22%] h-[42%] w-full rounded-2xl bg-neutral-600/60" />
      </div>
      <div aria-hidden="true" className="flex min-h-dvh min-w-0 items-center justify-center px-6 py-10 sm:px-10 lg:px-16">
        <div className="flex w-full max-w-[400px] flex-col gap-9">
          <div className="flex flex-col gap-4">
            <LoginBrand />
            <div className="flex flex-col gap-8">
              <div className="flex flex-col gap-3">
                <Skeleton className="h-[35px] w-52 max-w-full sm:h-10" />
                <Skeleton className="h-[23px] w-60 max-w-full" />
              </div>
              <div className="flex flex-col gap-7">
                <div className="flex flex-col gap-5">
                  {["아이디", "비밀번호"].map((label) => (
                    <div key={label} className="flex flex-col gap-2">
                      <Skeleton className="h-5 w-14" />
                      <Skeleton className="h-[52px] w-full rounded-xl" />
                    </div>
                  ))}
                </div>
                <Skeleton className="h-[52px] w-full rounded-xl" />
              </div>
            </div>
          </div>
          <div className="flex min-h-14 items-center justify-between gap-3 border-0 border-t border-solid border-neutral-200 pt-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-16" />
          </div>
        </div>
      </div>
    </div>
  );
}
