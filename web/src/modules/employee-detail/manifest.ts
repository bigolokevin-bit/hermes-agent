/**
 * employee-detail 详情 pane — placeholder manifest (stage 1, lane A).
 * PRD Section 7: hidden detail pane (data-hidetab, skeleton:2386) with five
 * zones (workbench/config/tasks/runs/evidence, ZONE_ALIAS overview/chat ->
 * workbench, audit -> evidence). The workbench zone owns the 60/40 split
 * (.wbshell 3fr/2fr, skeleton L845; single column at narrow widths L871):
 * left = the ONLY [data-chat-host] (L2435, never self-painted, never an
 * iframe), right = wbrail with four collapsible groups (id/budget expanded,
 * cap/runs collapsed, L2444-2505). This single manifest covers the whole
 * detail pane INCLUDING the 60/40 workbench placeholder — stage 2 renders
 * the honest shell from this entry plus the zone rows in ROUTE_TABLE
 * (appendix A rows 23-27).
 */
import type { ModuleManifest } from '../../shell/registry';

const manifest: ModuleManifest = {
  module: 'employee-detail',
  tabs: [
    {
      id: 'detail',
      label: '详情',
      // ROUTE_TABLE row 23 — workbench default zone; the four non-default
      // zones are rows 24-27 ('#/employees/:employeeId?zone=…'). Hidden from
      // navigation (entered via row click on the employees list).
      route: '#/employees/:employeeId',
      kind: 'planned',
      dataSource: 'employee/effective-config/employee-versions/tasks/runs/sessions?employee=/audit',
    },
  ],
};

export default manifest;
