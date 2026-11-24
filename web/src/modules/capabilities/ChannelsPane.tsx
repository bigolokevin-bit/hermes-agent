// 能力与接入 · 平台接入（骨架 #/capabilities?tab=channels）
//
// 骨架 7 块 + 瓷片区：说明条 / 平台凭据 / 平台状态(瓷片) / 凭证明细 / 可接入的渠道 /
// 发送门 / 熔断 / 最近拦截明细。
//
// 读口真相（2026-11-24 实测）：唯一真读口是网关运行摘要 —— 平台名、连接状态、
// 状态更新时刻、网关级当日计数（进程启动后计数，不按平台拆分）。凭证、模式、限流、
// 逐平台消息数与调用时刻、渠道目录、发送门计数、熔断状态、拦截台账都没有读口。
// 规则：整列/整行无读口就不画，缺失只在卡底「数据可用性」声明一次，正文只留「—」；
// 一行真读数都没有的表保留骨架表头 + 一行声明，不把整表抹掉。
import { Link } from "react-router";
import { ConsoleCard } from "@/components/console/ConsoleCard";
import { Pill } from "@/components/console/Pill";
import { GapRow, PaneHead, cardLabel } from "./PaneBits";
import { DASH, beijingMinute, count, gapText, recordOf, textOf, usePort } from "./paneApi";

type Platform = { key: string; name: string; connected: boolean | null };
type Gateway = {
  platforms: Platform[];
  updatedAt: string | null;
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
    return { platforms: [], updatedAt: textOf(gateway.updated_at) };
  }
  const rows = Object.entries(platforms).map(([key, value]) => {
    const entry = recordOf(value);
    const state = (textOf(entry.state) ?? "").toLowerCase();
    return {
      key,
      name: PLATFORM_LABEL[key.toLowerCase()] ?? key,
      connected: state === "connected" || state === "ok" || state === "running" ? true : state ? false : null,
    };
  });
  return { platforms: rows, updatedAt: textOf(gateway.updated_at) };
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
        showNative={false}
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

      {/* 2 平台凭据（网关级）：四项都没有读口，整卡一行「—」，缺的项在卡底点名 */}
      <ConsoleCard
        label={cardLabel("平台凭据")}
        action={<span className="cap-action">网关级 · 员工侧不持有</span>}
        availability={[
          { label: "App ID" },
          { label: "App Secret" },
          { label: "全局发送开关" },
          { label: "限流" },
        ]}
        note="网关级凭证与开关不在本控制台的读口范围，页面也不返回任何明文"
      >
        <p className="cap-dash">—</p>
      </ConsoleCard>

      {/* 3 平台状态瓷片：只画网关真报上来的平台 */}
      <div className="cap-tiles" data-testid="cap-channel-tiles">
        {platforms.map((platform) => (
          <div className="cap-tile" key={platform.key} data-testid="cap-channel-row">
            <div className="cap-tile-head">
              <span className="cap-tile-name">{platform.name}</span>
              {platform.connected === true ? (
                <Pill tone="ok">已连接</Pill>
              ) : platform.connected === false ? (
                <Pill tone="warn">未连接</Pill>
              ) : (
                <Pill tone="mut">状态未知</Pill>
              )}
            </div>
            <div className="cap-inline">
              <span className="cap-note">网关状态更新</span>
              <span className="cap-grow" />
              <span className="cap-mono cap-mut">{updated}</span>
            </div>
          </div>
        ))}
        {platforms.length === 0 ? (
          <div className="cap-tile">
            <div className="cap-tile-head">
              <span className="cap-tile-name">平台</span>
            </div>
            <p className="cap-para">
              {gapText(gateway.read, "正在读取网关运行摘要…", "网关没有报出任何平台（真零）")}
            </p>
          </div>
        ) : null}
      </div>

      {/* 4 凭证明细：除平台名外整列无读口，保留骨架表头 + 一行声明 */}
      <ConsoleCard
        label={cardLabel("凭证明细")}
        action={
          <span className="cap-action">
            {grounded ? `${count(connected)} / ${count(platforms.length)} 已连接` : "已连接读数无"}
          </span>
        }
        flush
        availability={[
          { label: "列「凭证」", reason: "页面不返回明文，也没有末四位读数" },
          { label: "列「模式」" },
          { label: "列「限流 / 分钟」" },
          { label: "列「最近调用」", reason: "网关只报全局当日计数，不按平台拆消息数与回调时刻" },
          { label: "列「操作」", reason: "轮换与验证写口未开放" },
        ]}
        note="已连接平台与状态见上方瓷片；连接状态来自网关运行摘要"
      >
        <div className="cap-tw">
          <table className="cap-t">
            <thead>
              <tr>
                <th>平台</th>
                <th>凭证</th>
                <th>模式</th>
                <th className="cap-num cap-sm-hide">限流 / 分钟</th>
                <th>最近调用</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <GapRow colSpan={6}>
                {gateway.read.k === "loading"
                  ? "正在读取网关运行摘要…"
                  : grounded
                    ? "凭证、模式、限流与调用时刻都没有读口，本表没有可填真读数的行。"
                    : gapText(gateway.read, "正在读取网关运行摘要…", "网关没有报出任何平台（真零）")}
              </GapRow>
            </tbody>
          </table>
        </div>
      </ConsoleCard>

      {/* 5 可接入的渠道 */}
      <ConsoleCard
        label={cardLabel("可接入的渠道")}
        action={<span className="cap-action">需管理员开通</span>}
        availability={[{ label: "渠道目录", reason: "可开通平台与其准入条件没有读口" }]}
      >
        <p className="cap-dash">—</p>
        <p className="cap-para">接入后仍需在「员工身份绑定」里绑定账号，凭证本身不绑定员工。</p>
      </ConsoleCard>

      <div className="cap-g2">
        {/* 6 发送门 */}
        <ConsoleCard
          label={cardLabel("发送门")}
          action={<span className="cap-action">全部对外消息</span>}
          availability={[
            { label: "放行计数" },
            { label: "拦截计数" },
            { label: "超时退回计数" },
            { label: "管理员代发开关", reason: "写口未开放" },
          ]}
        >
          <p className="cap-dash">—</p>
        </ConsoleCard>

        {/* 7 熔断 */}
        <ConsoleCard
          label={cardLabel("熔断")}
          availability={[
            { label: "熔断状态与触发史" },
            { label: "冷却与恢复策略", reason: "阈值未经证，不写触发与否" },
          ]}
        >
          <p className="cap-dash">—</p>
        </ConsoleCard>
      </div>

      {/* 8 最近拦截明细（骨架：发送状态段下的表）：整表无读口，保留骨架表头 + 一行声明 */}
      <ConsoleCard
        label={cardLabel("最近拦截明细")}
        action={<span className="cap-action">近 24 小时</span>}
        flush
        availability={[{ label: "拦截台账", reason: "拦截事件清单没有读口" }]}
        note={
          <span className="cap-inline">
            <span className="cap-note">审批与拦截明细另有两处入口</span>
            <Link className="cap-link" to="/approvals">
              审批与发布门 →
            </Link>
            <Link className="cap-link" to="/work?tab=runs">
              运行证据 →
            </Link>
          </span>
        }
      >
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
              <GapRow colSpan={6}>拦截台账没有读口，本表没有可填真读数的行。</GapRow>
            </tbody>
          </table>
        </div>
      </ConsoleCard>
    </div>
  );
}
