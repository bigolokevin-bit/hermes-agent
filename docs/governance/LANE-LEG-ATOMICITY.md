# 车道规矩：腿件提交原子性（leg atomicity）

状态：**立项生效**（L0 参谋 2026-11-24 收尾令拍板：Q47/Q48 两波各发生一次，第二例已到，符合立项门槛；由先前「暂不入册」改判「立项」）。
本件只约束**提交时机与自证形制**，不改 gates 脚本的任何判据（`web/scripts/*.mjs`、`docs/_artifacts/tonight/state-quad.mjs` 逐字沿用）。

## 为什么要这条规矩

`lane/hermes-console` 是**共享检出**：同一工作区里多条 task/* 车道与 L6 取证腿并发写。
未提交的门腿件（`docs/_artifacts/tonight/**`：`_l0-*.stdout.txt`、`assert-ia-*.json`、`crawl.json`、`crawl-anon.json`、`lint-*.json`、`state-quad.json`、`vitest.txt`、`gates.exit.json`）在这种工作区里**不算存在**——他道并窗的写回/重跑会把它们覆盖回上一代读数。

### 两例真实触发（本仓）

1. **Q47 波（章笔 `cd087f09427b42bc28d8e95c5f1f8d0970540944`，章面 `f529efa9a8…`）**：章笔显式路径集漏了 `lint-reuse.json`，而账本 digest 读的是工作区实值（`scanned` 584→587）⇒ 已提交树里的 leg json 与账本不同代。补钉笔随后单独落线（不动 `gates.exit.json`，以保持「一波一盖、章面单指源码面」）。
2. **Q48 波（章笔 `f4f9e8e48ba2bb42b49c44ba0a0fa04375362c28`，章面 `b0503d792699c50022df249e45771fe3f04a20c5`）**：腿件跑完后在**未提交态**被他道并窗写回覆盖 ⇒ 盘上 `headHash` 退回上一代值、mtime 退回上一代时刻，章笔差点只带进 build 日志。该枚 defective 章笔**从未 push**，用 `git reset --soft <face>` 撤销后在同一条命令里重跑腿件 → 出账本 → add → commit → push 完成（非 force、未动远端）。

## 规则正文（必做）

在共享检出里交付一次 gates 跟代波时，下列六步必须在**同一条 shell 命令内同批完成**，中间不得插入任何其它写工作区的动作、不得跨轮等待拍板：

```
腿件 regen（逐字判据命令） → 账本生成（gates.exit.json，含两闸） →
git add -- <显式路径集> → git commit → git push origin HEAD:refs/heads/lane/hermes-console →
git ls-remote origin refs/heads/lane/hermes-console（落文件回读）
```

## 三条可判据自证（缺一即视为未交付）

1. **代次对齐**：每枚腿件 mtime **晚于本波 rebuild 时刻**（`stat -f '%Sm %N' -t '%H:%M:%S'`）。porcelain 无 M 不能证明腿跑过；mtime 早于本波 rebuild 的读数属上一波。
2. **路径集逐枚对齐**：`git diff --cached --name-only` 的集合必须**逐枚覆盖**账本 digest 实际读取的每件产物（`gates.exit.json` + `assert-ia-{html,react}.json` + `lint-{fake,reuse}.json` + `crawl.json` + `crawl-anon.json` + `state-quad.json` + `vitest.txt` + 各 `_l0-*.stdout.txt` + `_l0-exits.txt` + 本波 `_l7-build-*.log`）。无差件仍显式 add（空操作安全），禁 `git add -A`。
3. **残留清零**：交付后 `git status --porcelain -- docs/_artifacts/tonight/**` 无本道待提件；他道件（`shots/*.png`、`docs/governance/LANE-ROSTER.md`、`default/ fixture/ owned/ target/`）只报不钉，永不 `checkout --` 撤销。

## 适用边界

- **适用**：共享检出的多车道写窗（fork `lane/hermes-console` 的 gates/取证交付；主仓 `lane/*` 交付在共享检出时同此）。
- **不适用**：私有 worktree（例：`/Users/kevin_studio/Projects/l2-publish`），因其工作区无他道写入者；但仍建议同批提交以免跨轮漂移。
- **不改判据**：本件不授权修改任何腿脚本判定逻辑。既有形制注（`lint-*.mjs` 不写 `headHash` = NOKEY；`state-quad.json` 无顶层 `ok/entry`，绿判据 `passed==sampled`；`crawl-routes.mjs --out=` 时不打印 stdout）继续按注处理。

## 相关纪律（同族，已在册）

- 一波一盖、章笔不落自身：账本 `head` 指向源码面，章 commit 为其后继；字面 `headHash == HEAD` 不可达。
- 交付三证：`git reflog` + `git ls-remote` 定向 ref（落文件读）+ `git cat-file`；`remote.origin.fetch` 被 pin，跟踪引用不可信。
- 工单/补令给的 sha 与产物名，动手前先在对象库与磁盘双向现查；解析不了的短 sha 用 `git rev-parse` 现场取全值，禁由短 sha 补全。
