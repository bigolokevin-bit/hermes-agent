// Shared local search for the capability tabs. The BFF read routes do not
// accept a search parameter, so the filter runs over the rows already loaded
// by the tab. The note under the field says exactly that; no request is made
// when the operator types.
import { Search, X } from "lucide-react";

import type { ActionGate } from "./gates";

const SEARCH_READY: ActionGate = {
  enabled: true,
  title: "按名称搜索当前清单；只在已经加载的行内筛选。",
  count: "",
};

export function CapabilitySearch({
  value,
  total,
  onChange,
  gate = SEARCH_READY,
}: {
  value: string;
  total: number;
  onChange: (next: string) => void;
  gate?: ActionGate;
}) {
  return (
    <div className="cap5-search-box" data-testid="cap5-search-box" title={gate.title}>
      <label className="cap5-search-field">
        <Search className="cap5-search-icon" aria-hidden="true" />
        <input
          type="search"
          value={value}
          disabled={!gate.enabled}
          aria-disabled={gate.enabled ? undefined : "true"}
          onChange={(event) => onChange(event.target.value)}
          placeholder="按名称搜索当前清单"
          aria-label="按名称搜索当前清单"
          title={gate.title}
          data-testid="cap5-search"
        />
      </label>
      {value ? (
        <button type="button" className="cap5-clear" disabled={!gate.enabled} onClick={() => onChange("")} data-testid="cap5-clear">
          <X className="cap5-clear-icon" aria-hidden="true" />
          清空
        </button>
      ) : null}
      <p className="cap5-scope-note" data-testid="cap5-scope-note">
        仅在当前已加载 {total} 项内搜索
      </p>
      <span className="sr-only" data-testid="cap-gates-search" data-enabled={gate.enabled ? "true" : "false"} title={gate.title} />
    </div>
  );
}