// 能力与接入 · 工具与 MCP（骨架 #/capabilities?tab=tools）
//
// 骨架 4 块：内置工具 / 服务器 / 待授权 / 命名冲突。本页 4 块都在。
// 两个真读口：工具登记与 MCP 服务器清单。上游此刻不可达时照实写缺读口，
// 不用别的接口凑行，也不摆示例工具名。
import { ConsoleCard } from "@/components/console/ConsoleCard";
import { Pill, type PillTone } from "@/components/console/Pill";
import { CardFoot, GapNote, GapRow, PaneHead } from "./PaneBits";
import { DASH, asOfLabel, count, gapText, listOf, recordOf, textOf, usePort } from "./paneApi";

type ToolRow = {
  key: string;
  name: string | null;
  purpose: string | null;
  risk: string | null;
  sandbox: string | null;
  isDefault: string | null;
};

type ServerRow = {
  key: string;
  name: string | null;
  transport: string | null;
  tools: string | null;
  outbound: string | null;
  status: string | null;
};

const RISK_LABEL: Record<string, string> = { low: "低", medium: "中", mid: "中", high: "高" };
const TOOL_STATE: Record<string, { label: string; tone: PillTone }> = {
  connected: { label: "已连接", tone: "ok" },
  ok: { label: "已连接", tone: "ok" },
  ready: { label: "已连接", tone: "ok" },
  failed: { label: "握手失败", tone: "bad" },
  error: { label: "握手失败", tone: "bad" },
  disabled: { label: "已停用", tone: "mut" },
};

