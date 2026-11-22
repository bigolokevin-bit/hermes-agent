import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import "./ui.css";

/**
 * 下拉基元：自绘触发器 + role=listbox 面板。禁原生 <select>——设计系统的 Select
 * 内部渲染的就是原生控件（@nous-research/ui dist/components/Select.d.ts extends
 * Omit<SelectHTMLAttributes<HTMLSelectElement>,"onChange">，且 value 只能是 string），
 * 所以这里自己实现，单值与多选共用一套键盘/焦点语义。
 * 用法：<UiSelect id="role-filter" label="角色" value={role} options={roles}
 *        onChange={(next) => setRole(String(next))} hint="只影响下方表格" />
 */
export interface UiSelectOption {
  value: string;
  label: string;
  hint?: string;
}

export interface UiSelectProps {
  id: string;
  options: UiSelectOption[];
  value: string | string[];
  onChange: (next: string | string[]) => void;
  label?: string;
  placeholder?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  multiple?: boolean;
}

export function UiSelect({
  id,
  options,
  value,
  onChange,
  label,
  placeholder = "请选择",
  hint,
  error,
  disabled = false,
  multiple = false,
}: UiSelectProps): ReactNode {
  const [open, setOpen] = useState(false);
  const host = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent): void => {
      if (host.current && !host.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const picked = Array.isArray(value) ? value : value ? [value] : [];
  const shown =
    picked.length === 0
      ? null
      : picked
          .map((item) => options.find((opt) => opt.value === item)?.label ?? item)
          .join("、");

  const toggle = (item: string): void => {
    if (multiple) {
      const next = picked.includes(item)
        ? picked.filter((entry) => entry !== item)
        : [...picked, item];
      onChange(next);
      return;
    }
    onChange(item);
    setOpen(false);
    trigger.current?.focus();
  };

  return (
    <div className="ui-select" data-open={open ? "true" : "false"} ref={host}>
      {label ? (
        <span className="ui-select-hint" data-testid={`${id}-label`}>
          {label}
        </span>
      ) : null}
      <button
        aria-controls={`${id}-list`}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-disabled={disabled ? true : undefined}
        aria-expanded={open ? "true" : "false"}
        className="ui-select-trigger"
        data-testid={`${id}-trigger`}
        disabled={disabled}
        id={id}
        onClick={() => setOpen((prev) => !prev)}
        role="combobox"
        type="button"
      >
        <span className="ui-select-meta">
          {shown ? (
            <span className="ui-select-value">{shown}</span>
          ) : (
            <span className="ui-select-placeholder">{placeholder}</span>
          )}
        </span>
        <svg aria-hidden="true" className="ui-select-chevron" viewBox="0 0 16 16">
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
      {open ? (
        <div
          aria-label={label ?? placeholder}
          className="ui-select-list"
          data-empty={options.length === 0 ? "true" : undefined}
          data-testid={`${id}-list`}
          id={`${id}-list`}
          role="listbox"
          aria-multiselectable={multiple ? true : undefined}
        >
          {options.length === 0 ? (
            <span className="ui-select-hint" data-testid={`${id}-list-empty`}>
              没有可选值
            </span>
          ) : null}
          {options.map((opt) => {
            const on = picked.includes(opt.value);
            return (
              <button
                aria-selected={on ? "true" : "false"}
                className="ui-select-option"
                data-testid={`${id}-option-${opt.value}`}
                key={opt.value}
                onClick={() => toggle(opt.value)}
                role="option"
                type="button"
              >
                <svg aria-hidden="true" className="ui-select-check" viewBox="0 0 16 16">
                  <path
                    d="M3 8l3 3 7-7"
                    fill="none"
                    opacity={on ? 1 : 0}
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
                <span>{opt.label}</span>
                {opt.hint ? (
                  <span className="ui-select-hint" data-testid={`${id}-hint-${opt.value}`}>
                    {opt.hint}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
      {hint && !error ? (
        <span className="ui-select-hint" data-testid={`${id}-hint`}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className="ui-select-hint" data-testid={`${id}-error`} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
