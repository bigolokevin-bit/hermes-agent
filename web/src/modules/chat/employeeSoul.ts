/**
 * 数字员工「人格」（SOUL）合成 — 建档那一刻用的一份人设正文。
 *
 * 背景（2026-11-26 实测）：新建独立对话档时用 `clone_from_default`，克隆来的
 * `config.yaml` 里 `agent.system_prompt` 是**另一位员工**的人设（实测为
 * `emp_9F42AAE2…` 的「AgentOS 产品助理」），于是新档一开口就自称别人。
 * 上游 `POST /api/profiles` 支持 `soul=`（`ProfileCreateRequest(soul=…)`，
 * 回包带 `soul_set`），所以正解是**建档时就带上这位员工自己的人设**，
 * 而不是建完再补救。
 *
 * 权威渲染器仍是后端脚本 `l2-dataplane/ops/render_employee_prompt.py`
 * （employee + version.jobDescription + responsePolicy，缺字段即非零退出）。
 * 这里只做控制台侧需要的那一份：名字、岗位、部门、岗位职责、回复策略。
 * 两者若将来分叉，以 python 渲染器为准，并同步本文件。
 */

type Rec = Record<string, unknown>;

/**
 * 受管标记：只有带这一行的 SOUL.md 才会被控制台自动改写。
 * 没有标记的文件视为用户自己写的人格，永不覆盖（控制台不抢笔）。
 */
export const SOUL_MARKER = "sekoi:employee-profile";

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function itemsOf(body: unknown): Rec[] {
  if (Array.isArray(body)) return body.filter((x): x is Rec => !!x && typeof x === "object");
  if (body && typeof body === "object") {
    const items = (body as Rec).items;
    if (Array.isArray(items)) return items.filter((x): x is Rec => !!x && typeof x === "object");
  }
  return [];
}

/** 取生效时间最新的一版；没有 effectiveFrom 的按「最早」处理，不猜。 */
function latestVersion(rows: Rec[]): Rec | null {
  let best: Rec | null = null;
  let bestMs = -Infinity;
  for (const row of rows) {
    const ms = Date.parse(typeof row.effectiveFrom === "string" ? row.effectiveFrom : "");
    if (!Number.isFinite(ms)) {
      if (best === null) best = row;
      continue;
    }
    if (ms > bestMs) {
      bestMs = ms;
      best = row;
    }
  }
  return best;
}

export type SoulSource = {
  name: string;
  title: string;
  department: string | null;
  jobDescription: string;
  triggers: string[];
  mode: string | null;
  /** 生效版本号（读口可能只给 versionNo；给不出就是 null）。 */
  versionNo: string | null;
  /** 生效时间（ISO）；用来在叠加层里写「自 X 起生效」。 */
  effectiveFrom: string | null;
};

/**
 * 「组织上下文」叠加层 —— 写进该档 `config.yaml` 的 `agent.system_prompt`。
 *
 * 这一层在运行时是真叠加（`system + "\n\n" + overlay`，见 turn_context.py），
 * 所以**不删它**，只把内容换成这位员工自己的组织关系，并明确把身份让给 SOUL.md，
 * 避免两处各说一套身份。克隆默认档留下的那一份属于**另一位员工**，必须在首次
 * 打开时被替换掉，否则模型会同时看到两个人。
 */
export const OVERLAY_MARKER = "sekoi:employee-overlay";

export function composeEmployeeOverlay(src: SoulSource): string {
  const org = src.department ? `${src.title}（${src.department}）` : src.title;
  const lines = [
    `<!-- ${OVERLAY_MARKER}：控制台维护，手改会在下次打开对话时被覆盖 -->`,
    "## 组织上下文",
    `- 员工：${src.name}`,
    `- 岗位：${org}`,
  ];
  if (src.versionNo) {
    const when = src.effectiveFrom ? src.effectiveFrom.slice(0, 10) : null;
    lines.push(`- 当前生效版本：v${src.versionNo}${when ? `（自 ${when} 起）` : ""}`);
  }
  lines.push(
    "",
    "身份、职责边界与说话方式以 SOUL.md 为准；本段只补充组织关系，不重复身份描述。",
    "",
  );
  return lines.join("\n");
}

