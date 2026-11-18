import type { ModuleManifest } from "@/shell/registry";

/** T12 · employee list module manifest. Filled in the lane-owned module dir. */
const manifest: ModuleManifest = {
  module: "employees",
  tabs: [
    {
      id: "employees",
      label: "员工",
      route: "#/employees",
      kind: "reuse",
      reuse: () => import("./EmployeesModulePage").then((m) => ({ default: m.EmployeesModulePage })),
      dataSource: "/api/employees",
    },
  ],
};

export default manifest;