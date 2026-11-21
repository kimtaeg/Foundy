import { FoundyApplication } from "@/components/layout";
import { FoundyProvider } from "@/providers";
import { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Foundy — 창업 전, 확인부터.",
  description: "내 가게의 창업 준비를 확인하세요.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Manrope:wght@400;500;600;700;800&family=Noto+Sans+KR:wght@400;500;600;700;800&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/sunn-us/SUIT/fonts/variable/woff2/SUIT-Variable.css"
        />
      </head>
      <body>
        <FoundyProvider>
          <FoundyApplication>{children}</FoundyApplication>
        </FoundyProvider>
      </body>
    </html>
  );
}
