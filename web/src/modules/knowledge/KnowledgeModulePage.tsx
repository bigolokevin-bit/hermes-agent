import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowRight, BookOpen, FileText, RefreshCw, Search } from "lucide-react";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";

import { GAP03, isForcedState, loadSpaces, type KnowledgeSpace } from "./knowledge";
import "./knowledge.css";

type Tab = "spaces" | "sources";

function Forced({ state, onRetry }: { state: string; onRetry: () => void }) {
  if (state === "loading") {
    return (
      <div className="knw4-skeleton" aria-busy="true" aria-label="加载中">
        <span /><span /><span />
      </div>
    );
  }
  if (state === "empty") {
    return (
      <div className="knw4-empty">
        <p>知识空间已接入，但当前没有空间。</p>
        <Link className="knw4-link" to="/knowledge?tab=evidence">
          先看证据与引用
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }
  if (state === "denied") {
    return (
      <div className="knw4-empty" role="status">
        <b>无权访问</b>
        <span>你没有查看知识空间的权限，或该模块尚未开放。</span>
      </div>
    );
  }
  return (
    <div className="knw4-error" role="alert">
      <b>知识空间读取失败</b>
      <span>本次请求未记录编号，可复制时间与操作路径反馈。</span>
      <Button size="sm" outlined onClick={onRetry} prefix={<RefreshCw className="h-3.5 w-3.5" />}>
        重试
      </Button>
    </div>
  );
}

export default function KnowledgeModulePage() {
  const [sp, setSp] = useSearchParams();
  const forcedRaw = (sp.get("state") ?? "").toLowerCase();
  const forced = isForcedState(forcedRaw) ? forcedRaw : null;
  const queryTab = sp.get("tab");
  const [tab, setTab] = useState<Tab>(queryTab === "sources" ? "sources" : "spaces");
  const [phase, setPhase] = useState<"loading" | "unavailable">("loading");
  const [rows, setRows] = useState<KnowledgeSpace[]>([]);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    setTab(queryTab === "sources" ? "sources" : "spaces");
  }, [queryTab]);

  useEffect(() => {
    setPhase("loading");
    void loadSpaces().then((r) => {
      setPhase("unavailable");
      setRows(r.rows);
    });
  }, [nonce]);

  const switchTab = (next: Tab) => {
    setTab(next);
    const nextParams = new URLSearchParams(sp);
    if (next === "spaces") nextParams.delete("tab");
    else nextParams.set("tab", next);
    setSp(nextParams, { replace: true });
  };

  const reload = () => setNonce((n) => n + 1);

  return (
    <div className="knw4-page" data-testid="knw4-page">
      <header className="knw4-head">
        <div className="knw4-title">
          <BookOpen className="h-5 w-5" aria-hidden />
          <h1>知识空间</h1>
          <span>空间、文档与检索 · 只读</span>
        </div>
        <Button size="sm" outlined onClick={reload} prefix={<RefreshCw className="h-3.5 w-3.5" />}>
          刷新
        </Button>
      </header>

      <div className="knw4-seg" role="tablist" aria-label="知识分组">
        <button type="button" role="tab" aria-selected={tab === "spaces"} data-testid="knw4-tab-spaces" onClick={() => switchTab("spaces")}>
          知识空间
        </button>
        <button type="button" role="tab" aria-selected={tab === "sources"} data-testid="knw4-tab-sources" onClick={() => switchTab("sources")}>
          数据源
        </button>
      </div>

      <Card>
        <CardContent className="knw4-body">
          {forced ? (
            <Forced state={forced} onRetry={reload} />
          ) : phase === "loading" ? (
            <div className="knw4-skeleton" aria-busy="true" aria-label="加载中">
              <span /><span /><span />
            </div>
          ) : rows.length === 0 ? (
            <div className="knw4-gap" data-testid="knw4-gap">
              <b>未接入</b>
              <span>{GAP03}</span>
              <Link className="knw4-link" to="/approvals">
                去审批中心提交开通申请
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <ul className="knw4-list">
              {rows.map((row) => (
                <li key={row.spaceId} className="knw4-row">
                  <span className="knw4-name">{row.name}</span>
                  <Badge tone="outline">{row.docCount === null ? "文档数 —" : `${row.docCount} 篇`}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {tab === "spaces" ? (
        <div className="knw4-kpis">
          <div className="knw4-kpi">
            <span><FileText className="h-4 w-4" /> 文档数</span>
            <b>—</b>
            <em>知识服务读侧未接入，不显示 0</em>
          </div>
          <div className="knw4-kpi">
            <span><Search className="h-4 w-4" /> 检索</span>
            <b>未接入</b>
            <em>没有可调用的检索接口，不展示样例命中</em>
          </div>
        </div>
      ) : (
        <div className="knw4-gap">
          <b>数据源未接入</b>
          <span>GAP-03：没有数据源读取接口，不展示测试连接或同步按钮。</span>
        </div>
      )}

      <p className="knw4-note">
        本页只读：空间、文档数与检索均以真实接口为准；接口缺失时写「未接入」，
        不以 0 或样例冒充。
      </p>
      <Link className="knw4-link" to="/knowledge?tab=evidence">
        看证据与引用
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}