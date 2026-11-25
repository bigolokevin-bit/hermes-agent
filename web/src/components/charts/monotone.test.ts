/**
 * monotonex 纯函数单测：与 d3-shape curveMonotoneX（Steffen 1990 保单调 Hermite）
 * 等价的六条硬判据。
 *
 *  ① 两点退化直线
 *  ② 三点端点特例（slope2）
 *  ③ 单调递增序列切线不全为负
 *  ④ 面积路径以 Z 闭合
 *  ⑤ 断口不产生跨缺段的 C 段
 *  ⑥ yDomainLadder(58) = 60
 */
import { describe, expect, it } from 'vitest';

import {
  bandCenters,
  contiguousRuns,
  dedupePoints,
  monotoneAreaPath,
  monotoneTangents,
  monotoneXPath,
  tickValuesForTop,
  yDomainLadder,
  yTickValues,
  type Pt,
} from './monotone';

/** 路径里的 C 段数。 */
const curves = (d: string): number => (d.match(/C/g) ?? []).length;

/** 从路径里取全部 x 坐标（M / C / L 后面都跟 x y 对）。 */
const xs = (d: string): number[] => {
  const nums = d.match(/-?\d+(?:\.\d+)?/g) ?? [];
  const out: number[] = [];
  for (let i = 0; i < nums.length; i += 2) out.push(Number(nums[i]));
  return out;
};

describe('① 两点退化直线', () => {
  it('n=2 只给一条 L，不产生贝塞尔', () => {
    const d = monotoneXPath([
      { x: 0, y: 10 },
      { x: 100, y: 20 },
    ]);
    expect(d).toBe('M0.00 10.00 L100.00 20.00');
    expect(curves(d)).toBe(0);
  });

  it('n=2 的两端切线都等于割线斜率（所以补点也不会弯）', () => {
    expect(monotoneTangents([{ x: 0, y: 10 }, { x: 100, y: 20 }])).toEqual([0.1, 0.1]);
  });

  it('单点只给 M，不画线', () => {
    expect(monotoneXPath([{ x: 5, y: 6 }])).toBe('M5.00 6.00');
  });
});

describe('② 三点端点特例', () => {
  it('峰顶中点的切线归 0，端点用 (3s - t)/2', () => {
    const points: Pt[] = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 0 },
    ];
    const [t0, t1, t2] = monotoneTangents(points);
    // 中点符号相反 ⇒ 顶点切线 0（极值点不越界）
    expect(t1).toBe(0);
    // 起点：s=1，t=0 ⇒ (3*1-0)/2 = 1.5；终点对称 -1.5
    expect(t0).toBeCloseTo(1.5, 6);
    expect(t2).toBeCloseTo(-1.5, 6);
  });

  it('第一段控制点落在 x0+dx / y0+dx*t0 上', () => {
    const d = monotoneXPath([
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 0 },
    ]);
    expect(curves(d)).toBe(2);
    // dx = 10/3 = 3.33；t0 = 1.5 ⇒ 控制点 y = 5.00
    expect(d).toContain('C3.33 5.00');
  });
});

describe('③ 单调递增序列切线不全为负', () => {
  it('递增读数（含持平段）切线全部 ≥ 0', () => {
    const tangents = monotoneTangents([
      { x: 0, y: 0 },
      { x: 50, y: 3 },
      { x: 100, y: 3 },
      { x: 150, y: 20 },
      { x: 200, y: 21 },
    ]);
    expect(tangents).toHaveLength(5);
    for (const t of tangents) expect(t).toBeGreaterThanOrEqual(0);
  });

  it('递增曲线不产生向下的控制点（保单调，不冲高再回落）', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 1 },
      { x: 200, y: 9 },
      { x: 300, y: 10 },
    ];
    const tangents = monotoneTangents(points);
    const d = monotoneXPath(points);
    expect(curves(d)).toBe(3);
    // 每个控制点的 y 都夹在该段两端之间 ⇒ 曲线不会冲出数据包络
    points.slice(0, -1).forEach((a, i) => {
      const b = points[i + 1];
      const dx = (b.x - a.x) / 3;
      const c1 = a.y + dx * tangents[i];
      const c2 = b.y - dx * tangents[i + 1];
      const lo = Math.min(a.y, b.y);
      const hi = Math.max(a.y, b.y);
      expect(c1).toBeGreaterThanOrEqual(lo - 1e-6);
      expect(c1).toBeLessThanOrEqual(hi + 1e-6);
      expect(c2).toBeGreaterThanOrEqual(lo - 1e-6);
      expect(c2).toBeLessThanOrEqual(hi + 1e-6);
    });
  });
});

