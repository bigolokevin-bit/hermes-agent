/**
 * ConsoleSelect — a hand-drawn listbox control that replaces every native
 * `<select>` in the console surface.
 *
 * WHY it exists instead of `@nous-research/ui/ui/components/select`: the
 * library control is keyboard-complete but its props are frozen at
 * {children, className, disabled, id, onValueChange, placeholder, style,
 * value} — it will not pass `data-testid` through, and the testids
 * (`tsk4-filter-status`, `audH-page-size`, …) are the addresses the route
 * tests and IA assertions click. Native `<select>` is out for the visual
 * reason this lane exists: the platform popup ignores the console palette.
 *
 * Write-domain note: `src/shell/**` keeps the zero-UI-import discipline, so
 * this file uses no design-system components — only Tailwind semantic
 * utilities (`border-border`, `bg-popover`, `ring-ring`, declared in
 * `src/index.css`) and one inline SVG chevron.
 *
 * Interaction contract (why this is not merely a styled button): Enter/Space
 * or the arrow keys open with the current value highlighted; ArrowUp/Down and
 * Home/End move through the enabled options; Enter/Space picks; Esc closes and
 * returns focus to the trigger; Tab closes; a click outside closes. The
 * trigger is `role="combobox"` with `aria-expanded`/`aria-controls`, options
 * carry `role="option"` + `aria-selected`.
 *
 * Presentation only: the choice leaves through `onChange(value)` — the same
 * string the native handler read off `event.target.value`.
 */

import { useEffect, useId, useRef, useState } from "react";

export interface ConsoleSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface ConsoleSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: ConsoleSelectOption[];
  /** Stays on the trigger: it is the probe address tests use. */
  "data-testid"?: string;
  "aria-label"?: string;
  /** Passes through so a surrounding `<label htmlFor>` still resolves. */
  id?: string;
  /** This console puts its honest explanations in control tooltips. */
  title?: string;
  disabled?: boolean;
  className?: string;
}

/** Stable identity, so React only runs it when the panel mounts. */
function focusOnMount(node: HTMLButtonElement | null): void {
  node?.focus();
}

export function ConsoleSelect({
  value,
  onChange,
  options,
  "data-testid": testId,
  "aria-label": ariaLabel,
  id,
  title,
  disabled = false,
  className,
}: ConsoleSelectProps) {
  const [open, setOpen] = useState(false);
  /** Which option the panel focuses when it opens (see `openList`). */
  const [highlight, setHighlight] = useState(-1);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();

  // The doc comment promises "a click outside closes": without this the panel
  // would linger over whatever the user clicked next. Capture phase so a
  // handler that stops propagation cannot swallow the dismissal.
  useEffect(() => {
    if (!open) return;
    const onDocumentPointerDown = (event: Event) => {
      const node = rootRef.current;
      if (node && event.target instanceof Node && !node.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDocumentPointerDown, true);
    return () => document.removeEventListener("pointerdown", onDocumentPointerDown, true);
  }, [open]);

  const current = options.find((item) => item.value === value);
  const shown = current !== undefined ? current.label : value;

  const focusOption = (index: number): void => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.focus();
  };

  const openList = (): void => {
    if (disabled) return;
    const own = options.findIndex(
      (item) => item.value === value && item.disabled !== true,
    );
    setHighlight(own >= 0 ? own : options.findIndex((item) => item.disabled !== true));
    setOpen(true);
  };

  const closeList = (restoreFocus: boolean): void => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  const pick = (option: ConsoleSelectOption): void => {
    if (option.disabled === true) return;
    setOpen(false);
    onChange(option.value);
    // A native select hands focus back to itself after a choice.
    triggerRef.current?.focus();
  };

  /**
   * `mode`: next/prev step between enabled options, first/last jump. A single
   * enabled set (the normal case) makes both ends the same option, which is
   * what the arrow keys do when they hit the end — they stop, they do not
   * wrap, matching the library control.
   */
  const moveFocus = (from: number, mode: "next" | "prev" | "first" | "last"): void => {
    const enabled = options
      .map((item, index) => ({ item, index }))
      .filter((entry) => entry.item.disabled !== true);
    if (enabled.length === 0) return;
    const at = enabled.findIndex((entry) => entry.index === from);
    const target =
      mode === "first"
        ? enabled[0]
        : mode === "last"
          ? enabled[enabled.length - 1]
          : enabled[Math.min(enabled.length - 1, Math.max(0, at + (mode === "next" ? 1 : -1)))];
    focusOption(target?.index ?? enabled[0].index);
  };

  const onListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeList(true);
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative flex min-w-0 max-w-full">
      <button
        type="button"
        ref={triggerRef}
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        title={title}
        disabled={disabled}
        data-testid={testId}
        data-value={value}
        onClick={() => (open ? closeList(false) : openList())}
        onKeyDown={(event) => {
          // Enter/Space activate the button itself (onClick opens it); handling
          // them here too would open and immediately close the panel.
          if (event.key === "Escape" && open) {
            event.preventDefault();
            closeList(true);
            return;
          }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openList();
          }
        }}
        className={[
          "min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 text-start",
          "tracking-normal focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2",
          className ?? "",
          disabled ? "cursor-not-allowed opacity-60" : "",
        ].join(" ")}
        style={{ display: "inline-flex", alignItems: "center" }}
      >
        <span className="min-w-0 flex-1 truncate">{shown}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          width="12"
          height="12"
          className="shrink-0 opacity-60"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <path d="M3 5l3 3 3-3" />
        </svg>
      </button>

      {open ? (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={ariaLabel ?? shown}
          onKeyDown={onListKeyDown}
          className="absolute top-full left-0 z-50 mt-1 max-h-64 min-w-full overflow-auto rounded-md border border-border bg-popover p-1 text-foreground shadow-lg shadow-black/30"
        >
          {options.map((option, index) => {
            const selected = option.value === value;
            return (
              <button
                key={`${option.value}\u0000${index}`}
                type="button"
                role="option"
                aria-selected={selected}
                data-index={index}
                data-value={option.value}
                tabIndex={-1}
                disabled={option.disabled === true}
                ref={index === highlight ? focusOnMount : undefined}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    moveFocus(index, "next");
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    moveFocus(index, "prev");
                  } else if (event.key === "Home") {
                    event.preventDefault();
                    moveFocus(index, "first");
                  } else if (event.key === "End") {
                    event.preventDefault();
                    moveFocus(index, "last");
                  }
                }}
                onClick={() => pick(option)}
                className={[
                  "block w-full min-w-0 truncate rounded-sm px-2 py-2 text-left text-sm tracking-normal",
                  "focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset",
                  selected ? "bg-accent font-medium" : "hover:bg-accent/60",
                  option.disabled === true ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                ].join(" ")}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
