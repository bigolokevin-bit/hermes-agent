export type SettingState = "enabled" | "disabled" | "unknown" | "not-landed";
export type SwitchItem = { key: "approval" | "chat"; label: string; state: SettingState; reason: string };
export type UpstreamItem = { name: string; state: SettingState; reason: string };

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stateOf(value: unknown): SettingState {
  if (value === true || value === "enabled" || value === "on") return "enabled";
  if (value === false || value === "disabled" || value === "off") return "disabled";
  return "unknown";
}

export function readSettings(payload: unknown, unavailable = false): { switches: SwitchItem[]; upstreams: UpstreamItem[] } {
  const root = record(payload);
  const rawSwitches = record(root.writeSwitches);
  const unknownReason = "配置自检尚未接入，读取不到当前值";
  const landedReason = "来自当前配置（只读）";
  const reasonFor = (state: SettingState): string => {
    if (state === "not-landed") return "配置自检尚未接入，该项未启用";
    if (state === "unknown") return unknownReason;
    return landedReason;
  };
  const switches: SwitchItem[] = ([
    ["approval", "审批流变更提交"],
    ["chat", "会话发送"],
  ] as const).map(([key, label]) => {
    const state = unavailable ? "not-landed" : stateOf(rawSwitches[key]);
    return { key, label, state, reason: reasonFor(state) };
  });
  const upstreams: UpstreamItem[] = Array.isArray(root.upstreams)
    ? root.upstreams.map((value) => {
        const upstream = record(value);
        const state = stateOf(upstream.state);
        return {
          name: typeof upstream.name === "string" && upstream.name.trim() ? upstream.name : "—",
          state,
          reason:
            typeof upstream.reason === "string" && upstream.reason.trim()
              ? upstream.reason.trim()
              : reasonFor(state),
        };
      })
    : [];
  return { switches, upstreams };
}

export function statusLabel(state: SettingState): string {
  if (state === "enabled") return "已开启";
  if (state === "disabled") return "未开启";
  if (state === "not-landed") return "未启用";
  return "未知（本次未能读取）";
}
