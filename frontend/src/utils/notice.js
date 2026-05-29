export function showNotice(message, title = "系統提示") {
  window.dispatchEvent(
    new CustomEvent("game-notice", {
      detail: {
        title,
        message: String(message || ""),
      },
    })
  );
}
