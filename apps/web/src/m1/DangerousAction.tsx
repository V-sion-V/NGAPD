import { useEffect, useId, useRef, useState } from "react";

import { ErrorNotice } from "./ErrorNotice.js";

export function DangerousAction({
  triggerLabel,
  title,
  target,
  currentState,
  consequences,
  confirmLabel,
  onConfirm,
  disabled = false,
  danger = true,
}: {
  triggerLabel: string;
  title: string;
  target: string;
  currentState: string;
  consequences: string[];
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  disabled?: boolean;
  danger?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const headingId = useId();
  const descriptionId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (open) {
      heading.current?.focus();
    }
  }, [open]);

  const close = () => {
    setOpen(false);
    setError(null);
    queueMicrotask(() => trigger.current?.focus());
  };

  const confirm = async () => {
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      close();
    } catch (value) {
      setError(value instanceof Error ? value : new Error("操作失败"));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="confirmation">
      <button
        className={danger ? "danger-link" : "secondary compact"}
        disabled={disabled}
        ref={trigger}
        type="button"
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </button>
      {open && (
        <section
          className="confirmation-panel"
          aria-describedby={descriptionId}
          aria-labelledby={headingId}
          role="alertdialog"
        >
          <h4 id={headingId} ref={heading} tabIndex={-1}>
            {title}
          </h4>
          <dl className="confirmation-facts" id={descriptionId}>
            <div>
              <dt>目标</dt>
              <dd>{target}</dd>
            </div>
            <div>
              <dt>当前状态</dt>
              <dd>{currentState}</dd>
            </div>
          </dl>
          <div>
            <strong>确认后果</strong>
            <ul>
              {consequences.map((consequence) => (
                <li key={consequence}>{consequence}</li>
              ))}
            </ul>
          </div>
          <div className="actions">
            <button className="secondary" disabled={pending} type="button" onClick={close}>
              取消
            </button>
            <button
              className={danger ? "danger-button" : "primary"}
              disabled={pending}
              type="button"
              onClick={() => void confirm()}
            >
              {pending ? "提交中…" : confirmLabel}
            </button>
          </div>
          <ErrorNotice error={error} focus />
        </section>
      )}
    </div>
  );
}
