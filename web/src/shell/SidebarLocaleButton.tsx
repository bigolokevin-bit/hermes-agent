/**
 * 侧栏账号芯片里的语言按钮（2026-11-24 末轮）。
 *
 * 骨架侧栏底部没有「语言/版本」那一行，但语言切换不许丢功能：收成账号芯片
 * 右端一颗 24px 的地球图标，点开向上弹 17 个 locale 的 listbox，选中即写回
 * i18n（与 components/LanguageSwitcher 同一份 LOCALE_META 与 setLocale，
 * 只是外壳换成图标档，免得「简体中文」四个字把姓名挤掉）。
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Globe } from "lucide-react";
import { LOCALE_META, useI18n } from "@/i18n";
import type { Locale } from "@/i18n";

export function SidebarLocaleButton(): ReactNode {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = LOCALE_META[locale];
  const label = `${t.language.switchTo}: ${current.name}`;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  return (
    <div className="sidebar-locale" ref={rootRef}>
      <button
        type="button"
        className="sidebar-locale-trigger"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={label}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Globe className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {open && (
        <ul
          className="sidebar-locale-menu"
          role="listbox"
          aria-label={t.language.switchTo}
        >
          {(Object.keys(LOCALE_META) as Locale[]).map((code) => (
            <li key={code}>
              <button
                type="button"
                role="option"
                aria-selected={code === locale}
                className="sidebar-locale-option"
                onClick={() => {
                  setLocale(code);
                  setOpen(false);
                }}
              >
                {LOCALE_META[code].name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}