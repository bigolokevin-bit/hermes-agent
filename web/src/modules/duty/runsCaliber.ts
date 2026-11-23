/**
 * 跨页「今日运行」口径对照。
 *
 * 两页各读自己的口：值班台今日运行 = workbench/summary?range=1d 的 runs KPI；
 * 指标页运行数 = /api/run-stats 当前时间窗的 totals.runs。
 * 本页不代对方取数（零额外请求），所以「同源一致」只在两侧读数都在手上时才写。
 */

export const RUNS_DUTY_PATH =
  "workbench/summary?range=1d（BFF 聚合一日的运行数 KPI）";
export const RUNS_METRICS_PATH = "/api/run-stats 当前时间窗（totals.runs）";

export type RunsVerdict = "equal" | "different" | "unread" | "missing";

export type RunsCaliberView = {
  verdict: RunsVerdict;
  /** 屏上对照句（不含本卡值与路径，那两段由页面另行渲染）。 */
  compare: string;
  /** title：两条路径 + 相遇条件 + 采集时刻口径。 */
  title: string;
};

export function runsCaliber(input: {
  duty: number | null;
  metrics: number | null;
  dutyAsOfText: string;
}): RunsCaliberView {
  const { duty, metrics, dutyAsOfText } = input;
  const title =
    `本卡读 ${RUNS_DUTY_PATH}，采集时刻 ${dutyAsOfText}；` +
    `/metrics 读 ${RUNS_METRICS_PATH}。两页各读自己的口，本页不另发请求去取对方的数：` +
    `只有当两侧读数出自同一读模型时才写「同源一致」，否则按口径不同处理，不为了对上而改任何一侧的取数。` +
    (duty === null ? "本次没有读到本卡的运行数，不当作 0。" : "");

  if (duty === null) {
    // DU-07③：判据不许把结论挂在 title（悬停）上——「见 title」三处改成自足句，
    // 屏上直接读得懂；相遇条件的完整句仍留在 title 作为补充，但不再是唯一载体。
    return { verdict: "missing", compare: "本卡这次没读到运行数｜缺数不当 0，对照无从谈起", title };
  }
  if (metrics === null) {
    return {
      verdict: "unread",
      compare: "读数不在本页取｜两页各读各的口，对不上就不写",
      title,
    };
  }
  if (duty === metrics) {
    return { verdict: "equal", compare: `与 /metrics 同源一致（${duty}）`, title };
  }
  return {
    verdict: "different",
    compare: `本卡 ${duty} · /metrics ${metrics}｜两条读口不同，不为对上改任一侧取数`,
    title,
  };
}