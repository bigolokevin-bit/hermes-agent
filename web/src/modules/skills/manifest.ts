/**
 * 技能只读列表与详情（T26）。
 * PRD Section 3 row 15 / WBS T26: list + detail, live source, four honest states.
 */
import type { ModuleManifest } from "../../shell/registry";

const manifest: ModuleManifest = {
  module: "capabilities",
  tabs: [
    {
      id: "skills",
      label: "技能",
      route: "#/capabilities",
      kind: "reuse",
      reuse: () => import("./SkillsPage").then((m) => ({ default: m.SkillsPage })),
      dataSource: "/api/skills /api/skills/<id>（已活）",
    },
  ],
};

export default manifest;
