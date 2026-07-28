import { useEffect, useRef } from "react";

import { ApiRequestError } from "../api.js";

export function ErrorNotice({
  error,
  id,
  focus = false,
}: {
  error: Error | null;
  id?: string;
  focus?: boolean;
}) {
  const element = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error && focus) {
      element.current?.focus();
    }
  }, [error, focus]);

  if (!error) {
    return null;
  }

  const detail = error instanceof ApiRequestError ? error.detail : null;
  return (
    <div className="error" id={id} ref={element} role="alert" tabIndex={focus ? -1 : undefined}>
      <strong>{error.message}</strong>
      {detail?.recovery && <span>{detail.recovery}</span>}
      {detail?.currentVersion !== undefined && (
        <span>服务器当前版本：{detail.currentVersion}。请刷新后再试。</span>
      )}
      {detail?.blockingTasks?.length ? (
        <span>
          阻塞任务：
          {detail.blockingTasks.map((task) => task.key).join("、")}
        </span>
      ) : null}
      {detail?.requestId && <small>请求编号：{detail.requestId}</small>}
    </div>
  );
}
