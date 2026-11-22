export const PROV: Record<string, string> = {
  kakao: "카카오",
  google: "Google",
  naver: "네이버",
  demo: "아이디",
};

export const provLabel = (p: string) =>
  PROV[p] ? PROV[p] + " 계정" : "계정";
