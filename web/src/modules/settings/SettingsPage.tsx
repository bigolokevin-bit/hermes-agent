import { useEffect, useState } from "react";
import { Button, Input, Select, SelectOption, Switch } from "@nous-research/ui";
import { ConsoleCard } from "@/components/console/ConsoleCard";
import { fetchJSON } from "@/lib/api";
import { currentFixtureState } from "../../shell/fixtures";
import {
  buildBlocks,
  readRuntimeFacts,
  readSourcePorts,
  type BlockSpec,
  type FieldSpec,
  type RuntimeFacts,
  type SourcesFacts,
} from "./settings";
import "./settings.css";

/** 只读控件统一 tooltip：写入口未开放，控件一律骨架化。 */
const READONLY_TITLE = "只读：写入口未开放";

const LOADING_RUNTIME: RuntimeFacts = { phase: "loading", values: {}, collectedAt: null };
const LOADING_SOURCES: SourcesFacts = { phase: "loading", rows: [], collectedAt: null };
const ABSENT_RUNTIME: RuntimeFacts = { phase: "unavailable", values: {}, collectedAt: null };
const ABSENT_SOURCES: SourcesFacts = { phase: "unavailable", rows: [], collectedAt: null };

/**
 * 只读控件：全部 disabled + aria-disabled，title 说明写入口未开放。
 * select 用设计系统 Select（role=combobox，非原生 select），input/switch 同源。
 */
function FieldControl({ field }: { field: FieldSpec }) {
  const testid = `set5-ctl-${field.key}`;

  if (field.kind === "switch") {
    return (
      <Switch
        checked={field.checked ?? false}
        onCheckedChange={() => {}}
        disabled
        aria-disabled="true"
        aria-label={`${field.label}（只读）`}
        title={READONLY_TITLE}
        data-testid={testid}
      />
    );
  }

  if (field.kind === "select") {
    return (
      <span className="set5-ctl-select-wrap" aria-disabled="true" title={READONLY_TITLE} data-testid={testid}>
        <Select
          className="set5-ctl-select"
          disabled
          value={field.value}
          onValueChange={() => {}}
        >
          {(field.options ?? [field.value]).map((option) => (
            <SelectOption key={option} value={option}>
              {option}
            </SelectOption>
          ))}
        </Select>
      </span>
    );
  }

  return (
    <Input
      className="set5-ctl-input"
      disabled
      readOnly
      aria-disabled="true"
      aria-label={`${field.label}（只读）`}
      title={READONLY_TITLE}
      value={field.value}
      onChange={() => {}}
      data-testid={testid}
    />
  );
}

/** 一行 = label（左，13px）| 控件（右）| 当前值/说明（12px 弱色，行下）。 */
function FieldRow({ field }: { field: FieldSpec }) {
  return (
    <div className="set5-field" data-testid={`set5-field-${field.key}`}>
      <span className="set5-field-label">{field.label}</span>
      <span className="set5-field-control">
        <FieldControl field={field} />
      </span>
      {field.hint ? <span className="set5-field-hint set5-micro">{field.hint}</span> : null}
    </div>
  );
}

function BlockCard({ block }: { block: BlockSpec }) {
  return (
    <ConsoleCard
      label={block.label}
      action={block.meta}
      availability={block.availability}
      note={block.note}
      data-testid={`set5-card-${block.id}`}
    >
      <div className="set5-fields">
        {block.fields.map((field) => (
          <FieldRow key={field.key} field={field} />
        ))}
      </div>
    </ConsoleCard>
  );
}

export function SettingsPage() {
  const [runtime, setRuntime] = useState<RuntimeFacts>(LOADING_RUNTIME);
  const [sources, setSources] = useState<SourcesFacts>(LOADING_SOURCES);

  useEffect(() => {
    let alive = true;
    const forced = currentFixtureState();
    // 预览态只影响读数呈现，表单形状始终在（不落空白页）。
    if (forced === "loading") {
      setRuntime(LOADING_RUNTIME);
      setSources(LOADING_SOURCES);
      return () => { alive = false; };
    }
    if (forced === "empty" || forced === "error") {
      setRuntime(ABSENT_RUNTIME);
      setSources(ABSENT_SOURCES);
      return () => { alive = false; };
    }

    void (async () => {
      const [summary, health] = await Promise.allSettled([
        fetchJSON<unknown>("/agent-api/api/hermes-summary"),
        fetchJSON<unknown>("/agent-api/api/health/sources"),
      ]);
      if (!alive) return;
      setRuntime(summary.status === "fulfilled" ? readRuntimeFacts(summary.value) : ABSENT_RUNTIME);
      setSources(health.status === "fulfilled" ? readSourcePorts(health.value) : ABSENT_SOURCES);
    })();

    return () => { alive = false; };
  }, []);

  const blocks = buildBlocks(runtime, sources);
  const updated =
    runtime.collectedAt ??
    sources.collectedAt ??
    (runtime.phase === "loading" || sources.phase === "loading" ? "读取中…" : "未读到");

  return (
    <section className="set5-page" data-testid="set5-page">
      <header className="set5-head">
        <div className="min-w-0">
          <h2 className="set5-title" data-testid="set5-title">默认设置</h2>
          <p className="set5-sub" data-testid="set5-sub">运行时 · 密钥 · 插件 · 检查点</p>
        </div>
        <div className="set5-toolbar" data-testid="set5-toolbar">
          <Button size="sm" outlined disabled aria-disabled="true" title={READONLY_TITLE} data-testid="set5-save">
            保存
          </Button>
          <Button size="sm" outlined disabled aria-disabled="true" title={READONLY_TITLE} data-testid="set5-reset">
            重置
          </Button>
          <span className="set5-micro">只读环境：本版本写入口未开放，保存与重置不生效</span>
        </div>
      </header>

      <p className="set5-caliber set5-micro" data-testid="set5-caliber">
        范围 本环境只读事实 · 更新 {updated} · 对象 运行时摘要 + 服务探测 ·
        口径 缺值按缺口标注，不补 0、不估算
      </p>

      <div className="set5-stack" data-testid="set5-content">
        {blocks.map((block) => (
          <BlockCard key={block.id} block={block} />
        ))}
      </div>
    </section>
  );
}