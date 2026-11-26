// 能力与接入 · 工具与 MCP（骨架 console-v4-skeleton.html `data-mod="capabilities"` 工具页）
//
// 骨架 4 块：内置工具 / 服务器 / 接入待授权 / 工具命名冲突。四块都在。
// 两个真读口：工具登记（工具或工具集行）与 MCP 服务器清单。上游此刻不可达时照实写
// 缺读口：没有读口的列（沙箱、7 天调用、出站、授权状态）整列不画，不摆示例工具名。
import { Pill, type PillTone } from "@/components/console/Pill";
import { CardFoot, CardHead, GapNote, PaneHead } from "./PaneBits";
import { DASH, asOfLabel, count, gapText, listOf, recordOf, textOf, usePort } from "./paneApi";

type ToolRow = {
  key: string;
  name: string | null;
  purpose: string | null;
  risk: "低" | "中" | "高" | null;
  sandbox: string | null;
  isDefault: "开" | "关" | null;
};

type ServerRow = {
  key: string;
  name: string | null;
  transport: string | null;
  tools: number | null;
  outbound: string | null;
  status: { label: string; tone: PillTone } | null;
};

const RISK_LABEL: Record<string, "低" | "中" | "高"> = {
  low: "低",
  medium: "中",
  mid: "中",
  high: "高",
  低: "低",
  中: "中",
  高: "高",
};

const SERVER_STATE: Record<string, { label: string; tone: PillTone }> = {
  connected: { label: "已连接", tone: "ok" },
  ok: { label: "已连接", tone: "ok" },
  ready: { label: "已连接", tone: "ok" },
  degraded: { label: "降级", tone: "warn" },
  failed: { label: "握手失败", tone: "bad" },
  error: { label: "握手失败", tone: "bad" },
  disabled: { label: "已停用", tone: "mut" },
};

function parseTools(body: unknown): ToolRow[] | null {
  const items = listOf(body);
  if (items === null) return null;
  return items.map((item, index) => {
    const row = recordOf(item);
    const rawRisk = (textOf(row.risk) ?? textOf(row.risk_level) ?? "").trim();
    const risk = RISK_LABEL[rawRisk.toLowerCase()] ?? null;
    const def = row["default"] ?? row.defaultEnabled;
    const sandbox = textOf(row.sandbox) ?? textOf(row.sandbox_mode);
    return {
      key: textOf(row.key) ?? textOf(row.name) ?? textOf(row.id) ?? `tool-${index}`,
      name: textOf(row.label) ?? textOf(row.name) ?? textOf(row.key),
      purpose: textOf(row.description) ?? textOf(row.purpose),
      risk,
      sandbox,
      isDefault: def === true ? "开" : def === false ? "关" : null,
    };
  });
}

function parseServers(body: unknown): ServerRow[] | null {
  const items = listOf(body);
  if (items === null) return null;
  return items.map((item, index) => {
    const row = recordOf(item);
    const rawState = (textOf(row.state) ?? textOf(row.status) ?? "").toLowerCase();
    const tools = Array.isArray(row.tools) ? row.tools.length : null;
    const outbound = Array.isArray(row.outbound)
      ? row.outbound.length
        ? row.outbound.join(" · ")
        : "无"
      : textOf(row.outbound);
    return {
      key: textOf(row.id) ?? textOf(row.name) ?? `server-${index}`,
      name: textOf(row.name) ?? textOf(row.id),
      transport: textOf(row.transport) ?? textOf(row.kind),
      tools,
      outbound,
      status: rawState ? SERVER_STATE[rawState] ?? { label: rawState, tone: "mut" } : null,
    };
  });
}

