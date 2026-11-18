/**
 * board 任务 pane — placeholder manifest (stage 1, lane A).
 * PRD Section 3 row 5: consumes /api/tasks + /api/task-detail; create is
 * live (POST), transitions migration write is planned (lane D opens it,
 * BOUNDARY-02: done never rolls back). Honest 'planned' placeholder —
 * stage 2 mounts the pane (V2 TasksListPage.tsx:54 is the reuse source,
 * wiring deferred out of stage 1 by the no-upstream-coupling rule).
 */
import type { ModuleManifest } from '../../shell/registry';

const manifest: ModuleManifest = {
  module: 'board',
  tabs: [
    {
      id: 'board',
      label: '任务',
      // ROUTE_TABLE row 5 (appendix A). The cron view deep link is row 31
      // ('#/work?tab=board&view=cron'); '#/work?tab=cron' stays compat-only.
      route: '#/work',
      kind: 'planned',
      dataSource: '/api/tasks /api/task-detail',
    },
  ],
};

export default manifest;
