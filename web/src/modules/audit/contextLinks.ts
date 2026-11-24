/**
 * AU-01 — where the context of an audit event actually lives.
 *
 * The record pane shows WHO did it, on WHICH run, against WHICH policy decision.
 * This table decides, for each of those three chains, whether there is a page to
 * jump to — one table for the pane, so the screen cannot offer two different
 * truths about where a thing lives.
 *
 * 禁死链 — same discipline as `resourceLinks.ts`: every href below was read out
 * of the routing before it was written here, and the hit line is kept next to
 * the entry it proves (line numbers as of base db793b7b10):
 *   /employees/<id>  App.tsx:1376 (`path="/employees/:employeeId"`)
 *                    + App.tsx:361 (`"/employees/:employeeId": EmployeeDetailPage`)
 *   /identity?tab=people
 *                    App.tsx:1226 (`/identity` → AdminsAwareIdentity →
 *                    live slot people: <PeopleConsolePage />)
 *                    + PeopleModulePage.tsx:491 「Q12：行打开页内详情（零路由）」
 *                      ⇒ 名录没有指向单人的地址参数，链只能到名录，不到人 —
 *                      这句话写进 title，不假装能定位。
 *   /runs?run=<id>   RunsModulePage.tsx:1104 (`params.get("run") ?? pathRun`)
 *                    + resourceLinks.ts 头部既有证明（run 行同一条读口）。
 *   策略判定         无落点：BFF 读口 P4 `/v1/policy/decisions/{id}` 存在但
 *                    「无控制台页面消费」「是否上屏待参谋裁定」
 *                    （apps/console/BFF-ROUTE-MATRIX.md 缺口 #2，主仓）⇒
 *                    有值就说有值，页面没有就说不给跳，不造链。
 *
 * Values are read off what the model already built (`detail.actor`,
 * `detail.links`) — never a second parse of the raw answer, so an event cannot
 * print one short code in the 关联行 and another in the 链位.
 */
import type { AuditLink, Person } from "./model";

/** 机器主体（system/service/…）在人页里没有条目。 */
const MACHINE_KINDS = new Set(["system", "service", "internal", "worker"]);
const EMPLOYEE_KINDS = new Set(["employee", "agent", "bot"]);
const MEMBER_KINDS = new Set(["human", "user", "member", "staff"]);

export const AUDIT_CHAIN_UNRELATED_TEXT = "无关联";
export const AUDIT_CHAIN_NO_PAGE_TEXT = "本控制台没有该页面";

export type AuditChain =
  /** 有页面、有编号：真链接。 */
  | { kind: "link"; href: string; label: string; title: string }
  /** 事件带回了关联值，但本控制台没有能承载它的页面：说值，不给链。 */
  | { kind: "no-page"; label: string; title: string }
  /** 事件没有带回该关联字段：如实「无关联」，不拿别的字段凑。 */
  | { kind: "unrelated"; title: string };

export interface AuditChains {
  actor: AuditChain;
  run: AuditChain;
  decision: AuditChain;
}

/** 「employee:8812」/「emp_01H…」→ 路由要的裸编号；带 scheme 分隔符取末段。 */
function plainId(raw: string): string {
  const m = /^[A-Za-z]+[:=/]([\w.-]+)$/.exec(raw.trim());
  return (m ? m[1] : raw).trim();
}

function linkNoun(links: readonly AuditLink[], noun: string): AuditLink | null {
  return links.find((l) => l.noun === noun) ?? null;
}

/** 谁 → 身份页：员工有详情路由就点到条；成员只到名录（零路由钉在 title）；
 *  机器主体明说不链；没有 actor 值就是无关联。 */
export function actorChainOf(actor: Person): AuditChain {
  const kind = (actor.kind ?? "").trim().toLowerCase();
  const id = actor.raw ? plainId(actor.raw) : "";
  if (!id && kind === "") {
    return {
      kind: "unrelated",
      title: "这条事件没有带回操作者编号，链位不拿名字凑。",
    };
  }
  if (EMPLOYEE_KINDS.has(kind) && id) {
    return {
      kind: "link",
      href: `/employees/${encodeURIComponent(id)}`,
      label: actor.label,
      title: `到员工详情看这个主体（编号 ${id}）；App.tsx:1376 的路径段读口`,
    };
  }
  if (MEMBER_KINDS.has(kind)) {
    return {
      kind: "link",
      href: "/identity?tab=people",
      label: actor.label,
      title:
        "到「组织与人员」名录看这个人；名录打开条目是页内态（PeopleModulePage Q12 零路由），" +
        "所以这条链到名录、不到具体一行",
    };
  }
  if (MACHINE_KINDS.has(kind) || (!EMPLOYEE_KINDS.has(kind) && !MEMBER_KINDS.has(kind) && id)) {
    return {
      kind: "no-page",
      label: actor.label,
      title:
        "这是一个机器主体（服务/系统），人员名录里没有它的条目，" +
        "给它挂身份页链接会跳到看不见它的页面，所以只说值不给链",
    };
  }
  return {
    kind: "unrelated",
    title: "这条事件的回答没有带上可用的操作者编号。",
  };
}

/** 哪次运行 → 运行详情：RunsModulePage 读 ?run=，编号从关联行同一个原值来。 */
export function runChainOf(links: readonly AuditLink[]): AuditChain {
  const link = linkNoun(links, "运行");
  if (!link || !link.raw) {
    return {
      kind: "unrelated",
      title: "这条事件不是由某一次运行触发的（回答里没有 runId），不给编一条。",
    };
  }
  return {
    kind: "link",
    href: `/runs?run=${encodeURIComponent(link.raw)}`,
    label: link.label,
    title: `到运行详情看这一次运行（编号 ${link.raw}）；RunsModulePage.tsx:1104 读地址里的 run`,
  };
}

/** 哪次判定 → 策略判定：值在链上就在，但本控制台没有判定落点（待裁定），说而不链。 */
export function decisionChainOf(links: readonly AuditLink[]): AuditChain {
  const link = linkNoun(links, "策略判定");
  if (!link || !link.raw) {
    return {
      kind: "unrelated",
      title: "这条事件没有带回策略判定编号（policyDecisionId 未返回）。",
    };
  }
  return {
    kind: "no-page",
    label: link.label,
    title:
      `这次动作挂在判定 ${link.raw} 上，但判定详情在本控制台没有页面` +
      "（域侧读口 P4 存在、是否上屏待裁定），所以报编号不给链接",
  };
}

export function auditChainsOf(actor: Person, links: readonly AuditLink[]): AuditChains {
  return {
    actor: actorChainOf(actor),
    run: runChainOf(links),
    decision: decisionChainOf(links),
  };
}