describe('④ 面积路径闭合', () => {
  it('上边界走 monotone，末端落到 baseY 再回起点并用 Z 闭合', () => {
    const d = monotoneAreaPath(
      [
        { x: 10, y: 30 },
        { x: 20, y: 10 },
        { x: 30, y: 20 },
      ],
      100,
    );
    expect(d.endsWith('Z')).toBe(true);
    expect(d).toContain('L30.00 100.00 L10.00 100.00 Z');
    expect(curves(d)).toBe(2);
  });

  it('单点面积也闭合（不产出空串）', () => {
    const d = monotoneAreaPath([{ x: 4, y: 5 }], 40);
    expect(d.endsWith('Z')).toBe(true);
  });
});

describe('⑤ 断口不跨缺段', () => {
  it('contiguousRuns 把缺失日切成独立段', () => {
    expect(contiguousRuns([3, null, 4, 5, null, null, 6])).toEqual([[0], [2, 3], [6]]);
    expect(contiguousRuns([null, null])).toEqual([]);
    expect(contiguousRuns([1, 2])).toEqual([[0, 1]]);
  });

  it('分段后的每段曲线只覆盖本段 x，不出现跨缺段的 C 段', () => {
    const band = bandCenters(7, 30, 700 - 30 - 10);
    const values = [3, null, 4, 5, null, null, 6];
    const segments = contiguousRuns(values).map((run) =>
      run.map((index) => ({ x: band[index], y: (values[index] as number) * -10 })),
    );
    expect(segments).toHaveLength(3);
    // 第一段（单点）没有贝塞尔
    expect(curves(monotoneXPath(segments[0]))).toBe(0);
    const round = (list: number[]) => list.map((value) => Math.round(value * 100) / 100);
    // 第二段两点 ⇒ 一条直线，x 只在 band[2]..band[3] 之间
    const second = monotoneXPath(segments[1]);
    expect(curves(second)).toBe(0);
    expect(round(xs(second))).toEqual(round([band[2], band[3]]));
    // 第三段单点 ⇒ 只有 M
    expect(round(xs(monotoneXPath(segments[2])))).toEqual(round([band[6]]));
    // 任何一段都不横跨缺口（band[1] / band[4] / band[5] 不出现）
    const used = segments.flatMap((segment) => xs(monotoneXPath(segment)));
    expect(used).not.toContain(band[1]);
    expect(used).not.toContain(band[4]);
    expect(used).not.toContain(band[5]);
  });

  it('相邻重合点被忽略（不会除零、不会产生 NaN）', () => {
    const dense = dedupePoints([
      { x: 0, y: 0 },
      { x: 0, y: 9 },
      { x: 10, y: 5 },
    ]);
    expect(dense).toHaveLength(2);
    const d = monotoneXPath([
      { x: 0, y: 0 },
      { x: 0, y: 9 },
      { x: 10, y: 5 },
    ]);
    expect(d).not.toContain('NaN');
  });
});

describe('⑥ Y 轴整数档', () => {
  it('yDomainLadder(58) = 60（阶梯 6 × 10）', () => {
    expect(yDomainLadder(58)).toBe(60);
  });

  it('峰值 0 给 1，峰值 8 给 8，峰值 13 给 15，峰值 44 给 50', () => {
    expect(yDomainLadder(0)).toBe(1);
    expect(yDomainLadder(8)).toBe(8);
    expect(yDomainLadder(13)).toBe(15);
    expect(yDomainLadder(44)).toBe(50);
  });

  it('金额量纲不被取整成 1：0.64 → 0.8 / 0.4 / 0', () => {
    expect(yDomainLadder(0.64)).toBe(0.8);
    expect(yTickValues(0.64).values).toEqual([0.8, 0.4, 0]);
  });

  it('三档刻度 = 顶 / 中 / 0，且中线被取整', () => {
    expect(yTickValues(58).values).toEqual([60, 30, 0]);
    expect(yTickValues(13).values).toEqual([15, 8, 0]);
    expect(tickValuesForTop(61).values).toEqual([61, 31, 0]);
    expect(tickValuesForTop(1).values).toEqual([1, 0]);
  });
});

describe('band 几何', () => {
  it('点在 band 中心：plotLeft + (i + 0.5) * step', () => {
    expect(bandCenters(4, 30, 400)).toEqual([80, 180, 280, 380]);
    expect(bandCenters(0, 30, 400)).toEqual([]);
  });
});
