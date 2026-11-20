// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { DutyRedirect, dutyRedirectTarget } from "./dutyRedirect";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement | null = null;

function Probe() {
  const location = useLocation();
  return <span data-testid="landed">{location.pathname + location.search}</span>;
}

function land(entry: string): string {
  host?.remove();
  host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/duty" element={<DutyRedirect />} />
          <Route path="/overview" element={<Probe />} />
        </Routes>
      </MemoryRouter>,
    );
  });
  const landed = host.querySelector("[data-testid='landed']")?.textContent ?? "";
  act(() => root.unmount());
  return landed;
}

afterEach(() => {
  host?.remove();
  host = null;
});

describe("duty redirect keeps the range", () => {
  it("lands with the range the caller passed", () => {
    expect(land("/duty?range=7d")).toBe("/overview?range=7d");
    expect(land("/duty?window=7d")).toBe("/overview?range=7d");
    expect(land("/duty?window=14d")).toBe("/overview?range=30d");
    expect(land("/duty")).toBe("/overview");
  });

  it("translates only range and window, never invents the rest", () => {
    expect(dutyRedirectTarget("?range=30d")).toEqual({ pathname: "/overview", search: "?range=30d" });
    expect(dutyRedirectTarget("?range=14d")).toEqual({ pathname: "/overview", search: "?range=30d" });
    expect(dutyRedirectTarget("?range=30d&window=7d")).toEqual({ pathname: "/overview", search: "?range=30d" });
    // view / groupBy / q have no meaning on /overview: nothing is passed on.
    expect(dutyRedirectTarget("?view=employee&groupBy=model&q=x&window=zz")).toEqual({
      pathname: "/overview",
      search: "",
    });
    expect(dutyRedirectTarget("")).toEqual({ pathname: "/overview", search: "" });
  });
});
