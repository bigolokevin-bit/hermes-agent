// Keep the current capabilities tab in the URL even when it is the module's
// default tab (the shell omits `tab=` for the first tab). A deep link or a
// refresh therefore still says which tab the reader is on; `q`, `sort` and
// `dir` stay untouched. We never overwrite another tab's value: the shell is
// authoritative for routing.
import { useEffect } from "react";
import { useSearchParams } from "react-router";

export function useEnsureTabParam(tabId: string) {
  const [params, setParams] = useSearchParams();
  const current = params.get("tab");

  useEffect(() => {
    if (current === tabId) return;
    if (current !== null && current !== "") return;
    const next = new URLSearchParams(params);
    next.set("tab", tabId);
    setParams(next, { replace: true });
  }, [current, params, setParams, tabId]);
}