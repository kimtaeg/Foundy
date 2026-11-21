/** Browser-only document operations kept outside application state and UI components. */
export async function copyDocumentText(
  text: string,
  notify: (message: string) => void,
) {
  try {
    await navigator.clipboard.writeText(text);
    notify("복사했어요");
    return;
  } catch {
    /* Fall back for browsers without Clipboard API permission. */
  }
  const input = document.createElement("textarea");
  input.value = text;
  document.body.appendChild(input);
  input.select();
  try {
    notify(document.execCommand("copy") ? "복사했어요" : "복사하지 못했어요");
  } catch {
    notify("복사하지 못했어요");
  } finally {
    input.remove();
  }
}
