// 能力与接入 · 平台接入（骨架 #/capabilities?tab=channels）
//
// 骨架 7 块：说明条 / 平台凭据 / 平台状态(6 块瓷片) / 凭证明细 / 可接入的渠道 /
// 发送门 / 熔断 / 最近拦截明细。本页 7 张卡都在，瓷片只画网关真实报上来的平台。
//
// 唯一的真读口是网关自己的运行摘要：它报平台名、连接状态与网关状态更新时刻。
// 凭证、限流、逐条调用时刻、拦截明细都没有读口，一律「—」+ 卡底写明。
import { Link } from "react-router";
import { ConsoleCard } from "@/components/console/ConsoleCard";
import { Pill } from "@/components/console/Pill";
import { CardFoot, GapNote, GapRow, PaneHead } from "./PaneBits";
import { DASH, beijingMinute, count, gapText, recordOf, textOf, usePort } from "./paneApi";

type Platform = { key: string; name: string; connected: boolean | null; attention: boolean | null };
type Gateway = {
  platforms: Platform[];
  updatedAt: string | null;
  state: string | null;
};

const PLATFORM_LABEL: Record<string, string> = {
  api_server: "API 服务",
  feishu: "飞书",
  lark: "飞书",
  telegram: "Telegram",
  slack: "Slack",
  whatsapp: "WhatsApp",
  discord: "Discord",
  email: "Email",
  matrix: "Matrix",
  dingtalk: "钉钉",
  teams: "Microsoft Teams",
};

function parseGateway(body: unknown): Gateway | null {
  const root = recordOf(body);
  const gateway = recordOf(root.gateway);
  const platforms = recordOf(gateway.platforms);
  if (platforms === null || Object.keys(platforms).length === 0) {
    // 网关没有报平台也算读到了：平台清单为空是真零，不是解析失败。
    if (body === null) return null;
    return { platforms: [], updatedAt: textOf(gateway.updated_at), state: textOf(gateway.state) };
  }
  const rows = Object.entries(platforms).map(([key, value]) => {
    const entry = recordOf(value);
    const state = (textOf(entry.state) ?? "").toLowerCase();
    return {
      key,
      name: PLATFORM_LABEL[key.toLowerCase()] ?? key,
      connected: state === "connected" || state === "ok" || state === "running" ? true : state ? false : null,
      attention: entry.needs_attention === true ? true : entry.needs_attention === false ? false : null,
    };
  });
  return { platforms: rows, updatedAt: textOf(gateway.updated_at), state: textOf(gateway.state) };
}

function emptyGateway(data: Gateway): boolean {
  return data.platforms.length === 0;
}

