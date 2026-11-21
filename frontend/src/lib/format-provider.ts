export const PROV: Record<string, string> = {
  kakao: "카카오",
  google: "Google",
  naver: "네이버",
  demo: "예시",
  local: "아이디",
};

export const provLabel = (p: string) =>
  p === "demo" ? "예시 계정" : (PROV[p] || "") + " 계정";
