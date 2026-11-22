/**
 * UI-F 令牌单源机检门（L0 裁决①/②的补位：web/scripts/token-source-probe.mjs 不在集成脸上）。
 * 硬约束：纯源码层断言 —— 不启服务、不读已部署产物、不读 process.argv，
 * 因此在未部署的 worktree 里也必须绿（绝不复制 e1Contract disk==served 那种环境腿形制）。
 * 用法：cd web && node_modules/.bin/vitest run src/components/ui/token-source.test.ts
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SHELL = fileURLToPath(new URL("../../shell/tokens.css", import.meta.url));
const STYLES = fileURLToPath(new URL("../../styles/tokens.css", import.meta.url));
const UI = fileURLToPath(new URL("./ui.css", import.meta.url));
/** 指南在本仓 docs/ 下：从 web/src/components/ui 上跳四级到仓库根。 */
const GUIDE = fileURLToPath(new URL("../../../../docs/_artifacts/ui-kd/ui-page-migration-guide.md", import.meta.url));
const read = (path: string): string => readFileSync(path, "utf8");

/** 去掉块注释与行注释后的纯声明文本。 */
const strip = (css: string): string =>
  css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

/** 某个文件里声明的全部 `--x:` 名。 */
const defined = (css: string): string[] =>
  [...strip(css).matchAll(/(--[A-Za-z][\w-]*)\s*:/g)].map((m) => m[1] as string);

describe("UI-F 令牌单源机检门", () => {
  it("甲：shell/tokens.css 只做转发，不得再定义任何变量", () => {
    const shell = read(SHELL);
    expect(defined(shell), "壳层一旦出现定义就是双真值源").toHaveLength(0);
    const imports = [...strip(shell).matchAll(/@import\s+"([^"]+)"/g)].map((m) => m[1]);
    expect(imports).toEqual(["../styles/tokens.css"]);
    // App.tsx 仍按 @/shell/tokens.css 引用，所以这个文件必须存在且只含转发。
    expect(shell).toContain("@import");
  });

  it("乙：真值源里每个契约名都有非空定义", () => {
    const styles = strip(read(STYLES));
    const empties = [...styles.matchAll(/(--[\w-]+)\s*:\s*(;|\s*$)/gm)].map((m) => m[1]);
    expect(empties, "存在空值定义").toEqual([]);
    const names = defined(read(STYLES));
    for (const must of ["--space-ls-3", "--font-size-ls-2", "--table-row-h-ls"]) {
      expect(names, `缺真值源定义：${must}`).toContain(must);
    }
  });

  it("丙：基元样式用到的每个 var(--…) 都能解析到真值源", () => {
    const have = new Set([...defined(read(SHELL)), ...defined(read(STYLES))]);
    const used = [...strip(read(UI)).matchAll(/var\((--[\w-]+)/g)].map((m) => m[1] as string);
    expect(used.length, "ui.css 一个令牌都没用到＝门是空的").toBeGreaterThan(20);
    const missing = [...new Set(used)].filter((name) => !have.has(name));
    expect(missing, "ui.css 引用了未定义的令牌（孤源回潮）").toEqual([]);
  });

  it("丁：别名层零字面量 —— 契约名只许指向语义名，禁裸 hex", () => {
    const aliasLines = [...strip(read(STYLES)).matchAll(/--[\w-]*-ls[\w-]*\s*:[^;]*/g)].map((m) => m[0] as string);
    expect(aliasLines.length, "没有 *-ls 契约名可核＝门是空的").toBeGreaterThanOrEqual(60);
    const hexed = aliasLines.filter((line) => /#[0-9a-fA-F]{3,8}\b/.test(line));
    expect(hexed, "契约名里出现了硬编码色，应改指 --bg/--panel/…").toEqual([]);
    // 动效档必须齐：减动效偏好靠这三档归零，缺档就等于没有零动效表达。
    const tiers = ["--duration-ls-fast", "--duration-ls-base", "--duration-ls-slow"];
    const names = defined(read(STYLES));
    for (const tier of tiers) expect(names, `缺动效档：${tier}`).toContain(tier);
  });

  // L0 点名的漏网口子：原先只抽查三个名，「令牌加了不写表」不红、
  // 「表写了令牌没有」也只靠抽查兜。这一条把两头堵成逐项相等。
  it("戊：契约名表 ⇄ 真值源双向逐项相等（加了不写表 / 写了表没令牌，两头都拦）", () => {
    const tableNames = new Set(
      [...read(GUIDE).matchAll(/^\|\s*`(--[\w-]+)`\s*\|/gm)].map((m) => m[1] as string),
    );
    expect(tableNames.size, "指南契约名表是空的＝这条腿在空转").toBeGreaterThanOrEqual(60);
    const tokenLs = new Set(
      [...strip(read(STYLES)).matchAll(/--[\w-]*-ls[\w-]*\s*:/g)].map((m) =>
        m[0].replace(/\s*:$/, ""),
      ),
    );
    expect(tokenLs.size, "真值源契约名少于 62＝令牌被删没走并窗").toBeGreaterThanOrEqual(60);
    const missingInTable = [...tokenLs].filter((name) => !tableNames.has(name));
    expect(missingInTable, "真值源加了契约名但指南 §1 没登记（三处同改缺一即红）").toEqual([]);
    const orphanRows = [...tableNames].filter((name) => !tokenLs.has(name));
    expect(orphanRows, "指南表里的契约名在真值源没有定义＝孤行").toEqual([]);
    expect(tableNames.size, "契约名数与真值源数不等").toBe(tokenLs.size);
  });
});
