/**
 * work 运营·任务与运行组 manifests — IA group 3/8 (PRD §3 rows 5-6).
 * board/runs pages exist in modules/tasks + modules/runs (lanes E/T15);
 * kind stays 'planned' exactly as the pre-group manifests declared it so
 * the shell's live-node policy (App-provided) is unchanged.
 */
import type { ModuleManifest } from '../../shell/registry';

const manifest: ModuleManifest = {
  module: 'work',
  tabs: [
    {
      id: 'board',
      label: '任务',
      // ROUTE_TABLE row 5 (appendix A). The cron view deep link is row 31
      // ('#/work?tab=board&view=cron'); '#/work?tab=cron' stays compat-only.
      route: '#/work',
      kind: 'reuse',
      group: 'work',
      icon: 'SquareKanban',
      reuse: () => import('../tasks/TasksBoardModulePage'),
      dataSource: '任务列表与任务详情接口',
    },
    {
      id: 'runs',
      label: '运行',
      // ROUTE_TABLE row 6 (appendix A).
      route: '#/work?tab=runs',
      kind: 'reuse',
      group: 'work',
      icon: 'Activity',
      reuse: () => import('../runs/RunsModulePage').then((m) => ({ default: m.RunsModulePage })),
      dataSource: '运行记录、运行详情与运行事件接口',
    },
  ],
};

export default manifest;
