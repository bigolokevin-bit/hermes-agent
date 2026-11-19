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
 * never reaches this module's panels. The shell files are outside this lane's
 * write domain, so the knowledge deep-link query is normalised here instead,
 * before the App renders: keep the shell's known `tab=spaces` and carry the
 * requested panel in `panel=`, which the module treats as its source of truth.
 *
 * Two spellings arrive: the path form `/knowledge?tab=…` and the hash form
 * `#/knowledge?tab=…` (what the crawl and the console rail use). The hash form is
 * normalised too, otherwise the alias sends `?tab=ingest` to a planned placeholder
 * and `?tab=evidence` to another module before this page ever mounts.
 */
const KNOWLEDGE_PANELS: Record<string, KnowledgePanel> = {
  sources: 'ingest',
  ingest: 'ingest',
  retrieval: 'retrieval',
  search: 'retrieval',
  citations: 'evidence',
  evidence: 'evidence',
  scope: 'spaces',
  spaces: 'spaces',
};

type KnowledgePanel = 'spaces' | 'ingest' | 'retrieval' | 'evidence';

function panelOf(current: string | null, raw: string | null): KnowledgePanel | null {
  const byPanel = KNOWLEDGE_PANELS[(current ?? '').toLowerCase()];
  if (byPanel) return byPanel;
  return KNOWLEDGE_PANELS[(raw ?? '').toLowerCase()] ?? null;
}

function normaliseKnowledgeDeepLink(): void {
  if (typeof window === 'undefined') return;
  const hash = window.location.hash ?? '';
  const hashMatch = /^#\/knowledge(?:\?.*)?$/.test(hash);
  const pathMatch = /\/knowledge\/?$/.test(window.location.pathname);
  if (!hashMatch && !pathMatch) return;

  if (pathMatch) {
    const params = new URLSearchParams(window.location.search);
    const panel = panelOf(params.get('panel'), params.get('tab'));
    if (panel === null) return;
    if (params.get('tab') === 'spaces' && panel === 'spaces' && !params.has('panel')) return;
    params.set('tab', 'spaces');
    params.set('panel', panel);
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}?${params.toString()}${hash}`,
    );
    return;
  }

  const queryStart = hash.indexOf('?');
  const path = queryStart === -1 ? hash : hash.slice(0, queryStart);
  const params = new URLSearchParams(queryStart === -1 ? '' : hash.slice(queryStart + 1));
  const panel = panelOf(params.get('panel'), params.get('tab'));
  if (panel === null) return;
  if (params.get('tab') === 'spaces' && panel === 'spaces' && !params.has('panel')) return;
  params.set('tab', 'spaces');
  params.set('panel', panel);
  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}${window.location.search}${path}?${params.toString()}`,
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
      dataSource: '知识空间与文档登记、知识库检索与引用读取（真实读取，未接入时显示原因）',
    },
    {
      id: 'sources',
      label: '数据源',
      route: '#/knowledge?tab=sources',
      kind: 'planned',
      group: 'knowledge',
      icon: 'Database',
      dataSource: '文档与数据接入登记（读取接口未开放，显示诚实未接入）',
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
