# V2 知识空间「最新版本」深链可行性调查（只读）

日期：2026-11-20 · 车道：lane/console-appr · 性质：**纯只读调查，未执行任何写请求/未改任何产品码/未动 DB**。
基线：fork merge origin/lane/hermes-console = Already up to date @e6604241；受管 BFF 活体树=/Users/kevin_studio/Projects/bff-v4-serve HEAD **b3b0f16**（feat(bff): honest envelopes and read ports for knowledge and models）；seakoi-agent-os 只读。

## 1. 端点与契约核查（现查）

### 1.1 BFF 侧知识读口族（apps/console/server.py 行号为 b3b0f16 实形）

| 端点 | 实现 | 上游 | 备注 |
|---|---|---|---|
| `GET /api/documents`（**真消费口**）与 `GET /api/knowledge/documents`（别名，同实现） | `_documents_from_bisheng` L1340-1390 | Bisheng 7860 `GET /api/v1/knowledge`（L1347） | 信封 `{documents, rows, count, source, hasMore, cursor, asOf(+asOfSource), probe_notes?}`；`q=` 由 BFF 侧 name/description 子串过滤（上游不接受 q，L1384-1386） |
| `GET /api/knowledge/spaces` | `_spaces_from_bisheng` L1395-1460 | Bisheng `GET /api/v1/knowledge/space/{id}/info` **per-id 扇出**（L1307 注释：上游无列表端点，GET 列表只回 type=0、space 列表 405/10992） | 行键 `space_id/name/description/document_count/kind/last_sync_at(+status/failure_detail 降级形)`；id 集=CONSOLE_KB_SPACE_IDS 默认 "1,3,4" |
| `GET /api/knowledge/ingest-status` | 诚实 404 `knowledge.read_not_wired`（R51 表 L1307-1310） | 无可用上游端点 | 未接入 |
| 空间详情/文档详情的独立深链读口 | **不存在**（本树 grep 无 /api/knowledge/detail、/api/document-detail 族） | — | kn6 空间详情此前即用查询态而非路由（记忆 knB 同口径） |

### 1.2 文档行键形制（版本维度核查的核心）

`_documents_from_bisheng` 产出行键（L1358-1376 代码形）：
`id, document_id, name, description, type, kind, state, status, is_released, collection_name, updated_at, updatedAt, created_at`。
- **无 `version` / `revision` / `current_version` / 任何版本号字段**。
- `is_released` 是 bool 发布旗标（L1366），不是版本。
- `updated_at` = Bisheng naive `update_time` 显式 +08:00（北京时间口径，L1359-1361 注释 R45 同口径）。
- `state/status` = 摄取状态，非版本态。

### 1.3 域侧/services 侧（排除项）

- `services/domain/` 全目录无 knowledge 文件（实测 ls，端点集=employee/approval/audit/task/policy/recognition/skills/versions 族；`versions.py` 是**员工版本**，与知识文档版本无关）。8101 实测无 `/v1/knowledge/*`（server.py L1100 R25 卡注释证实）。
- 本仓 `services/knowledge/` = 检索执行域（ports.py 四态、retrieval.py、citations.py 引用五件套）——语义是「一次检索命中的文档引用」，**不维护文档版本历史**。

## 2. 活体实测（GET 只读，9122 经 BFF，两探测+一键形探测）

| # | 请求 | http | 顶层键 | 行键（首行） | 行数 |
|---|---|---|---|---|---|
| 1 | `/api/documents?limit=5` | **200** | asOf,asOfSource,count,cursor,documents,hasMore,rows,source | collection_name,created_at,description,document_id,id,is_released,kind,name,state,status,type,updatedAt,updated_at | n=1 |
| 2 | `/api/knowledge/spaces` | **200** | asOf,asOfSource,count,cursor,hasMore,probe_notes,rows,source,spaces | description,document_count,kind,last_sync_at,name,space_id | n=3 |
| 3 | 同 #1 行内正则筛版本键 | 200 | — | `version-keys=is_released`（唯一近似键） | 样本 `{id:"2", state:null, is_released:false, updated_at:"2026-11-14T06:33:18+08:00"}` |

凭据只在 BFF 进程内部组装（登录态工件 cookie），本次未回显任何 cookie/token 值。

## 3. kn7「最新版本直达深链」判定

**判定：不可行，标「未实现」。** 逐档依据（禁造参数）：

1. **现有契约即不可行**——不是「BFF 未转发」：上游 Bisheng 文档行本身不带版本字段（§2 实测行键），BFF 透传+双形键后仍无；域 8101 无 knowledge 路由；不存在任何文档版本列表或「当前版本号」可读。`?revision=` **不可用**（上游无此概念，加了也是假参数）。`?version=` **不可用**（同）。
2. `is_released` 只区分「已发布/未发布」布尔态，不构成版本序列；`updated_at` 是单值最近更新时间，非版本历史。
3. 若 kn7 面板未来要「最新版本」，当前契约下**唯一诚实近似** = 文档行按 `updated_at` 排序取最新（=排序语义，不是版本语义），面板文案须写明「最近更新的文档」，禁写「版本 vN」。
4. 真做版本 = Bisheng 上游先建文档版本模型（写侧+读侧），属上游功能缺口 + SoR 之争（agent-pilot Dify datasets vs Bisheng KB，2026-11-20 字段映射报告已标 pending 不自裁），**非本车道可代做**。

## 4. 未实现清单与风险（本调查范围）

- 未实现（如实报）：文档版本列表端点、当前版本号字段、`?revision=`/`?version=` 参数、版本历史深链、版本回退读口——**全部不存在，非未接通**。
- 若为 kn7 强行加 `?version=`：产生假筛选（BFF 丢参或上游 400），违反诚实纪律；不做。
- 零写面：本单无产品码/DB/外部消息改动；BFF 重启/服务启停均未执行。
- 后续触发条件（何时可复议）：Bisheng 上游出现文档版本读口；或知识 SoR 拍板切换到带版本模型的源（Dify datasets 文档有 `doc_status` 聚合但同样无逐文档版本历史——2026-11-20 映射报告 §2）。

## 证据索引（行号=实读）

- bff-v4-serve@b3b0f16 `apps/console/server.py`：L1226-1245（R45 卡面与 spaces 扇出理由）、L1307-1310（ingest-status 未接入）、L1333-1390（documents 实现与行键形）、L1395-1460（spaces 实现）。
- seakoi-agent-os（只读）：`services/domain/` 无 knowledge 文件（ls 实测）；`services/knowledge/ports.py`（检索四态，无版本）。
- OpenViking 佐证：`events/2026-11-19/知识端点实测均未接入.md`（404 unknown_route 旧账，已被 R45/R51 卡部分接通 spaces/documents，ingest/citations 仍未接）、`cases/bff读口补齐.md`、knowledge.py 字段映射报告（SoR pending）。