/**
 * 人设正文。写成 markdown：Hermes 的 SOUL.md 原样读入上下文，
 * 小标题比长段落更容易被遵守。
 *
 * 纪律：
 *  - 不写工程语言（CR 编号 / run_id）进正文，避免它们出现在对话里；
 *  - 数据边界写清楚，宁可少说也不编。
 */
export function composeEmployeeSoul(src: SoulSource): string {
  const who = src.department ? `${src.title}（${src.department}）` : src.title;
  const lines = [
    `<!-- ${SOUL_MARKER}：本文件由控制台按员工档案自动生成，手改会在下次打开对话时被覆盖 -->`,
    `# ${src.name} · ${who}`,
    "",
    `你是「${src.name}」，在这个组织里的岗位是 ${who}。你只在这个岗位上工作，不冒充其他员工。`,
    "",
    "## 岗位职责",
    src.jobDescription.trim(),
    "",
  ];
  if (src.triggers.length || src.mode) {
    lines.push("## 回复方式");
    if (src.triggers.length) lines.push(`- 应答触发：${src.triggers.join("、")}`);
    if (src.mode) lines.push(`- 应答模式：${src.mode}`);
    lines.push("");
  }
  lines.push(
    "## 边界",
    "- 只回答本职范围内的问题；超出范围时说明原因，并建议转交对应责任人。",
    "- 不编造系统里不存在的数据；给出数字时说明来源与时间。",
    "- 面向用户说话，不使用内部工程编号与内部代号。",
    "",
  );
  return lines.join("\n");
}

/**
 * 读齐人设素材。缺少「姓名 / 岗位 / 岗位职责」任何一项就抛错——
 * 宁可这次不进独立档，也不要拿别人的开场白顶上。
 */
export async function loadEmployeeSoul(
  employeeId: string,
  fetcher: (url: string) => Promise<unknown>,
): Promise<{ soul: string; source: SoulSource }> {
  const enc = encodeURIComponent(employeeId);
  const [employee, versions] = await Promise.all([
    fetcher(`/agent-api/api/employees/${enc}`),
    fetcher(`/agent-api/api/employee-versions?id=${enc}`).catch(() => null),
  ]);

  const rec = employee && typeof employee === "object" ? (employee as Rec) : {};
  const name = str(rec.name);
  const title = str(rec.title) ?? str(rec.role) ?? str(rec.position);
  const department = str(rec.department);

  if (!name || !title) {
    throw new Error("员工档案缺少姓名或岗位，无法生成独立人格");
  }

  const version = latestVersion(itemsOf(versions));
  const jobDescription = version ? str(version.jobDescription) : null;
  if (!jobDescription) {
    throw new Error("该员工还没有含岗位职责的版本，无法生成独立人格（先到「配置 → 版本与变更」发布一版）");
  }

  const policy = version && typeof version.responsePolicy === "object" && version.responsePolicy
    ? (version.responsePolicy as Rec)
    : {};
  const triggers = Array.isArray(policy.triggers)
    ? policy.triggers.map((t) => str(t)).filter((t): t is string => !!t)
    : [];
  const mode = str(policy.mode);

  // versionNo 在回包里是数字（实测 1），不是字符串 —— 别用 str() 一刀切，否则版本行永远空着。
  const versionNo = version
    ? typeof version.versionNo === "number"
      ? String(version.versionNo)
      : str(version.versionNo)
    : null;
  const effectiveFrom = version ? str(version.effectiveFrom) : null;
  const source: SoulSource = {
    name, title, department, jobDescription, triggers, mode, versionNo, effectiveFrom,
  };
  return { soul: composeEmployeeSoul(source), source };
}
