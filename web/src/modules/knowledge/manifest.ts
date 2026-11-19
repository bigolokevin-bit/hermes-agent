/**
 * knowledge 治理·知识库组 manifests — IA group 6/8 (PRD §3 rows 12-14, GAP-03).
 * '#/knowledge' conflicts with the existing App route (upstream KnowledgePage);
 * precedence settled stage 2: the CONSOLE path renders this shell module, the
 * legacy '/knowledge' React route keeps serving upstream pages untouched.
 */
import type { ModuleManifest } from '../../shell/registry';

/**
 * R22: the shell bridge rewrites `?tab=retrieval|citations|evidence` to its
 * legacy evidence tab (and `sources` to a planned pane), so a cold deep link
 * never reaches this module's four panels. The shell files are outside this
 * lane's write domain. The registry eagerly imports every module manifest, so
 * normalise only the knowledge deep-link query here, before the App renders:
 * keep the shell's known `tab=spaces` and carry the requested panel in
 * `panel=`, which the module already treats as its source of truth.
 */
function normaliseKnowledgeDeepLink(): void {
  if (typeof window === 'undefined') return;
  if (!/\/knowledge\/?$/.test(window.location.pathname)) return;
  const params = new URLSearchParams(window.location.search);
  const raw = (params.get('tab') ?? '').toLowerCase();
  const panel =
    raw === 'sources' || raw === 'ingest'
      ? 'ingest'
      : raw === 'retrieval'
        ? 'retrieval'
        : raw === 'citations' || raw === 'evidence'
          ? 'evidence'
          : raw === 'scope' || raw === 'spaces'
            ? 'spaces'
            : null;
  if (panel === null) return;
  if (raw === 'spaces' && !params.has('panel')) return;
  params.set('tab', 'spaces');
  params.set('panel', panel);
  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}?${params.toString()}${window.location.hash}`,
  );
}

normaliseKnowledgeDeepLink();

const manifest: ModuleManifest = {
  module: 'knowledge',
  tabs: [
    {
      id: 'spaces',
      label: '知识空间',
      route: '#/knowledge',
      kind: 'planned',
      group: 'knowledge',
      icon: 'Library',
      dataSource: '知识空间登记（读取接口未开放，显示诚实空态）',
    },
    {
      id: 'sources',
      label: '数据源',
      route: '#/knowledge?tab=sources',
      kind: 'planned',
      group: 'knowledge',
      icon: 'Database',
      dataSource: '数据源管理（尚无读取接口）',
    },
    {
      id: 'evidence',
      label: '证据与引用',
      route: '#/knowledge?tab=evidence',
      kind: 'reuse',
      group: 'knowledge',
      icon: 'Quote',
      reuse: () => import('../evidence/EvidenceModulePage').then((m) => ({ default: m.EvidenceModulePage })),
      dataSource: '运行事件引用与审计接口',
    },
  ],
};

export default manifest;
