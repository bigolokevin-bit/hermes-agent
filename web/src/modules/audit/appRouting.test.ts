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
    expect(app).toMatch(/<Route path="\/audit" element=\{<AuditEventsConsolePage \/>\} \/>/);
    expect(app).not.toContain('element={<Navigate to="/system?tab=events" replace />}');
  });

  it("still lazy-loads the audit module through the same pointer", () => {
    expect(app).toContain('import("@/modules/audit/AuditEventsModulePage")');
  });
});
