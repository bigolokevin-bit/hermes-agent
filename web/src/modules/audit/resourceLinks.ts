/**
 * audW — where a resource on an audit event actually lives.
 *
 * ONE table, called by both legs (the inline preview `aud6-preview` and the
 * event detail `aud3`). A second copy of these paths anywhere else would be a
 * second truth about where a page is, and this module's whole discipline is that
 * a link is either real or not printed at all.
 *
 * 禁死链 — every href below was read out of the routing before it was written
 * here, and the hit line is kept next to the entry it proves:
 *   /approvals   App.tsx:1243 (ConsoleModulePage live.history)
 *                + shell/routes.ts:157 `{ hash: '#/approvals?tab=history', … tabId: 'history' }`
 *                + ApprovalsHistoryModulePage.tsx:177 `useState(() => params.get("id"))`
 *                + ApprovalsHistoryModulePage.tsx:75 (`status` defaulting to "all")
 *   /runs        App.tsx:1400 + RunsModulePage.tsx:945 `params.get("run") ?? pathRun`
 *   /work        App.tsx:1193 + shell/routes.ts:151 (`tabId: 'board'`)
 *                + TasksBoardModulePage.tsx:236 `deepTaskId ?? params.get("task")`
 *   /knowledge   App.tsx:1201 (and the nav entry at App.tsx:402)
 *
 * The shape this keys off — a resource with BOTH a type and an id — is not an
 * assumption. The console read口 could not be probed live this session:
 * `GET :9122/agent-api/api/audit-events?limit=2` → 401 `console.unauthenticated`
 * (rid df99b9f5) and `GET :9122/agent-api/api/audit?limit=1&from=…&to=…` → 401
 * (rid 53e188be), with no session and no login attempted. The upstream domain
 * ledger was probed instead, read-only:
 * `GET :8101/v1/audit/events?action=dispatch.event&from=…&to=…&limit=2`
 * (header `X-Tenant-Id: t_seakoi_pilot`) → 200, and each event carries
 * `resource: { "type": "channel_event", "id": "feishu:…" }` — a nested type+id
 * object, no flat `resourceId` key. That is exactly the ladder `model.ts`
 * already reads (RESOURCE_KEYS → RESOURCE_ID_KEYS / RESOURCE_TYPE_KEYS), so the
 * values used here are the ones the screen already printed, never a second read.
 *
 * A type with no page is said, not linked: `channel_event`, `policy_decision`,
 * `grant` and everything else the ledger can hold have no console landing page,
 * and a link to a page that cannot show them is worse than no link.
 */



/** What the anchor says. One label for every type, so the face never varies. */
export const AUDIT_RESOURCE_LINK_LABEL = "打开资源";

/** What a resource of an unlinkable type says instead of a dead link. */
export const AUDIT_RESOURCE_NO_LINK_TEXT = "该资源类型暂无页面";

export type ResourceLink =
  | { kind: "link"; href: string; label: string; title: string }
  | { kind: "no-link"; title: string }
  | { kind: "missing"; title: string };

interface ResourcePage {
  /** 人话：这个类型的资源在哪里看得全。 */
  where: string;
  /** The proven route. `id` is the resource's own id, already truth-checked. */
  href: (id: string) => string;
  /** Whether this landing page needs the id at all. */
  needsId: boolean;
  /** The line that proves the route — and the parameter — exists. */
  proof: string;
}

const RESOURCE_PAGES: Record<string, ResourcePage> = {
  approval: {
    where: "审批历史",
    href: (id) => `/approvals?tab=history&status=all&id=${encodeURIComponent(id)}`,
    needsId: true,
    proof: "审批历史页直接读地址里的 id 选中这一条（App.tsx:1243 / ApprovalsHistoryModulePage.tsx:177）",
  },
  run: {
    where: "运行详情",
    href: (id) => `/runs?run=${encodeURIComponent(id)}`,
    needsId: true,
    proof: "运行页读地址里的 run（App.tsx:1400 / RunsModulePage.tsx:945）",
  },
  task: {
    where: "任务看板",
    href: (id) => `/work?tab=board&task=${encodeURIComponent(id)}`,
    needsId: true,
    proof: "看板读地址里的 task（App.tsx:1193 / TasksBoardModulePage.tsx:236）",
  },
  employee: {
    where: "员工详情",
    href: (id) => `/employees/${encodeURIComponent(id)}`,
    needsId: true,
    proof: "详情路由 /employees/:employeeId 由员工页读路径里的 employeeId（App.tsx:339 / routes.ts:201）",
  },
  // 假定：知识类落点按页面读，本环境没有可定位单条知识的地址参数，所以不带 id。
  knowledge: {
    where: "知识库",
    href: () => "/knowledge",
    needsId: false,
    proof: "知识库路由存在（App.tsx:1201）；该落点不带条目参数",
  },
  knowledge_source: {
    where: "知识库",
    href: () => "/knowledge",
    needsId: false,
    proof: "知识库路由存在（App.tsx:1201）；该落点不带条目参数",
  },
};

/** The table's own keys, so a test can prove there is exactly one of them. */
export const RESOURCE_LINK_TYPES: readonly string[] = Object.keys(RESOURCE_PAGES);

function pageFor(type: string | null): ResourcePage | null {
  if (!type) return null;
  return RESOURCE_PAGES[type.trim().toLowerCase()] ?? null;
}

/**
 * The one decision both faces ask: is there a real page for this resource, and
 * can it be pointed at this particular one. Type first, then id — a type with no
 * page has nothing to be missing an id for.
 */
export function resourceLinkOf(resource: {
  type: string | null;
  id: string | null;
}): ResourceLink {
  const page = pageFor(resource.type);
  if (!page) {
    return {
      kind: "no-link",
      title: `审计台账里的资源类型「${resource.type ?? "未返回"}」在本控制台没有对应页面，所以这里不给链接。`,
    };
  }
  if (page.needsId && !resource.id) {
    return {
      kind: "missing",
      title: `这类资源在${page.where}有页面，但这条记录没有带回资源编号，无法定位到具体一条（${page.proof}）。`,
    };
  }
  const id = resource.id ?? "";
  return {
    kind: "link",
    href: page.href(id),
    label: AUDIT_RESOURCE_LINK_LABEL,
    title: page.needsId
      ? `到${page.where}看这条资源（编号 ${id}）；${page.proof}`
      : `到${page.where}看这类资源；${page.proof}`,
  };
}
