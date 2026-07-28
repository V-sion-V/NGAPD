import type { DeviceSummary, PairingStatus } from "@ngapd/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useId, useMemo, useState } from "react";

import { apiRequest } from "../api.js";
import { DangerousAction } from "./DangerousAction.js";
import { ErrorNotice } from "./ErrorNotice.js";

interface PairingSummary {
  pairingId: string;
  status: PairingStatus;
  device: Pick<DeviceSummary, "name" | "platform">;
  expiresAt: string;
}

export function AccessPanel() {
  const queryClient = useQueryClient();
  const initialCode = useMemo(
    () => new URLSearchParams(window.location.search).get("code") ?? "",
    [],
  );
  const [pairingCode, setPairingCode] = useState(initialCode.toUpperCase());
  const [confirmedCode, setConfirmedCode] = useState(
    /^[A-Z0-9]{8}$/.test(initialCode.toUpperCase()) ? initialCode.toUpperCase() : "",
  );
  const pairingCodeId = useId();

  const devices = useQuery({
    queryKey: ["devices"],
    queryFn: ({ signal }) =>
      apiRequest<{ devices: DeviceSummary[] }>("/api/v1/devices", { signal }),
  });
  const pairing = useQuery({
    queryKey: ["pairing", confirmedCode],
    queryFn: ({ signal }) =>
      apiRequest<PairingSummary>(`/api/v1/pairing/requests/${encodeURIComponent(confirmedCode)}`, {
        signal,
      }),
    enabled: Boolean(confirmedCode),
    retry: false,
  });
  const pairingDecision = useMutation({
    mutationFn: (decision: "approve" | "deny") =>
      apiRequest<PairingSummary>(
        `/api/v1/pairing/requests/${encodeURIComponent(confirmedCode)}/decision`,
        {
          method: "POST",
          json: { decision },
        },
      ),
    onSuccess: (result) => queryClient.setQueryData(["pairing", confirmedCode], result),
  });
  const revokeDevice = useMutation({
    mutationFn: (deviceId: string) =>
      apiRequest<{ ok: true }>(`/api/v1/devices/${encodeURIComponent(deviceId)}/revoke`, {
        method: "POST",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices"] }),
  });

  const inspectPairing = (event: FormEvent) => {
    event.preventDefault();
    if (/^[A-Z0-9]{8}$/.test(pairingCode)) {
      setConfirmedCode(pairingCode);
    }
  };

  return (
    <div className="content-stack">
      <header className="section-heading">
        <div>
          <p className="eyebrow">Workspace access</p>
          <h2>设备与本地 Workspace</h2>
        </div>
        <p>Web 只确认设备身份；文件物化与同步继续由本地 CLI 执行。</p>
      </header>

      <section className="panel" aria-labelledby="pairing-title">
        <h3 id="pairing-title">确认一次性配对</h3>
        <form className="inline-form" onSubmit={inspectPairing}>
          <label htmlFor={pairingCodeId}>
            CLI 显示的 8 位配对码
            <input
              id={pairingCodeId}
              autoCapitalize="characters"
              maxLength={8}
              pattern="[A-Z0-9]{8}"
              value={pairingCode}
              onChange={(event) =>
                setPairingCode(event.target.value.replaceAll("-", "").toUpperCase())
              }
            />
          </label>
          <button className="secondary" type="submit">
            查看设备
          </button>
        </form>
        {pairing.isFetching && (
          <p className="notice" role="status">
            正在读取设备摘要…
          </p>
        )}
        {pairing.data && (
          <div className="item-card">
            <div>
              <strong>{pairing.data.device.name}</strong>
              <span>
                {pairing.data.device.platform} ·{" "}
                {pairing.data.status === "pending"
                  ? "等待确认"
                  : pairing.data.status === "approved"
                    ? "已确认"
                    : pairing.data.status === "denied"
                      ? "已拒绝"
                      : "已失效"}
              </span>
            </div>
            {pairing.data.status === "pending" && (
              <div className="actions">
                <button
                  className="secondary"
                  disabled={pairingDecision.isPending}
                  type="button"
                  onClick={() => pairingDecision.mutate("deny")}
                >
                  拒绝
                </button>
                <DangerousAction
                  confirmLabel="确认并授权设备"
                  consequences={[
                    "该设备会取得当前账号的本地 Workspace 配对凭据。",
                    "文件物化和写入仍受服务端作用域、成员资格与唯一租约约束。",
                    "如果设备不再可信，可在下方设备列表中立即撤销。",
                  ]}
                  currentState={`等待确认；配对码将于 ${new Date(
                    pairing.data.expiresAt,
                  ).toLocaleString("zh-CN")} 失效`}
                  danger={false}
                  disabled={pairingDecision.isPending}
                  onConfirm={() => pairingDecision.mutateAsync("approve").then(() => undefined)}
                  target={`${pairing.data.device.name} · ${pairing.data.device.platform}`}
                  title="授权此设备？"
                  triggerLabel="确认此设备"
                />
              </div>
            )}
          </div>
        )}
        <ErrorNotice error={pairing.error ?? pairingDecision.error} focus />
      </section>

      <section className="panel" aria-labelledby="devices-title">
        <div className="panel-heading">
          <h3 id="devices-title">已授权设备</h3>
          <button className="text-button" type="button" onClick={() => devices.refetch()}>
            刷新
          </button>
        </div>
        {devices.isPending ? (
          <p className="notice" role="status">
            正在读取设备…
          </p>
        ) : devices.data?.devices.length ? (
          <ul className="item-list">
            {devices.data.devices.map((device) => (
              <li className="item-card" key={device.id}>
                <div>
                  <strong>{device.name}</strong>
                  <span>
                    {device.platform} · {device.revokedAt ? "已撤销" : "有效"}
                  </span>
                </div>
                {!device.revokedAt && (
                  <DangerousAction
                    confirmLabel="确认撤销设备"
                    consequences={[
                      "该设备现有访问资格将立即失效。",
                      "设备上的本地文件不会被删除，但后续同步需要重新配对和授权。",
                      "其他已授权设备和账号 Web 会话不受影响。",
                    ]}
                    currentState="有效设备"
                    disabled={revokeDevice.isPending}
                    onConfirm={() => revokeDevice.mutateAsync(device.id).then(() => undefined)}
                    target={`${device.name} · ${device.platform}`}
                    title="撤销此设备？"
                    triggerLabel="撤销设备"
                  />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-state">尚未授权设备。</p>
        )}
        <ErrorNotice error={devices.error ?? revokeDevice.error} focus />
      </section>
    </div>
  );
}