export function CapChannelsPane() {
  const gateway = usePort("/api/hermes-summary", parseGateway, emptyGateway);
  const data = gateway.read.k === "ready" ? gateway.read.data : null;
  const grounded = gateway.read.k === "ready" || gateway.read.k === "empty";
  const platforms = data?.platforms ?? [];
  const connected = grounded ? platforms.filter((p) => p.connected === true).length : null;
  const updated = beijingMinute(data?.updatedAt ?? null);

  return (
    <div className="cap-pane" data-testid="cap-channels">
      <PaneHead
        sub="网关级凭证与运行状态 · 员工侧绑定在「员工配置 · 通信与身份」"
        readout={
          grounded
            ? `平台 ${count(platforms.length)} · 已连接 ${count(connected)}`
            : `平台 ${DASH} · 已连接 ${DASH}`
        }
        readoutTitle="网关运行摘要里的平台连接读数"
      />

      {/* 1 说明条 */}
      <ConsoleCard>
        <div className="cap-inline">
          <span className="cap-note">渠道绑定在员工配置中维护，这里只管平台凭证与运行状态。</span>
          <span className="cap-grow" />
          <Link className="cap-link" to="/employees">
            去员工列表 →
          </Link>
        </div>
      </ConsoleCard>

      {/* 2 平台凭据（网关级） */}
      <ConsoleCard label="平台凭据" action={<span className="cap-action">网关级 · 员工侧不持有</span>}>
        <div className="cap-kv">
          <span className="cap-k">App ID</span>
          <span className="cap-v cap-mono" title="网关级应用凭据没有读口">
            {DASH}
          </span>
          <span className="cap-k">App Secret</span>
          <span className="cap-v cap-mono" title="密钥只在密钥库里，页面不返回明文，也没有读口">
            {DASH}
          </span>
          <span className="cap-k">全局发送开关</span>
          <span className="cap-v" title="全局发送开关没有读口">
            {DASH}
          </span>
          <span className="cap-k">限流</span>
          <span className="cap-v cap-mono" title="平台限流没有读口">
            {DASH}
          </span>
        </div>
        <CardFoot note="缺读口：网关级凭证与发送开关未接线" right={DASH} />
      </ConsoleCard>

      {/* 3 平台状态瓷片 */}
      <div className="cap-tiles">
        {platforms.map((platform) => (
          <div className="cap-tile" key={platform.key}>
            <div className="cap-tile-head">
              <span className="cap-tile-name">{platform.name}</span>
              {platform.connected === true ? (
                <Pill tone="ok">已连接</Pill>
              ) : platform.connected === false ? (
                <Pill tone="warn">未连接</Pill>
              ) : (
                <Pill tone="mut">待核实</Pill>
              )}
            </div>
            <div className="cap-inline">
              <span className="cap-note">网关状态更新</span>
              <span className="cap-grow" />
              <span className="cap-mono cap-mut">{updated}</span>
            </div>
            <div className="cap-inline">
              <span className="cap-note">24h 消息</span>
              <span className="cap-grow" />
              <span className="cap-mono cap-mut" title="网关只报进程启动后的当日计数，不按平台拆分">
                {DASH}
              </span>
            </div>
          </div>
        ))}
        {platforms.length === 0 ? (
          <div className="cap-tile">
            <div className="cap-tile-head">
              <span className="cap-tile-name">平台</span>
              <Pill tone="mut">待核实</Pill>
            </div>
            <p className="cap-para">
              {gapText(gateway.read, "正在读取网关运行摘要…", "网关没有报出任何平台（真零）")}
            </p>
          </div>
        ) : null}
      </div>

      {/* 4 凭证明细 */}
      <ConsoleCard label="凭证明细" action={<span className="cap-action">密钥只显示末四位</span>} flush>
        <div className="cap-tw">
          <table className="cap-t">
            <thead>
              <tr>
                <th>平台</th>
                <th>凭证</th>
                <th>模式</th>
                <th className="cap-num cap-sm-hide">限流 / 分钟</th>
                <th>最近调用</th>
                <th className="cap-num">操作</th>
              </tr>
            </thead>
            <tbody>
              {platforms.map((platform) => (
                <tr key={platform.key} data-testid="cap-channel-row">
                  <td>{platform.name}</td>
                  <td className="cap-mono cap-mut" title="凭证没有读口，本页也不返回明文">
                    {DASH}
                  </td>
                  <td className="cap-mut">{DASH}</td>
                  <td className="cap-num cap-sm-hide">{DASH}</td>
                  <td>
                    <Pill tone={platform.connected === true ? "ok" : platform.connected === false ? "warn" : "mut"}>
                      {platform.connected === true ? "已连接" : platform.connected === false ? "未连接" : "待核实"}
                    </Pill>
                  </td>
                  <td className="cap-num cap-mut">{DASH}</td>
                </tr>
              ))}
              {platforms.length === 0 ? (
                <GapRow colSpan={6}>
                  {gapText(gateway.read, "正在读取平台清单…", "网关没有报出任何平台（真零）")}
                </GapRow>
              ) : null}
            </tbody>
          </table>
        </div>
        <CardFoot
          note="凭证、模式、限流与逐条调用时刻都没有读口；连接状态来自网关运行摘要"
          right={grounded ? `${count(connected)} / ${count(platforms.length)} 已连接` : DASH}
        />
      </ConsoleCard>

      {/* 5 可接入的渠道 */}
      <ConsoleCard label="可接入的渠道" action={<span className="cap-action">需管理员开通</span>}>
        <GapNote>缺读口：可接入渠道目录未接线，这里没有列出可开通的平台与其准入条件。</GapNote>
        <p className="cap-para">接入后仍需在「员工身份绑定」里绑定账号，凭证本身不绑定员工。</p>
      </ConsoleCard>

      <div className="cap-g2">
        {/* 6 发送门 */}
        <ConsoleCard label="发送门" action={<Pill tone="warn">人工确认</Pill>}>
          <GapNote>缺读口：放行、拦截与超时退回都没有读口，这一块不显示任何次数。</GapNote>
        </ConsoleCard>

        {/* 7 熔断 */}
        <ConsoleCard label="熔断" action={<Pill tone="mut">待核实</Pill>}>
          <GapNote>缺读口：熔断状态、冷却与恢复策略未接线，本页不写「已触发」或「未触发」。</GapNote>
        </ConsoleCard>
      </div>

      {/* 8 最近拦截明细（骨架：发送状态段下的表） */}
      <ConsoleCard label="最近拦截明细" action={<span className="cap-action">近 24 小时</span>} flush>
        <div className="cap-tw">
          <table className="cap-t">
            <thead>
              <tr>
                <th className="cap-num">时间</th>
                <th>员工</th>
                <th>动作</th>
                <th>对象</th>
                <th>原因</th>
                <th>结果</th>
              </tr>
            </thead>
            <tbody>
              <GapRow colSpan={6}>缺读口：拦截台账未接线；审批与运行证据在「审批」与「运行」两页。</GapRow>
            </tbody>
          </table>
        </div>
        <CardFoot
          note="审批与拦截明细另有两处入口"
          right="审批 · 运行"
        />
      </ConsoleCard>
    </div>
  );
}