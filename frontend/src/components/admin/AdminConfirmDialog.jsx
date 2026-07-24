import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

export default function AdminConfirmDialog({
  open,
  title,
  description,
  details,
  confirmLabel = "Xác nhận",
  cancelLabel = "Quay lại",
  tone = "warning",
  busy = false,
  onConfirm,
  onCancel,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef(null);
  const previousFocusRef = useRef(null);
  const dialogRef = useRef(null);
  const onCancelRef = useRef(onCancel);
  const busyRef = useRef(busy);
  onCancelRef.current = onCancel;
  busyRef.current = busy;

  useEffect(() => {
    if (!open) return undefined;
    previousFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const appRoot = document.getElementById("root");
    const previousInert = appRoot?.inert;
    document.body.style.overflow = "hidden";
    if (appRoot) appRoot.inert = true;
    const timer = window.setTimeout(() => cancelRef.current?.focus(), 0);

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !busyRef.current) onCancelRef.current?.();
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll(
        "button:not(:disabled)",
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (appRoot) appRoot.inert = previousInert;
      previousFocusRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="admin-confirm-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel?.();
      }}
    >
      <section
        ref={dialogRef}
        className={`admin-confirm-dialog admin-confirm-${tone}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <div className="admin-confirm-symbol" aria-hidden="true">
          {tone === "danger" ? "!" : "?"}
        </div>
        <div className="admin-confirm-copy">
          <p className="admin-confirm-kicker">
            {tone === "danger"
              ? "Thao tác cần thận trọng"
              : "Kiểm tra trước khi tiếp tục"}
          </p>
          <h2 id={titleId}>{title}</h2>
          <p id={descriptionId}>{description}</p>
          {details ? (
            <div className="admin-confirm-details">{details}</div>
          ) : null}
        </div>
        <div className="admin-confirm-actions">
          <button
            ref={cancelRef}
            className="admin-confirm-cancel"
            type="button"
            disabled={busy}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            className="admin-confirm-submit"
            type="button"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Đang xử lý…" : confirmLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
