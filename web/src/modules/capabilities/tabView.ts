/**
 * capH — per-tab scroll/focus memory for /capabilities.
 *
 * The shell unmounts one tab page when another mounts. Data and the open row
 * already survive in module memory; this keeps the reader's viewport and puts
 * keyboard focus back on the tab they just used. The store is memory only:
 * a full browser refresh starts at the top, which is stated in the evidence.
 */

export interface TabView {
  top: number;
  firstRow: string | null;
}

const views = new Map<string, TabView>();
let lastTab: string | null = null;

export function resetTabView(): void {
  views.clear();
  lastTab = null;
}

export function rememberTabView(tab: string, view: TabView): void {
  views.set(tab, view);
}

export function readTabView(tab: string): TabView | null {
  return views.get(tab) ?? null;
}

/** Record the current tab. Returns true when this is a real switch (not first mount). */
export function noteTabMount(tab: string): boolean {
  const previous = lastTab;
  lastTab = tab;
  return previous !== null && previous !== tab;
}

function scrollable(element: HTMLElement | null): boolean {
  if (!element) return false;
  const style = window.getComputedStyle(element);
  if (!/(auto|scroll)/.test(style.overflowY)) return false;
  return element.scrollHeight > element.clientHeight + 1;
}

/** The nearest real vertical scroller, else the document scroller. */
export function findScrollHost(root: HTMLElement | null): HTMLElement | null {
  let node: HTMLElement | null = root;
  while (node) {
    if (scrollable(node)) return node;
    node = node.parentElement;
  }
  const doc = document.scrollingElement;
  if (doc instanceof HTMLElement && doc.scrollHeight > doc.clientHeight + 1) return doc;
  return null;
}

export function visibleRowTestId(
  root: HTMLElement | null,
  rowSelector: string,
  host: HTMLElement | null,
): string | null {
  if (!root) return null;
  const rows = Array.from(root.querySelectorAll<HTMLElement>(rowSelector));
  if (rows.length === 0) return null;
  const box = host?.getBoundingClientRect() ?? {
    top: 0,
    bottom: window.innerHeight || document.documentElement.clientHeight,
  };
  for (const row of rows) {
    const rect = row.getBoundingClientRect();
    if (rect.height > 0 && rect.bottom > box.top && rect.top < box.bottom) {
      return row.dataset.testid ?? row.getAttribute("data-testid");
    }
  }
  return rows[0].dataset.testid ?? rows[0].getAttribute("data-testid");
}

export function captureTabView(
  tab: string,
  root: HTMLElement | null,
  rowSelector: string,
): TabView {
  const host = findScrollHost(root);
  const top = host ? host.scrollTop : window.scrollY || 0;
  const view = { top, firstRow: visibleRowTestId(root, rowSelector, host) };
  rememberTabView(tab, view);
  return view;
}

export function restoreTabView(
  tab: string,
  root: HTMLElement | null,
): TabView | null {
  const saved = readTabView(tab);
  if (!saved) return null;
  const apply = () => {
    const host = findScrollHost(root);
    if (host) host.scrollTop = saved.top;
    else window.scrollTo({ top: saved.top, behavior: "auto" });
  };
  // Wait for the restored rows to be painted before measuring the scroller.
  window.requestAnimationFrame(() => window.requestAnimationFrame(apply));
  return saved;
}

/** Move focus to the tab that was just chosen, without changing its scroll. */
export function focusTabButton(tab: string): void {
  window.requestAnimationFrame(() => {
    const element = document.querySelector<HTMLElement>(
      `[role="tab"][data-tab="${tab}"]`,
    );
    element?.focus({ preventScroll: true });
  });
}