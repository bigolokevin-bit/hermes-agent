// @vitest-environment node
// w190 条款 6：全页唯一 h1 归顶栏（n17 先例，face 87873845ed——ConsoleTopBar 用壳
// 路由表的中文标签作唯一 h1，面包屑同源）。duty 域三个页面自带头标（值班台 /
// 用量与成本 / 能力与权限）全部降格为具名元素后，本闸钉住形制：duty 的任何组件
// 源码里不得出现 h1 开标签；壳侧唯一 h1 源同步读数（只读 shell 源码，不改它）。
// 探测串拼接构造，避免本文件自身被 DoD 的 grep 计为命中（纯源码契约闸）。
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { expect, it } from "vitest";

const H1_OPEN = "<" + "h1";
const H1_RE = new RegExp(H1_OPEN + "\\b", "g");

const dutyDir = fileURLToPath(new URL(".", import.meta.url));
const topbarFile = join(dutyDir, "..", "..", "shell", "TopBar.tsx");
const consoleFile = join(dutyDir, "..", "..", "shell", "console.tsx");

/** 注释里提到 h1 开标签的不算 JSX 真身；与壳侧 topbar 契约同形制：先剥块注释再数。 */
const stripComments = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, "");
const countH1 = (src: string): number => (stripComments(src).match(H1_RE) ?? []).length;

const pageSources = readdirSync(dutyDir)
  .filter((f) => f.endsWith(".tsx") && !f.includes(".test."))
  .map((f) => ({ name: f, src: readFileSync(join(dutyDir, f), "utf8") }));

it("闸不是空转：三张 duty 页面的中文页名都在源码里", () => {
  expect(pageSources.length).toBeGreaterThanOrEqual(3);
  const all = pageSources.map((p) => p.src).join("\n");
  expect(all).toContain("值班台");
  expect(all).toContain("用量与成本");
  expect(all).toContain("能力与权限");
});

it("duty 组件不再自带 h1 开标签（全页唯一 h1 归顶栏）", () => {
  const offenders = pageSources
    .filter((p) => countH1(p.src) > 0)
    .map((p) => p.name);
  expect(offenders, `自带 h1 的文件：${offenders.join(", ")}`).toEqual([]);
});

it("壳侧 ConsoleTopBar 保持唯一 h1 源（face 87873845ed：h1 住在 TopBar.tsx）", () => {
  expect(countH1(readFileSync(topbarFile, "utf8")), "shell/TopBar.tsx 应当恰有一处 h1（顶栏）").toBe(1);
  // 壳侧同闸口径：console.tsx 不得再自带 h1。
  expect(countH1(readFileSync(consoleFile, "utf8")), "shell/console.tsx 应当零 h1").toBe(0);
});
