/**
 * 滚动条工具类棘轮门（纯源码层：不启服务、不读 hermes_cli/web_dist/**、不读 process.argv）。
 *
 * 钉的不变量（L0 wave-177 裁决＝路线 A：保留 `.scrollbar-none` 工具类、不令牌化）：
 *  ① web/src 内这三个属性的**定义点恒等于 1 个文件**，且必须是 `src/index.css` 里的
 *     `.scrollbar-none` 块 —— 声明数：`-ms-overflow-style` 1、`scrollbar-width` 1、
 *     `.scrollbar-none::-webkit-scrollbar` 1，多一个定义点就红。
 *  ② 消费点只准「用类名」或「Tailwind 任意变体」（`[-ms-overflow-style:none]`），
 *     禁在任何页面/组件里再写裸声明，也禁把它塞进内联 style（`msOverflowStyle` /
 *     `scrollbarWidth`）—— 内联形制同时违反「新增代码禁内联 style」。
 *
 * 为什么值得钉：值本身（none/thin/scrollbar）没有可统一的尺度，令牌化只增读解成本；
 * 真会回潮的是「有人在新文件里再抄一份隐藏滚动条的声明」，那就变成第二处真值源。
 *
 * 用法：`cd web && node_modules/.bin/vitest run src/components/ui`
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/** 扫描根＝web/src（本文件在 web/src/components/ui/ 下，往上两级）。 */
const SRC = fileURLToPath(new URL("../../", import.meta.url));
const OWNER_FILE = "index.css";

/** 裸声明形制：CSS 里写 `属性: 值`。 */
const DECL = /(-ms-overflow-style|scrollbar-width)\s*:/g;
/** 裸伪元素形制：自己开一个 `::-webkit-scrollbar` 规则。 */
const WEBKIT = /(::-webkit-scrollbar)/g;
/** 内联 style 形制（React 驼峰），一律禁止。 */
const INLINE = /\b(msOverflowStyle|scrollbarWidth)\s*:/g;
/** Tailwind 任意变体：允许，它是「用类名」的一种写法，不构成新定义点。 */
const ARBITRARY = /\[-(?:ms-overflow-style|scrollbar-width):[^\]]*\]/g;

const SCANNED = /\.(css|tsx|ts)$/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(abs, out);
      continue;
    }
    if (!SCANNED.test(entry.name)) continue;
    // 门自己的源码里全是这些属性名，必须排除；测试叙述文件同理。
    if (/\.(test|spec)\.(tsx?|ts)$/.test(entry.name)) continue;
    out.push(abs);
  }
  return out;
}

type Site = { file: string; line: number; kind: "decl" | "webkit" | "inline"; text: string };

function sitesOf(rel: string, text: string): Site[] {
  const sites: Site[] = [];
  const lines = text.split("\n");
  lines.forEach((line, index) => {
    // 先把合法 Tailwind 任意变体挖掉，剩下的才是真裸声明。
    const stripped = line.replace(ARBITRARY, "");
    for (const match of stripped.matchAll(DECL)) {
      sites.push({ file: rel, line: index + 1, kind: "decl", text: line.trim() });
      if (match.index === undefined) break;
    }
    if (WEBKIT.test(stripped)) sites.push({ file: rel, line: index + 1, kind: "webkit", text: line.trim() });
    WEBKIT.lastIndex = 0;
    if (INLINE.test(stripped)) sites.push({ file: rel, line: index + 1, kind: "inline", text: line.trim() });
    INLINE.lastIndex = 0;
  });
  return sites;
}

const files = walk(SRC);
const read = new Map<string, string>();
const sites: Site[] = [];
for (const abs of files) {
  const rel = relative(SRC, abs).split("\\").join("/");
  const text = readFileSync(abs, "utf8");
  read.set(rel, text);
  sites.push(...sitesOf(rel, text));
}

function describeSites(list: Site[]): string[] {
  return list.map((s) => `${s.file}:${s.line} ${s.kind} «${s.text}»`);
}

describe("滚动条工具类棘轮门（定义点恒 1，消费点只准类名）", () => {
  it("扫描面非空（防空转假绿）", () => {
    expect(files.length).toBeGreaterThan(100);
    expect(read.has(OWNER_FILE)).toBe(true);
  });

  it("三属性的定义点只准落在 index.css，声明数各为 1", () => {
    const offenders = sites.filter((s) => s.file !== OWNER_FILE);
    expect(describeSites(offenders), "index.css 之外出现了滚动条裸声明/内联形制").toEqual([]);
    const count = (kind: Site["kind"], prop?: string) =>
      sites.filter((s) => s.file === OWNER_FILE && s.kind === kind && (!prop || s.text.includes(prop))).length;
    expect(count("decl", "-ms-overflow-style"), "index.css 内 -ms-overflow-style 必须恰好 1 处").toBe(1);
    expect(count("decl", "scrollbar-width"), "index.css 内 scrollbar-width 必须恰好 1 处").toBe(1);
    expect(count("webkit"), "index.css 内 ::-webkit-scrollbar 必须恰好 1 处").toBe(1);
  });

  it("index.css 的声明必须在 .scrollbar-none 块内，伪元素必须挂在该类下", () => {
    const css = read.get(OWNER_FILE) ?? "";
    const block = /\.scrollbar-none\s*\{[^}]*\}/.exec(css);
    expect(block, "index.css 必须存在 .scrollbar-none 规则块").not.toBeNull();
    const start = block?.index ?? -1;
    const end = start + (block?.[0]?.length ?? 0);
    for (const prop of ["-ms-overflow-style", "scrollbar-width"]) {
      const at = css.indexOf(`${prop}:`);
      expect(at, `index.css 内 ${prop} 必须在 .scrollbar-none 块内`).toBeGreaterThanOrEqual(start);
      expect(at, `index.css 内 ${prop} 必须在 .scrollbar-none 块内`).toBeLessThan(end);
    }
    expect(css, "::-webkit-scrollbar 只准以 .scrollbar-none::-webkit-scrollbar 出现").toContain(
      ".scrollbar-none::-webkit-scrollbar",
    );
    const strayWebkit = [...css.matchAll(/([^\s{}]+)?::-webkit-scrollbar/g)]
      .map((m) => m[1] ?? "")
      .filter((prefix) => prefix !== ".scrollbar-none");
    expect(strayWebkit, "出现了未挂在 .scrollbar-none 下的 ::-webkit-scrollbar 选择器").toEqual([]);
  });

  it("页面/组件只准用类名 scrollbar-none，禁内联 style 形制", () => {
    const inline = sites.filter((s) => s.kind === "inline");
    expect(describeSites(inline), "内联 style 里出现了 msOverflowStyle/scrollbarWidth").toEqual([]);
    const users = files
      .filter((abs) => abs.endsWith(".tsx"))
      .filter((abs) => /scrollbar-none/.test(read.get(relative(SRC, abs).split("\\").join("/")) ?? ""));
    // 消费点存在性：工具类若无人使用，说明该门已失去意义，需要显式复核而不是静默绿。
    expect(users.length, "web/src 内没有任何 .scrollbar-none 消费点，请复核本门是否还需保留").toBeGreaterThan(0);
  });
});
