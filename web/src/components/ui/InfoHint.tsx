import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { GLOSSARY, type GlossaryTerm } from "./glossary";

/**
 * 全站唯一的「解释性文字」载体：问号图标（14px）紧跟被解释标签右侧 4px，
 * hover 120ms 出现、Tab 可聚焦、Esc 关闭、`aria-describedby` 关联弹层；
 * 弹层宽 240–320px、字号 12px、行高 1.6，移动端 tap 打开底部抽屉。
 * 文案只准来自 `glossary.ts`：同一术语全站一份定义，页面不得另写。
 *
 * 用法：`<InfoHint term="duty.ready">可上岗</InfoHint>`
 */
export interface InfoHintProps {
  /** glossary key；页面只能引用 key，不允许自带文案。 */
  term: GlossaryTerm;
  /** 被解释的可见标签（文本或元素）。 */
  children?: ReactNode;
  /** 覆盖出处展示（一般不传，默认取 glossary）。 */
  source?: string;
  className?: string;
  testid?: string;
}

export function InfoHint({ term, children, source, className, testid }: InfoHintProps) {
  const entry = GLOSSARY[term];
  const id = useId();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <span className={cn("ui-hint", className)} data-hint-term={term} data-testid={testid ?? `hint-${term}`}>
      {children ? <span className="ui-hint-label">{children}</span> : null}
      <button
        type="button"
        className="ui-hint-trigger"
        ref={trigger}
        aria-label={`解释：${term}`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <HelpCircle className="h-3.5 w-3.5" aria-hidden />
      </button>
      <span
        id={id}
        role="tooltip"
        className="ui-hint-pop"
        data-open={open ? "true" : "false"}
        data-testid={`${testid ?? `hint-${term}`}-pop`}
      >
        <span className="ui-hint-text">{entry.text}</span>
        {source ?? entry.source ? (
          <span className="ui-hint-src" data-testid={`${testid ?? `hint-${term}`}-source`}>
            出处 · {source ?? entry.source}
          </span>
        ) : null}
      </span>
    </span>
  );
}
