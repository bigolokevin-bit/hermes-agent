/**
 * R21 b — `/audit` must mount the audit page itself.
 *
 * The shell used to answer `/audit` with <Navigate to="/system?tab=events">, so
 * the address bar moved and the module body never rendered: QA measured
 * techDetails:false on a page that was not on screen. This is a source-level
 * contract because the alternative — mounting the whole App with its auth and
 * plugin providers in jsdom — would test far more than the sentence we care
 * about. The runtime half lives in AuditEventsModulePage.test.tsx, which renders
 * the page at both /audit and /audit?tab=events.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const app = readFileSync(resolve(__dirname, "../../App.tsx"), "utf8");

describe("the /audit compat route", () => {
  it("mounts the audit page directly instead of rewriting the URL", () => {
    expect(app).toMatch(/<Route path="\/audit" element=\{<(?:AuditEventsConsolePage|AuditAwareEntry) \/>\} \/>/);
    expect(app).not.toContain('element={<Navigate to="/system?tab=events" replace />}');
  });

  it("still lazy-loads the audit module through the same pointer", () => {
    expect(app).toContain('import("@/modules/audit/AuditEventsModulePage")');
  });

  /**
   * R24 — the `/audit` white screen. `AuditAwareEntry` called `useSearchParams()`
   * while App.tsx imported only Routes/Route/NavLink/Navigate/useLocation/
   * useNavigate from react-router. esbuild leaves an unresolved identifier as a
   * global lookup, so the route threw a ReferenceError at render time and the
   * whole page went blank (tsc called it TS2552 on App.tsx:1592). A hook the
   * entry calls must be imported by name; this pins that sentence at the source
   * level, because the failure mode is a blank screen rather than a broken
   * widget.
   */
  it("imports the hooks the audit entry calls, so the route cannot throw at render", () => {
    expect(app).toContain("const [sp] = useSearchParams();");
    const reactRouterImport = app.match(/import \{[\s\S]*?\} from "react-router";/);
    expect(reactRouterImport).not.toBeNull();
    expect(reactRouterImport?.[0]).toContain("useSearchParams");
  });
});