export function CapToolsPane() {
  // `/api/tools` 在 Hermes 上是 404（真读口是 toolsets）；直连工具组清单，
  // 不再经 BFF 的探测腿 —— 那条腿的上游地址一失效就会把「有数据」显示成「空集」。
  const tools = usePort("/api/tools/toolsets", parseTools, (rows) => rows.length === 0);
  const servers = usePort("/api/mcp/servers", parseServers, (rows) => rows.length === 0);

  const toolRows = tools.read.k === "ready" ? tools.read.data : [];
  const serverRows = servers.read.k === "ready" ? servers.read.data : [];
  const toolCount = tools.read.k === "ready" ? toolRows.length : tools.read.k === "empty" ? 0 : null;
  const serverCount =
    servers.read.k === "ready" ? serverRows.length : servers.read.k === "empty" ? 0 : null;

  // 列只在有源时才画：沙箱与 7 天调用、出站与授权状态没有读口，整列不出现。
  const showRisk = toolRows.some((row) => row.risk !== null);
  const showSandbox = toolRows.some((row) => row.sandbox !== null);
  const showDefault = toolRows.some((row) => row.isDefault !== null);

  const showTransport = serverRows.some((row) => row.transport !== null);
  const showToolCount = serverRows.some((row) => row.tools !== null);
  const showOutbound = serverRows.some((row) => row.outbound !== null);
  const showServerState = serverRows.some((row) => row.status !== null);

  return (
    <div className="cap-pane" data-testid="cap-tools">
      <PaneHead
        showNative={false}
        sub={`${count(toolCount)} 个内置工具 · ${count(serverCount)} 个 MCP 服务器 · ${DASH} 个已授权工具`}
        readout={asOfLabel(tools.read)}
        readoutTitle="工具登记的读取时刻（北京时间）"
      />

      {/* 1 内置工具 */}
      <div className="console-card">
        <CardHead title="内置工具" action="按风险分级" />
        {toolRows.length > 0 ? (
          <div className="cap-tw">
            <table className="cap-t">
              <thead>
                <tr>
                  <th>工具</th>
                  <th>作用</th>
                  {showRisk ? <th>风险</th> : null}
                  {showSandbox ? <th className="cap-sm-hide">沙箱</th> : null}
                  {showDefault ? <th>默认</th> : null}
                </tr>
              </thead>
              <tbody>
                {toolRows.map((row) => (
                  <tr key={row.key} data-testid="cap-tool-row">
                    <td className="cap-mono">{row.name ?? DASH}</td>
                    <td className="cap-mut">{row.purpose ?? DASH}</td>
                    {showRisk ? (
                      <td>
                        {row.risk ? (
                          <Pill tone={row.risk === "高" ? "bad" : row.risk === "中" ? "warn" : "mut"}>
                            {row.risk}
                          </Pill>
                        ) : (
                          <span className="cap-mut">{DASH}</span>
                        )}
                      </td>
                    ) : null}
                    {showSandbox ? (
                      <td className="cap-mut cap-sm-hide">{row.sandbox ?? DASH}</td>
                    ) : null}
                    {showDefault ? (
                      <td>
                        {row.isDefault ? (
                          <Pill tone={row.isDefault === "开" ? "ok" : "mut"}>{row.isDefault}</Pill>
                        ) : (
                          <span className="cap-mut">{DASH}</span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="console-card__body">
            <GapNote>
              {gapText(tools.read, "正在读取工具登记…", "工具登记是空的（真零，不是加载失败）")}
            </GapNote>
          </div>
        )}
        <CardFoot
          note="沙箱与 7 天调用没有读口，整列不画；「默认」是新建员工时的初值，高风险工具永远需要门禁"
          right={toolCount === null ? undefined : `${toolCount} 个工具`}
        />
      </div>

      {/* 2 服务器 */}
      <div className="console-card">
        <CardHead title="服务器" action="MCP 连接" />
        {serverRows.length > 0 ? (
          <div className="cap-tw">
            <table className="cap-t">
              <thead>
                <tr>
                  <th>名称</th>
                  {showTransport ? <th>传输</th> : null}
                  {showToolCount ? <th className="cap-num">工具</th> : null}
                  {showOutbound ? <th className="cap-sm-hide">出站</th> : null}
                  {showServerState ? <th>状态</th> : null}
                </tr>
              </thead>
              <tbody>
                {serverRows.map((row) => (
                  <tr key={row.key} data-testid="cap-server-row">
                    <td className="cap-mono">{row.name ?? DASH}</td>
                    {showTransport ? <td className="cap-mut">{row.transport ?? DASH}</td> : null}
                    {showToolCount ? (
                      <td className="cap-num">{row.tools === null ? DASH : count(row.tools)}</td>
                    ) : null}
                    {showOutbound ? (
                      <td className="cap-mut cap-sm-hide">{row.outbound ?? DASH}</td>
                    ) : null}
                    {showServerState ? (
                      <td>
                        {row.status ? (
                          <Pill tone={row.status.tone}>{row.status.label}</Pill>
                        ) : (
                          <span className="cap-mut">{DASH}</span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="console-card__body">
            <GapNote>
              {gapText(servers.read, "正在读取 MCP 服务器…", "MCP 服务器清单是空的（真零，不是加载失败）")}
            </GapNote>
          </div>
        )}
        <CardFoot
          note="出站范围与 7 天调用没有读口，整列不画；关掉的工具在员工侧不可见"
          right={serverCount === null ? undefined : `${serverCount} 个服务器`}
        />
      </div>

      <div className="cap-g2">
        {/* 3 待授权 */}
        <div className="console-card">
          <CardHead title="接入待授权" action="请求队列" />
          <div className="console-card__body">
            <GapNote>缺读口：接入请求队列未接线，这里没有待批的服务器、出站范围或请求人。</GapNote>
            <p className="cap-para">
              出站范围未声明时等同于开放全部出站；这类请求在批准前必须逐条登记域名。
            </p>
          </div>
        </div>

        {/* 4 命名冲突 */}
        <div className="console-card">
          <CardHead title="工具命名冲突" action="按服务器:工具" />
          <div className="console-card__body">
            <GapNote>缺读口：冲突检测依赖服务器工具清单，本控制台读不到这份清单。</GapNote>
            <p className="cap-para">
              员工侧按「服务器:工具」命名；控制台展示短名时需带来源，否则排查会串。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}