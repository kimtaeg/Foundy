const SCRIPT_URL = "https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

interface PostcodeResult {
  roadAddress: string;
  jibunAddress: string;
  address: string;
}

type PostcodeConstructor = new (options: {
  oncomplete: (result: PostcodeResult) => void;
  width: string;
  height: string;
  minWidth: number;
  shorthand: boolean;
}) => { embed: (container: HTMLElement) => void };

function getPostcode() {
  return (window as Window & { kakao?: { Postcode?: PostcodeConstructor } }).kakao?.Postcode;
}

let pendingScript: Promise<PostcodeConstructor> | undefined;

export function loadKakaoPostcode(): Promise<PostcodeConstructor> {
  const available = getPostcode();
  if (available) return Promise.resolve(available);
  if (pendingScript) return pendingScript;

  pendingScript = new Promise<PostcodeConstructor>((resolve, reject) => {
    const script = document.createElement("script");
    const timer = window.setTimeout(fail, 12000);
    function fail() {
      window.clearTimeout(timer);
      script.remove();
      reject(new Error("카카오 주소 검색을 불러오지 못했어요."));
    }
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      const postcode = getPostcode();
      if (!postcode) return fail();
      window.clearTimeout(timer);
      resolve(postcode);
    };
    script.onerror = fail;
    document.head.append(script);
  }).catch((error: unknown) => {
    pendingScript = undefined;
    throw error;
  });
  return pendingScript;
}
