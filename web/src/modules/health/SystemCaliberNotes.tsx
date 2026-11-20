import { useState, type ReactNode } from "react";

import { HEALTH_API_PATH } from "../version/versionHealth";
import { sourceDefinitions } from "./sourceReads";

export const CALIBER_MISSING_POLICY =
  "缺值显示—，不当 0；采集时刻只取上游顶层 ISO，缺失显示—，不拿本机时间顶替。";

const PRICING_API_PATH = "/agent-api/api/models/pricing";

interface CaliberRow {
  key: string;
  name: string;
  path: string;
  scope: string;
}

function rows(): CaliberRow[] {
  const matrix = sourceDefinitions().map((source) => ({
    key: source.id,
    name: source.label,
    path: source.path,
    scope:
      source.id === "health"
        ? "计算范围：services[] 的整体状态、逐服务状态、版本与检查时刻；同一次响应同源。"
        : "计算范围：一次探针 HTTP 响应；矩阵回答这个读口是否可达，不等同于服务健康清单里的服务状态。",
  }));
  return [
    ...matrix,
    {
      key: "version-health",
      name: "版本面健康行",
      path: HEALTH_API_PATH,
      scope: "计算范围：/api/health 的组件行；这里没有组件行时才回退版本接口，不用检查时刻冒充构建时刻。",
    },
    {
      key: "version-pricing",
      name: "模型价格表",
      path: PRICING_API_PATH,
      scope: "计算范围：模型价目表标价与生效时间；与扣费账本分开，不用单价乘用量推算花费。",
    },
  ];
}

export function SystemCaliberNotes(): ReactNode {
  const [open, setOpen] = useState(false);
  const items = rows();
  return (
    <section className="min-w-0 rounded-md border border-border bg-card p-3 text-xs" data-testid="sys-notes">
      <button
        type="button"
        className="flex w-full min-w-0 items-center justify-between gap-3 text-left"
        aria-expanded={open}
        aria-controls="sys-notes-body"
        data-testid="sys-notes-toggle"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="font-medium text-foreground">口径说明</span>
        <span className="shrink-0 text-muted-foreground" aria-hidden="true">{open ? "收起" : "展开"}</span>
      </button>
      {open ? (
        <div className="mt-3 min-w-0 space-y-2" id="sys-notes-body" data-testid="sys-notes-body">
          <p className="min-w-0 break-words text-muted-foreground">
            服务列表回答“服务健康状态”，读源矩阵回答“本页各读口是否可达”；两者即使读取同一路径，也不互相替代。
          </p>
          <ul className="min-w-0 space-y-2">
            {items.map((item) => (
              <li
                className="min-w-0 break-words border-t border-border pt-2 first:border-t-0 first:pt-0"
                data-testid={`sys-note-${item.key}`}
                key={item.key}
              >
                <span data-testid={`sys-note-${item.key}-name`}>{item.name}</span>
                <span aria-hidden="true"> · </span>
                <span className="font-mono" data-testid={`sys-note-${item.key}-path`}>{item.path}</span>
                <span aria-hidden="true"> · </span>
                <span data-testid={`sys-note-${item.key}-scope`}>{item.scope}</span>
                <span aria-hidden="true"> · </span>
                <span data-testid={`sys-note-${item.key}-policy`}>{CALIBER_MISSING_POLICY}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
