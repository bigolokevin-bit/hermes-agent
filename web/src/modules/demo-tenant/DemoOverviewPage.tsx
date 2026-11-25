/**
 * 示例租户总览页（2026-11-24 owner 硬裁定）。
 *
 * 为什么存在：真租户 /overview 只许显示真读数（缺读口一律「—」，禁止任何
 * 示例数字）。设计骨架那种「稠密信息」必须活在**另一个独立的、长得一模一样的
 * 示例租户页**上。本文件即那一个页面：数据只来自 ./dataset.ts，渲染与骨架
 * 总览同构的 11 块（三卡 + 三细条 + 趋势 + 热力 + 三列表卡），页面顶部挂
 * 显式「示例租户」徽章，卡头标「示例数据」，页脚写明与真实租户完全隔离。
 *
 * 隔离契约：
 *   - 真页（modules/overview/**）不得 import 本模块或 ./dataset.ts；
 *   - 本页不做任何网络请求，不读 duty/fixtures，不写 data-fixture；
 *   - 样式复用 ../overview/overview.css 的 .ov5-* 类名（只读引用，不改它），
 *     页面独有的 5 处形制补在 ./demo-tenant.css（均以 dt5- 前缀）。
 */
import { useState, type ReactNode } from 'react';
import {
  Activity,
  BookOpen,
  ChartLine,
  Clock,
  Coins,
  Download,
  Gauge,
  Rocket,
  Search,
  Send,
  ShieldCheck,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { Badge } from '@nous-research/ui/ui/components/badge';
import { Button } from '@nous-research/ui/ui/components/button';
import { Card, CardContent } from '@nous-research/ui/ui/components/card';

import { TrendCurve } from '@/components/charts/TrendCurve';

import { DEMO_TENANT_AS_OF, DEMO_TENANT_LABEL, demoOverview } from './dataset';
import '../overview/overview.css';
import './demo-tenant.css';

/* ------------------------------------------------------------------ *
 * 格式化（只做显示，不派生新业务数值）
 * ------------------------------------------------------------------ */

/** 12.4 → $12.40；40 → $40；1140 → $1,140。 */
function money(amount: number): string {
  const body = Number.isInteger(amount)
    ? amount.toLocaleString('en-US')
    : amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `$${body}`;
}

/** 0.31 → 31%；0.268 → 26.8%；0.028 → 2.8%。 */
function percent(share: number): string {
  const value = Math.round(share * 1000) / 10;
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}%`;
}

/** 示例数据统一标注：每张卡头右侧的弱色来源位。 */
function DemoSource() {
  return <span className="ov5-source">示例数据</span>;
}

/** 示例页的假动作位：形制像链接，但不导航、不触发任何真实动作。 */
function MuteLink({ children }: { children: ReactNode }) {
  return (
    <span className="dt5-link" aria-disabled="true" title="示例租户：此处不跳转、不触发真实动作">
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * KPI 卡壳：与真页 ov5-kpi 同构（11px 微标签卡头 / 26px 等宽大字 / 一行口径）
 * ------------------------------------------------------------------ */
function DemoKpi({
  title,
  meta,
  value,
  unit,
  foot,
  icon,
  testid,
  children,
}: {
  title: string;
  meta?: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  foot?: ReactNode;
  icon: ReactNode;
  testid: string;
  children?: ReactNode;
}) {
  return (
    <Card className="ov5-kpi" data-testid={testid}>
      <CardContent className="ov5-kpi-bd">
        <div className="ov5-kpi-hd">
          <h2 className="ov5-kpi-title">
            {icon}
            <span>{title}</span>
          </h2>
          {meta ? <span className="ov5-kpi-meta">{meta}</span> : null}
          <DemoSource />
        </div>
        <div className="ov5-kr">
          <div className="ov5-kpi-value">{value}</div>
          {unit ? <em className="ov5-unit">{unit}</em> : null}
        </div>
        {foot ? <p className="ov5-kpi-foot">{foot}</p> : null}
        {children}
        <div className="ov5-kpi-footline">
          <span className="ov5-note">示例数据 · 不参与真实统计</span>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * ③ 可上岗：12/18 + 受限分解 + 四门表（V1/V2/V3/V6）+ 堆叠条 + 图例
 * ------------------------------------------------------------------ */
function ReadyCard() {
  const readiness = demoOverview.readiness;
  const denom = readiness.total;
  const gateState = (passed: number, total: number): 'ok' | 'warn' | 'bad' => {
    const ratio = total === 0 ? 0 : passed / total;
    if (ratio >= 0.8) return 'ok';
    return ratio >= 0.7 ? 'warn' : 'bad';
  };
  const narrowest = readiness.gates.reduce(
    (worst, gate) => (gate.missing > worst.missing ? gate : worst),
    readiness.gates[0],
  );
  const share = (count: number) => Math.round((count / denom) * 1000) / 10;
  const restrictedText = readiness.restrictedBreakdown
    .map((item) => `${item.reason} ${item.count}`)
    .join(' · ');

  return (
    <DemoKpi
      title="可上岗"
      meta={`${denom} 名 · 四门取交集`}
      value={readiness.ready}
      unit={`/ ${denom} 可上岗`}
      foot={
        <>
          受限 <b>{readiness.restricted}</b>：{restrictedText} · 停用 <b>{readiness.disabled}</b>
        </>
      }
      icon={<Users className="ov5-i ov5-i-13" />}
      testid="dt5-ready"
    >
      <div className="ov5-gline">
        <span>各门独立通过</span>
        <span>/ {denom} 人</span>
      </div>
      <div className="ov5-gates">
        {readiness.gates.map((gate) => (
          <div className={`ov5-gate${gate.id === narrowest.id ? ' is-narrow' : ''}`} key={gate.id}>
            <span className="ov5-gk">
              {gate.id} {gate.label}
              {gate.id === narrowest.id ? <span className="ov5-gtag">最窄</span> : null}
            </span>
            <span className="ov5-gv">
              {gate.passed} / {gate.total}
            </span>
            <span className="ov5-gcut">未达 {gate.missing}</span>
            <i className={`ov5-gdot ${gateState(gate.passed, gate.total)}`} title={`${gate.label}：未达 ${gate.missing} 人`} />
          </div>
        ))}
      </div>
      <div className="ov5-hnarrow">
        <b>四门交集 {readiness.ready} 人可上岗</b>
        <span className="ov5-hsep">·</span>
        最窄门 {narrowest.label} · {narrowest.missing} 人未达
      </div>
      <div className="ov5-stack">
        <svg className="ov5-stack-svg" viewBox="0 0 100 6" preserveAspectRatio="none" role="img" aria-label="可上岗 / 受限 / 停用占比">
          <rect className="ok" x={0} y={0} width={share(readiness.ready)} height={6} />
          <rect className="warn" x={share(readiness.ready)} y={0} width={share(readiness.restricted)} height={6} />
          <rect
            className="bad"
            x={share(readiness.ready) + share(readiness.restricted)}
            y={0}
            width={share(readiness.disabled)}
            height={6}
          />
        </svg>
        <div className="ov5-legend">
          <span>
            <i className="ok" />
            {readiness.ready} 可上岗
          </span>
          <span>
            <i className="warn" />
            {readiness.restricted} 受限
          </span>
          <span>
            <i className="bad" />
            {readiness.disabled} 停用
          </span>
          <span className="ov5-legend-note">四门各自独立判定后再取交集</span>
        </div>
      </div>
    </DemoKpi>
  );
}

/* ------------------------------------------------------------------ *
 * ④ 今日运行：58 次 / 在跑 7 / 已运行 15 人 / 失败 2 / 429 占一半 + run 行
 * ------------------------------------------------------------------ */
function TodayRunsCard() {
  const runs = demoOverview.todayRuns;
  return (
    <DemoKpi
      title="今日运行"
      meta={<MuteLink>运行记录 →</MuteLink>}
      value={runs.total}
      unit="次"
      foot={
        <>
          在跑 <b>{runs.inFlight}</b> · 已运行 <b>{runs.employeesRan}</b> 人 · 失败 <b>{runs.failed}</b> ·{' '}
          {runs.throttledShare}
        </>
      }
      icon={<Gauge className="ov5-i ov5-i-13" />}
      testid="dt5-runs"
    >
      <div className="ov5-hlist">
        {runs.inFlightRows.map((run) => (
          <div className="ov5-hrow" key={run.runId}>
            <span className="ov5-pill info">在跑</span>
            <span className="ov5-ht" title={run.runId}>
              {run.runId} · {run.employee}
            </span>
            <span className="ov5-hm">{run.elapsed}</span>
          </div>
        ))}
        {runs.failedRows.map((run) => (
          <div className="ov5-hrow" key={run.runId}>
            <span className="ov5-pill bad">失败</span>
            <span className="ov5-ht" title={run.runId}>
              {run.runId} · {run.reason}
            </span>
            <span className="ov5-hm">{run.at}</span>
          </div>
        ))}
      </div>
    </DemoKpi>
  );
}

/* ------------------------------------------------------------------ *
 * ⑤ 今日成本：$12.40/$40 · 31% · 本月 $214.80/$800 · 预估 $358
 *    日上限 $57 · 月配额 $1,140 · 顾南 29% · 浪费 $6.10 · 2.8%
 * ------------------------------------------------------------------ */
function CostCard() {
  const cost = demoOverview.cost;
  return (
    <DemoKpi
      title="今日成本"
      meta={<MuteLink>成本账本 →</MuteLink>}
      value={money(cost.todayUsd)}
      unit={`/ ${money(cost.dailyCapUsd)} 全局上限`}
      foot={
        <>
          已用 <b>{percent(cost.usedShare)}</b> · 本月 <b>{money(cost.monthUsd)}</b> /{' '}
          <b>{money(cost.monthQuotaUsd)}</b> · 预估月底 <b>{money(cost.forecastMonthUsd)}</b>
        </>
      }
      icon={<Coins className="ov5-i ov5-i-13" />}
      testid="dt5-cost"
    >
      <div className="ov5-hlist">
        <div className="ov5-hrow">
          <span className="ov5-ht">日上限合计</span>
          <span className="ov5-hm">{money(cost.dailyCapsTotalUsd)}</span>
        </div>
        <div className="ov5-hrow">
          <span className="ov5-ht">月配额合计</span>
          <span className="ov5-hm">{money(cost.monthlyQuotasTotalUsd)}</span>
        </div>
        <div className="ov5-hrow">
          <span className="ov5-ht">{cost.topSpender.employee}占今日</span>
          <span className="ov5-hm">{percent(cost.topSpender.share)}</span>
        </div>
        <div className="ov5-hrow">
          <span className="ov5-ht">浪费（失败与重试）</span>
          <span className="ov5-hm">
            {money(cost.waste.todayUsd)} · 本月 {percent(cost.waste.monthShare)}
          </span>
        </div>
      </div>
    </DemoKpi>
  );
}

/* ------------------------------------------------------------------ *
 * ⑥ 三条 44px 细长条：发布 / 出站（含 app_id 一致第二行）/ 账本
 * ------------------------------------------------------------------ */
function ChainStrip() {
  const [release, outbound, ledger] = demoOverview.chains;
  return (
    <div className="ov5-chainstrip">
      <div className="ov5-cs" data-testid="dt5-chain-release">
        <span className="ov5-cs-k">
          <Rocket className="ov5-i ov5-i-13" />
          发布
        </span>
        <span className="ov5-cs-v">
          {release.facts.map((fact, index) => (
            <span key={fact}>
              {index > 0 ? ' · ' : null}
              {fact}
            </span>
          ))}
        </span>
        <span className="ov5-cs-go">→</span>
      </div>
      <div className="ov5-cs" data-testid="dt5-chain-outbound">
        <span className="ov5-cs-k">
          <Send className="ov5-i ov5-i-13" />
          出站
        </span>
        <span className="ov5-cs-v dt5-cs-stack">
          <span>
            {outbound.facts.map((fact, index) => (
              <span key={fact}>
                {index > 0 ? ' · ' : null}
                {fact}
              </span>
            ))}
          </span>
          <span className="dt5-cs-sub">{outbound.subline}</span>
        </span>
        <span className="ov5-cs-go">→</span>
      </div>
      <div className="ov5-cs" data-testid="dt5-chain-ledger">
        <span className="ov5-cs-k">
          <BookOpen className="ov5-i ov5-i-13" />
          账本
        </span>
        <span className="ov5-cs-v dt5-cs-wrap">
          {ledger.facts.map((fact, index) => (
            <span key={fact}>
              {index > 0 ? ' · ' : null}
              {fact}
            </span>
          ))}
        </span>
        <span className="ov5-cs-go">→</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * ⑦ 近 14 天运行：平滑曲线 + 面积渐变，峰值虚线 + 标注，y 0/30/60，x 三标
 * ------------------------------------------------------------------ */
const TREND_H = 148;
const TREND_Y_MAX = 60;

function TrendBlock() {
  const trend = demoOverview.trend;
  const points = trend.points;

  return (
    <Card className="ov5-block ov5-trend" data-testid="dt5-trend">
      <CardContent className="ov5-block-bd">
        <div className="ov5-block-hd">
          <h2>
            <ChartLine className="ov5-i ov5-i-16" />
            近 14 天运行趋势
          </h2>
          <DemoSource />
        </div>
        <div className="ov5-hnum">
          <span className="ov5-hnum-v">{trend.total}</span>
          <em>次 · 峰值 {trend.peak}</em>
        </div>
        <p className="ov5-hsay">
          日均 <b>{trend.dailyAvg}</b> 次 · 峰值日 <b>{trend.peakDay}</b> · 覆盖 <b>{points.length}</b> 天
        </p>
        <div className="ov5-chart">
          <TrendCurve
            points={points.map((point) => ({ label: point.day, y: point.runs }))}
            height={TREND_H}
            pad={{ l: 26, r: 12, t: 16, b: 18 }}
            top={TREND_Y_MAX}
            ariaLabel={`近 14 天运行趋势：合计 ${trend.total} 次，峰值 ${trend.peak} 次（${trend.peakDay}）`}
            peakLabel={(value) => `峰值 ${value}`}
            formatX={(text, index) => (index === points.length - 1 ? '今天' : text)}
          />
        </div>
        <p className="ov5-block-foot">
          面积与曲线表示当日运行次数；峰值日（{trend.peakDay}）以虚线标注。示例数据，不与真实租户合并。
        </p>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * ⑧ 24 小时活跃：09:00 峰值 · 峰值桶 5 · 24 格热力 · 未发生时段斜线
 *    · 图例 0/1–2/3–4/5+ · 现在 14:32 标记 · 脚注「较昨日同时段」
 * ------------------------------------------------------------------ */
function heatLevel(count: number): 0 | 1 | 2 | 3 {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  return 3;
}

function HeatBlock() {
  const heat = demoOverview.heat;
  const nowClock = DEMO_TENANT_AS_OF.slice(-5);
  const peakHour = heat.cells.reduce((best, cell) => (cell.count > best.count ? cell : best), heat.cells[0]);
  const nowLeft = `${(((heat.nowMarkHour + 1) / heat.cells.length) * 100).toFixed(2)}%`;

  return (
    <Card className="ov5-block ov5-heat" data-testid="dt5-heat">
      <CardContent className="ov5-block-bd">
        <div className="ov5-block-hd">
          <h2>
            <Activity className="ov5-i ov5-i-16" />
            24 小时活跃
            <span className="ov5-hd-note">每格 1 小时</span>
          </h2>
          <DemoSource />
        </div>
        <div className="ov5-hnum">
          <span className="ov5-hnum-v">{heat.peakHour}</span>
          <em>峰值时段</em>
        </div>
        <p className="ov5-hsay">
          峰值 <b>{heat.peakBucketCount}</b> 次/时 · 当日 <b>{demoOverview.todayRuns.total}</b> 次 · 斜线为未发生时段
        </p>
        <div className="ov5-heat24">
          <div className="dt5-heatwrap">
            <svg
              className="ov5-heat-svg"
              viewBox="0 0 480 30"
              preserveAspectRatio="none"
              role="img"
              aria-label={`24 小时活跃：峰值 ${heat.peakHour} 共 ${heat.peakBucketCount} 次，未发生时段画斜线`}
            >
              <defs>
                <pattern id="dt5-heat-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-border-subtle-ls)" strokeWidth="1" />
                </pattern>
              </defs>
              {heat.cells.map((cell) =>
                cell.future ? (
                  <rect
                    key={cell.hour}
                    className="ov5-heat-cell dt5-hatch"
                    x={cell.hour * 20 + 0.5}
                    y={0}
                    width={19}
                    height={30}
                    rx={3}
                  >
                    <title>{`${String(cell.hour).padStart(2, '0')}:00 · 未发生时段`}</title>
                  </rect>
                ) : (
                  <rect
                    key={cell.hour}
                    className={`ov5-heat-cell ov5-heat-lv${heatLevel(cell.count)}${
                      cell.hour === peakHour.hour ? ' is-peak' : ''
                    }`}
                    x={cell.hour * 20 + 0.5}
                    y={0}
                    width={19}
                    height={30}
                    rx={3}
                  >
                    <title>{`${String(cell.hour).padStart(2, '0')}:00 · ${cell.count} 次`}</title>
                  </rect>
                ),
              )}
            </svg>
            <span className="dt5-now" style={{ left: nowLeft }}>
              现在 {nowClock}
            </span>
          </div>
          <div className="ov5-heat-axis" aria-hidden="true">
            <span>00</span>
            <span>06</span>
            <span>12</span>
            <span>18</span>
            <span>23</span>
          </div>
        </div>
        <div className="ov5-legend ov5-legend-heat">
          <span>
            <i className="h0" />
            {heat.legend[0]}
          </span>
          <span>
            <i className="h1" />
            {heat.legend[1]}
          </span>
          <span>
            <i className="h2" />
            {heat.legend[2]}
          </span>
          <span>
            <i className="h3" />
            {heat.legend[3]}
          </span>
          <span className="ov5-legend-note">斜线＝未发生时段 · 峰值格描边</span>
        </div>
        <p className="ov5-block-foot">{heat.vsYesterday}</p>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * ⑨ 三列表卡：阻塞 / 待我处理 / 最近运行（行高 36–40px）
 * ------------------------------------------------------------------ */
function BlockersCard() {
  const blockers = demoOverview.blockers;
  return (
    <Card className="ov5-block" data-testid="dt5-blockers">
      <CardContent className="ov5-block-bd">
        <div className="ov5-block-hd">
          <h2>
            <TriangleAlert className="ov5-i ov5-i-16" />
            阻塞
          </h2>
          <MuteLink>查看全部 ({blockers.total}) →</MuteLink>
        </div>
        <p className="dt5-topline">{blockers.topLine}</p>
        <ul className="ov5-rows ov5-rows-blocker">
          {blockers.rows.map((row) => (
            <li key={`${row.kind}-${row.detail}`} className="ov5-blkrow">
              <Badge tone={row.kind === '失败' ? 'destructive' : 'warning'}>{row.kind}</Badge>
              <span className="ov5-bmain">
                <span className="ov5-bline1">{row.detail}</span>
                <span className="ov5-bline2">示例构造项 · 不进入真实处理流</span>
              </span>
              <span className="ov5-hgo" aria-disabled="true" title="示例租户：此处不跳转">
                {row.action}
              </span>
            </li>
          ))}
        </ul>
        <p className="ov5-block-foot ov5-blk-foot">
          失败运行按一组计；示例共 {blockers.total} 项，本卡列出 {blockers.rows.length} 条。
        </p>
      </CardContent>
    </Card>
  );
}

function PendingCard() {
  const todo = demoOverview.myTodo;
  return (
    <Card className="ov5-block" data-testid="dt5-pending">
      <CardContent className="ov5-block-bd">
        <div className="ov5-block-hd">
          <h2>
            <ShieldCheck className="ov5-i ov5-i-16" />
            待我处理
            <span className="ov5-hd-note">待审批</span>
          </h2>
          <MuteLink>查看全部 ({todo.total}) →</MuteLink>
        </div>
        <ul className="ov5-rows">
          {todo.rows.map((row) => (
            <li key={row.title}>
              <span className="ov5-ht" title={`${row.title} · ${row.who}`}>
                {row.title} · {row.who}
              </span>
              <span className="ov5-hm">{row.waited}</span>
            </li>
          ))}
        </ul>
        <div className="ov5-pending-foot">
          <span className="ov5-pending-count">
            待批 <span className="ov5-kpi-value">{todo.total}</span>
          </span>
          <span>其中待我处理 {todo.mine}</span>
          <span>最早 {todo.earliest} 起</span>
        </div>
      </CardContent>
    </Card>
  );
}

function RecentRunsCard() {
  const recent = demoOverview.recentRuns;
  const tone = (status: string) =>
    status === '成功' ? 'success' : status === '失败' ? 'destructive' : 'outline';
  return (
    <Card className="ov5-block" data-testid="dt5-recent">
      <CardContent className="ov5-block-bd">
        <div className="ov5-block-hd">
          <h2>
            <Activity className="ov5-i ov5-i-16" />
            最近运行
          </h2>
          <span className="dt5-version">
            {recent.version} {recent.asOf}
          </span>
        </div>
        <ul className="ov5-rows">
          {recent.rows.map((run) => (
            <li key={run.runId}>
              <span className="ov5-ht" title={run.runId}>
                <span className="dt5-runid">{run.runId}</span> · {run.employee}
              </span>
              <Badge tone={tone(run.status)}>{run.status}</Badge>
              <span className="ov5-hm">{run.duration}</span>
            </li>
          ))}
        </ul>
        <p className="ov5-block-foot">最近 {recent.rows.length} 次 · 示例租户构造运行，详情不进入真实运行记录。</p>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * ② 用量与成本档：诚实占位（示例页只演示总览的信息密度）
 * ------------------------------------------------------------------ */
function UsagePlaceholder({ onBack }: { onBack: () => void }) {
  return (
    <Card className="ov5-block dt5-placeholder" data-testid="dt5-usage-placeholder">
      <CardContent className="ov5-block-bd">
        <div className="ov5-block-hd">
          <h2>
            <Coins className="ov5-i ov5-i-16" />
            用量与成本
          </h2>
          <DemoSource />
        </div>
        <p className="ov5-hsay">
          示例租户页只演示总览这一档的信息密度。用量与成本明细在真实租户页由账本读数承担，本页不重复构造第二套数字。
        </p>
        <div>
          <Button size="sm" outlined onClick={onBack}>
            返回值班台
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * 页面
 * ------------------------------------------------------------------ */
type DemoTab = 'duty' | 'usage';

export function DemoOverviewPage() {
  const [tab, setTab] = useState<DemoTab>('duty');
  const { todayRuns } = demoOverview;

  return (
    <section className="ov5-page" data-testid="dt5-page" aria-label="示例租户运营总览">
      <header className="ov5-head" data-testid="dt5-head">
        <div className="ov5-head-main">
          {/* 外壳 TopBar 已有唯一 <h1>；页面内标题仍用 <p>，与真页同形制。 */}
          <p className="ov5-title">
            运营总览
            <Badge tone="warning" className="dt5-badge" data-testid="dt5-demo-badge">
              {DEMO_TENANT_LABEL}
            </Badge>
          </p>
          <div className="ov5-facts">
            <span className="ov5-fresh">
              <Clock className="ov5-i ov5-i-13" />
              <span>{DEMO_TENANT_AS_OF}</span>
            </span>
            <span className="ov5-fact">
              <b>{demoOverview.readiness.total}</b> 名数字员工
            </span>
            <span className="ov5-fact">
              <b>{todayRuns.inFlight}</b> 个运行在跑
            </span>
            <span className="ov5-fact">构造数据 · 与真实租户完全隔离</span>
          </div>
        </div>
        <div className="ov5-head-actions">
          <Button
            size="sm"
            outlined
            disabled
            title="示例租户页不提供检索（⌘K 不可用）"
            prefix={<Search className="ov5-i ov5-i-14" />}
          >
            搜索 ⌘K
          </Button>
          <Button
            size="sm"
            outlined
            disabled
            title="示例租户页不导出日报"
            prefix={<Download className="ov5-i ov5-i-14" />}
          >
            导出日报
          </Button>
        </div>
      </header>

      <nav className="ov5-seg dt5-tabs" role="tablist" aria-label="总览标签页" data-testid="dt5-tabs">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'duty'}
          className={tab === 'duty' ? 'ov5-seg-btn is-active' : 'ov5-seg-btn'}
          onClick={() => setTab('duty')}
        >
          值班台
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'usage'}
          className={tab === 'usage' ? 'ov5-seg-btn is-active' : 'ov5-seg-btn'}
          onClick={() => setTab('usage')}
        >
          用量与成本
        </button>
      </nav>

      {tab === 'usage' ? (
        <UsagePlaceholder onBack={() => setTab('duty')} />
      ) : (
        <>
          <div className="ov5-homegrid r3">
            <ReadyCard />
            <TodayRunsCard />
            <CostCard />
          </div>

          <ChainStrip />

          <div className="ov5-homegrid r2">
            <TrendBlock />
            <HeatBlock />
          </div>

          <div className="ov5-homegrid r3">
            <BlockersCard />
            <PendingCard />
            <RecentRunsCard />
          </div>
        </>
      )}

      <footer className="ov5-pagefoot" data-testid="dt5-foot">
        <span>
          {demoOverview.footer.note} · 更新 {demoOverview.footer.asOf} {demoOverview.footer.owner}
        </span>
      </footer>
    </section>
  );
}

export default DemoOverviewPage;