function parseTools(body: unknown): ToolRow[] | null {
  const items = listOf(body);
  if (items === null) return null;
  return items.map((item, index) => {
    const row = recordOf(item);
    const rawRisk = (textOf(row.risk) ?? textOf(row.risk_level) ?? "").toLowerCase();
    const def = row.default ?? row.defaultEnabled ?? row.enabled;
    return {
      key: textOf(row.key) ?? textOf(row.name) ?? `tool-${index}`,
      name: textOf(row.name) ?? textOf(row.key),
      purpose: textOf(row.description) ?? textOf(row.purpose),
      risk: rawRisk ? RISK_LABEL[rawRisk] ?? null : null,
      sandbox: textOf(row.sandbox) ?? textOf(row.sandbox_mode),
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
    return {
      key: textOf(row.id) ?? textOf(row.name) ?? `server-${index}`,
      name: textOf(row.name),
      transport: textOf(row.transport) ?? textOf(row.kind),
      tools: tools === null ? null : String(tools),
      outbound: Array.isArray(row.outbound) ? row.outbound.length ? row.outbound.join(" · ") : "无" : null,
      status: rawState ? TOOL_STATE[rawState]?.label ?? "待核实" : null,
    };
  });
}

export function CapToolsPane() {
  const tools = usePort("/api/tools", parseTools, (rows) => rows.length === 0);
  const servers = usePort("/api/mcp/servers", parseServers, (rows) => rows.length === 0);

  const toolRows = tools.read.k === "ready" ? tools.read.data : [];
  const serverRows = servers.read.k === "ready" ? servers.read.data : [];
  const toolCount = tools.read.k === "ready" ? toolRows.length : tools.read.k === "empty" ? 0 : null;
  const serverCount =
    servers.read.k === "ready" ? serverRows.length : servers.read.k === "empty" ? 0 : null;

  return (
    <div className="cap-pane" data-testid="cap-tools">
      <PaneHead
        sub={`${count(toolCount)} 个内置工具 · ${count(serverCount)} 个 MCP 服务器 · ${DASH} 个已授权工具`}
        readout={asOfLabel(tools.read)}
        readoutTitle="工具登记的读取时刻（北京时间）"
      />

      {/* 1 内置工具 */}
      <ConsoleCard label="内置工具" action={<span className="cap-action">按风险分级</span>} flush>
        <div className="cap-tw">
          <table className="cap-t">
            <thead>
              <tr>
                <th>工具</th>
                <th>作用</th>
                <th>风险</th>
                <th className="cap-sm-hide">沙箱</th>
                <th className="cap-num cap-sm-hide">7 天调用</th>
                <th>默认</th>
              </tr>
            </thead>
            <tbody>
              {toolRows.map((row) => (
                <tr key={row.key} data-testid="cap-tool-row">
                  <td className="cap-mono">{row.name ?? DASH}</td>
                  <td className="cap-mut">{row.purpose ?? DASH}</td>
                  <td>
                    {row.risk ? (
                      <Pill tone={row.risk === "高" ? "bad" : row.risk === "中" ? "warn" : "mut"}>
                        {row.risk}
                      </Pill>
                    ) : (
                      <span className="cap-mut">{DASH}</span>
                    )}
                  </td>
                  <td className="cap-mut cap-sm-hide">{row.sandbox ?? DASH}</td>
                  <td className="cap-num cap-sm-hide" title="工具登记没有按 7 天窗口回传调用数">
                    {DASH}
                  </td>
                  <td>
                    {row.isDefault === null ? (
                      <span className="cap-mut">{DASH}</span>
                    ) : (
                      <Pill tone={row.isDefault === "开" ? "ok" : "mut"}>{row.isDefault}</Pill>
                    )}
                  </td>
                </tr>
              ))}
              {toolRows.length === 0 ? (
                <GapRow colSpan={6}>
                  {gapText(tools.read, "正在读取工具登记…", "工具登记是空的（真零）")}
                </GapRow>
              ) : null}
            </tbody>
          </table>
        </div>
        <CardFoot
          note="「默认」是新建员工时的初值，可由管理员在员工配置里覆盖；高风险工具永远需要门禁"
          right={toolCount === null ? DASH : `${toolCount} 个工具`}
        />
      </ConsoleCard>

      {/* 2 服务器 */}
      <ConsoleCard label="服务器" action={<span className="cap-action">MCP 连接</span>} flush>
        <div className="cap-tw">
          <table className="cap-t">
            <thead>
              <tr>
                <th>名称</th>
                <th>传输</th>
                <th className="cap-num">工具</th>
                <th className="cap-sm-hide">出站</th>
                <th className="cap-num cap-sm-hide">7 天调用</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {serverRows.map((row) => (
                <tr key={row.key} data-testid="cap-server-row">
                  <td className="cap-mono">{row.name ?? DASH}</td>
                  <td className="cap-mut">{row.transport ?? DASH}</td>
                  <td className="cap-num">{row.tools ?? DASH}</td>
                  <td className="cap-mut cap-sm-hide">{row.outbound ?? DASH}</td>
                  <td className="cap-num cap-sm-hide" title="MCP 清单没有按 7 天窗口回传调用数">
                    {DASH}
                  </td>
                  <td>
                    {row.status ? (
                      <Pill tone={row.status === "已连接" ? "ok" : row.status === "已停用" ? "mut" : "warn"}>
                        {row.status}
                      </Pill>
                    ) : (
                      <span className="cap-mut">{DASH}</span>
                    )}
                  </td>
                </tr>
              ))}
              {serverRows.length === 0 ? (
                <GapRow colSpan={6}>
                  {gapText(servers.read, "正在读取 MCP 服务器…", "MCP 服务器清单是空的（真零）")}
                </GapRow>
              ) : null}
            </tbody>
          </table>
        </div>
        <CardFoot
          note="关掉的工具在员工侧不可见；出站范围需逐条登记"
          right={serverCount === null ? DASH : `${serverCount} 个服务器`}
        />
      </ConsoleCard>

      <div className="cap-g2">
        {/* 3 待授权 */}
        <ConsoleCard label="接入待授权" action={<span className="cap-action">请求队列</span>}>
          <GapNote>缺读口：接入请求队列未接线，这里没有待批的服务器、出站范围或请求人。</GapNote>
        </ConsoleCard>

        {/* 4 命名冲突 */}
        <ConsoleCard label="工具命名冲突" action={<span className="cap-action">按服务器:工具</span>}>
          <GapNote>缺读口：冲突检测依赖服务器工具清单，本控制台读不到这份清单。</GapNote>
          <p className="cap-para">
            员工侧按「服务器:工具」命名；控制台展示短名时需带来源，否则排查会串。
          </p>
        </ConsoleCard>
      </div>
    </div>
  );
}