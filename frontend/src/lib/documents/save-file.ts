/** 받아 온 파일(Blob)을 브라우저 다운로드로 저장한다. 화면·상태에 의존하지 않는 브라우저 유틸이다. */
export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
