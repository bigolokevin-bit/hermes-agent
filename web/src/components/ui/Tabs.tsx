/**
 * UiTabs —— 补齐设计系统 Tabs 缺的键盘语义（A 基元缺口，L0 点单）。
 *
 * 盘上事实（node_modules/@nous-research/ui/dist/ui/components/tabs.js）：
 *   TabsList 是裸 div（不写 role="tablist"），TabsTrigger 把 value 丢掉
 *   （签名里 `value: _value` 直接弃用），既不写 role="tab" / aria-selected /
 *   aria-controls，也不做 roving tabindex，更没有方向键处理 ⇒ 迁完 Tab 后
 *   Tab 间方向键必然失效，读屏也念不出「第几个/共几个、当前选中谁」。
 * 这里只补语义与键盘，视觉仍复用 DS 的 TabsList / TabsTrigger（它们把
 * 剩余 props 原样铺到 div / button 上），不另造一套 Tab 样式。
 *
 * 口径：WAI-ARIA Authoring Practices 的 tabs 模式 + 自动激活
 * （方向键移动焦点即切换面板，无需再按 Enter）。
 *
 * 用法：
 *   <UiTabs
 *     ariaLabel="员工详情分区"
 *     items={[{ value: "config", label: "配置" }, { value: "runs", label: "运行" }]}
 *     defaultActive="config"
 *     onChange={setZone}
 *   >
 *     {(active) => <ZonePanel zone={active} />}
 *   </UiTabs>
 */
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { TabsList as DsTabsList, TabsTrigger as DsTabsTrigger } from "@nous-research/ui/ui/components/tabs";

export interface UiTabItem {
  value: string;
  label: ReactNode;
}

export interface UiTabsProps {
  items: UiTabItem[];
  /** 无障碍名称：读屏用来说清这组 Tab 管的是什么。 */
  ariaLabel: string;
  /** 受控用法给 value；非受控给 defaultActive。 */
  value?: string;
  defaultActive?: string;
  onChange?: (value: string) => void;
  /** 面板容器 id 前缀，用来连 aria-controls / aria-labelledby。 */
  idPrefix?: string;
  className?: string;
  /** 渲染当前面板；不传则只出 Tab 头。 */
  children?: (active: string, api: { idPrefix: string }) => ReactNode;
}

export function UiTabs({
  items,
  ariaLabel,
  value,
  defaultActive,
  onChange,
  idPrefix = "ui-tabs",
  className,
  children,
}: UiTabsProps) {
  const first = items[0]?.value ?? "";
  const [inner, setInner] = useState(defaultActive ?? value ?? first);
  const active = value ?? inner;
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const select = (next: string, focusIndex?: number) => {
    if (value === undefined) setInner(next);
    onChange?.(next);
    if (focusIndex !== undefined) tabRefs.current[focusIndex]?.focus();
  };

  /** 方向键在 Tab 之间走焦并自动激活；首尾环绕，Home/End 跳两端。 */
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const count = items.length;
    if (count === 0) return;
    const current = Math.max(
      0,
      items.findIndex((item) => item.value === active),
    );
    let next = -1;
    if (event.key === "ArrowRight") next = (current + 1) % count;
    else if (event.key === "ArrowLeft") next = (current - 1 + count) % count;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = count - 1;
    if (next < 0) return;
    event.preventDefault();
    select(items[next].value, next);
  };

  return (
    <div className={["ui-tabs", className].filter(Boolean).join(" ")}>
      <DsTabsList
        className="ui-tabs-list"
        role="tablist"
        aria-label={ariaLabel}
        onKeyDown={onKeyDown}
      >
        {items.map((item, index) => {
          const selected = item.value === active;
          return (
            <DsTabsTrigger
              key={item.value}
              className="ui-tabs-trigger"
              active={selected}
              // DS 把 value 丢了，这里自己补上 ARIA 与 roving tabindex。
              value={item.value}
              data-value={item.value}
              role="tab"
              id={`${idPrefix}-tab-${item.value}`}
              aria-selected={selected}
              aria-controls={`${idPrefix}-panel-${item.value}`}
              tabIndex={selected ? 0 : -1}
              ref={(node: HTMLButtonElement | null) => {
                tabRefs.current[index] = node;
              }}
              onClick={() => select(item.value)}
            >
              {item.label}
            </DsTabsTrigger>
          );
        })}
      </DsTabsList>
      {children ? (
        <div
          className="ui-tabs-panel"
          role="tabpanel"
          id={`${idPrefix}-panel-${active}`}
          aria-labelledby={`${idPrefix}-tab-${active}`}
          tabIndex={0}
        >
          {children(active, { idPrefix })}
        </div>
      ) : null}
    </div>
  );
}

export { DsTabsList as UiTabsList, DsTabsTrigger as UiTabsTrigger };
